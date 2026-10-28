import {
  ChaveEtapaSistema,
  COLUNAS_POS_VENDA_ECOLUME,
  COLUNAS_PRE_VENDA_ECOLUME,
  FaseKanbanPedido,
  MOTIVOS_PERDA_PADRAO,
  StatusOrcamento,
  StatusPedido,
  TipoEtapaFunil,
} from '@arcco/contratos';
import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient | Prisma.DefaultPrismaClient;

const ORCS_ABERTOS: StatusOrcamento[] = [
  StatusOrcamento.RASCUNHO,
  StatusOrcamento.ENVIADO,
  StatusOrcamento.ACEITO,
];

const ETAPAS_PRE: Array<{
  chave: string;
  nome: string;
  ordem: number;
  tipo: TipoEtapaFunil;
}> = [
  { chave: ChaveEtapaSistema.NOVO_CONTATO, nome: 'Novo contato', ordem: 1, tipo: TipoEtapaFunil.ABERTA },
  {
    chave: ChaveEtapaSistema.ORCAMENTO_EM_ABERTO,
    nome: 'Orçamento em aberto',
    ordem: 2,
    tipo: TipoEtapaFunil.ABERTA,
  },
  { chave: ChaveEtapaSistema.PERDIDO, nome: 'Perdido', ordem: 3, tipo: TipoEtapaFunil.PERDIDA },
];

/** Garante etapas pré-venda Ecolume sem apagar etapas legadas. */
export async function garantirEtapasEcolume(tx: Tx, empresaId: string) {
  for (const e of ETAPAS_PRE) {
    const existe = await tx.etapaFunil.findFirst({
      where: { empresaId, chaveSistema: e.chave },
    });
    if (existe) {
      if (!existe.ativo || existe.nome !== e.nome) {
        await tx.etapaFunil.update({
          where: { id: existe.id },
          data: { ativo: true, nome: e.nome, tipo: e.tipo },
        });
      }
      continue;
    }
    await tx.etapaFunil.create({
      data: {
        empresaId,
        nome: e.nome,
        ordem: e.ordem,
        tipo: e.tipo,
        chaveSistema: e.chave,
        ativo: true,
      },
    });
  }
}

export function motivosPerdaPadrao() {
  return MOTIVOS_PERDA_PADRAO.map((m) => ({ ...m }));
}

export function resolverMotivoPerda(
  entrada: {
    codigoMotivoPerda?: string | null;
    motivoPerda?: string | null;
  },
  catalogo: Array<{ codigo: string; rotulo: string; exigeDescricao: boolean }> = motivosPerdaPadrao(),
): { motivo: string; codigo: string } | { erro: string } {
  const codigo = entrada.codigoMotivoPerda ?? null;
  if (!codigo) {
    const texto = entrada.motivoPerda?.trim();
    if (!texto) return { erro: 'Informe o motivo da perda' };
    return { motivo: texto, codigo: 'OUTRO' };
  }
  const def = catalogo.find((m) => m.codigo === codigo);
  if (!def) return { erro: 'Motivo de perda invalido' };
  if (def.exigeDescricao) {
    const texto = entrada.motivoPerda?.trim();
    if (!texto) return { erro: 'Descreva o motivo (Outro)' };
    return { motivo: texto, codigo: def.codigo };
  }
  return { motivo: def.rotulo, codigo: def.codigo };
}

export function colunaPedidoDe(pedido: {
  status: string;
  faseKanban: string | null;
}): string | null {
  if (pedido.status === StatusPedido.CANCELADO) return null;
  if (pedido.status === StatusPedido.FINALIZADO) return ChaveEtapaSistema.PEDIDO_FINALIZADO;
  const fase = pedido.faseKanban || FaseKanbanPedido.PEDIDO_CONFIRMADO;
  if ((COLUNAS_POS_VENDA_ECOLUME as readonly string[]).includes(fase)) return fase;
  return ChaveEtapaSistema.PEDIDO_CONFIRMADO;
}

export function temOrcamentoAberto(
  orcs: Array<{ status: string }>,
): boolean {
  return orcs.some((o) => ORCS_ABERTOS.includes(o.status as StatusOrcamento));
}

/**
 * Coluna pré-venda derivada: Perdido se etapa PERDIDA;
 * Orçamento em aberto se houver ORC aberto;
 * Novo contato se etapa NOVO_CONTATO ou sem ORC aberto e não perdido.
 * Sem ORC aberto e com pedidos → null (só pós-venda).
 */
export function colunaPreVendaDe(entrada: {
  chaveEtapa: string | null;
  tipoEtapa: string;
  orcs: Array<{ status: string }>;
  temPedidoAtivo: boolean;
}): string | null {
  if (
    entrada.tipoEtapa === TipoEtapaFunil.PERDIDA ||
    entrada.chaveEtapa === ChaveEtapaSistema.PERDIDO
  ) {
    return ChaveEtapaSistema.PERDIDO;
  }
  if (temOrcamentoAberto(entrada.orcs)) {
    return ChaveEtapaSistema.ORCAMENTO_EM_ABERTO;
  }
  if (entrada.temPedidoAtivo) return null;
  return ChaveEtapaSistema.NOVO_CONTATO;
}

export function rotuloColuna(chave: string): string {
  const mapa: Record<string, string> = {
    [ChaveEtapaSistema.NOVO_CONTATO]: 'Novo contato',
    [ChaveEtapaSistema.ORCAMENTO_EM_ABERTO]: 'Orçamento em aberto',
    [ChaveEtapaSistema.PERDIDO]: 'Perdido',
    [ChaveEtapaSistema.PEDIDO_CONFIRMADO]: 'Pedido confirmado',
    [ChaveEtapaSistema.EM_SEPARACAO]: 'Em separação / aguardando compra',
    [ChaveEtapaSistema.PRONTO_ENTREGA]: 'Pronto para entrega',
    [ChaveEtapaSistema.ENTREGUE]: 'Entregue',
    [ChaveEtapaSistema.PEDIDO_FINALIZADO]: 'Finalizado',
  };
  return mapa[chave] ?? chave;
}

export function diasDesde(data: Date | string | null | undefined, agora = new Date()): number {
  if (!data) return 0;
  const d = typeof data === 'string' ? new Date(data) : data;
  return Math.max(0, Math.floor((agora.getTime() - d.getTime()) / 86_400_000));
}

export { COLUNAS_PRE_VENDA_ECOLUME, COLUNAS_POS_VENDA_ECOLUME, ORCS_ABERTOS };
