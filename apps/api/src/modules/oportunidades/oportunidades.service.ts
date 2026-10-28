import { Injectable } from '@nestjs/common';
import {
  ChaveEtapaSistema,
  criarRespostaPaginada,
  EntidadeCampoPersonalizado,
  NaturezaPessoa,
  OrigemHistoricoEtapa,
  OrigemNegocio,
  StatusOrcamento,
  TipoAtividade,
  TipoContato,
  TipoEtapaFunil,
  type criarOportunidadeSchema,
  type moverOportunidadeSchema,
  type paginacaoQuerySchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { avaliarTransicaoEtapa } from '../../common/utils/funil';
import { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';
import { ContatosService } from '../contatos/contatos.service';
import { EventosService, TipoEvento } from '../eventos/eventos.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ProdutosService } from '../produtos/produtos.service';
import { lerAjustes, persistirAjustes } from '../../common/utils/ajustes-persistir';
import {
  COLUNAS_POS_VENDA_ECOLUME,
  COLUNAS_PRE_VENDA_ECOLUME,
  colunaPedidoDe,
  colunaPreVendaDe,
  diasDesde,
  garantirEtapasEcolume,
  resolverMotivoPerda,
  rotuloColuna,
  temOrcamentoAberto,
} from './kanban-ecolume';
import { motivosPerdaDeConfig } from '@arcco/contratos';

type CriarOportunidadeInput = z.infer<typeof criarOportunidadeSchema>;
type AtualizarOportunidadeInput = Partial<CriarOportunidadeInput> & { motivoPerda?: string | null };
type MoverInput = z.infer<typeof moverOportunidadeSchema>;
type PaginacaoQuery = z.infer<typeof paginacaoQuerySchema> & {
  etapaId?: string;
  responsavelId?: string;
  categoriaId?: string;
};

export interface OpcoesCriarOportunidade {
  origemHistorico?: OrigemHistoricoEtapa;
  usuarioId?: string | null;
  /** Resolve etapa por chaveSistema (ex.: QUALIFICACAO). Ignorado se dto.etapaId estiver setado. */
  chaveSistemaEtapa?: string;
}

export interface OpcoesMoverOportunidade {
  origem?: OrigemHistoricoEtapa;
  usuarioId?: string | null;
}

const INCLUDE_PADRAO = {
  contato: { select: { id: true, nome: true, telefone: true, cidade: true, natureza: true } },
  parceiro: {
    select: { id: true, nome: true, telefone: true, ehParceiro: true, rtPadrao: true, tipoParceiro: true },
  },
  etapa: { select: { id: true, nome: true, tipo: true, ordem: true, chaveSistema: true } },
  categoria: { select: { id: true, nome: true } },
  obra: { select: { id: true, nome: true } },
} satisfies Prisma.OportunidadeInclude;

const INCLUDE_DETALHE = {
  ...INCLUDE_PADRAO,
  historicoEtapas: { orderBy: { criadoEm: 'asc' as const } },
  eventos: { orderBy: { criadoEm: 'desc' as const } },
  atividades: {
    where: { concluida: false },
    orderBy: { vencimento: 'asc' as const },
    take: 5,
  },
  orcamentos: {
    include: {
      itens: { orderBy: { ordem: 'asc' as const } },
    },
    orderBy: { versao: 'desc' as const },
  },
} satisfies Prisma.OportunidadeInclude;

@Injectable()
export class OportunidadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platform: PlatformPrismaService,
    private readonly campos: CamposPersonalizadosService,
    private readonly eventos: EventosService,
    private readonly produtos: ProdutosService,
    private readonly permissoes: PermissoesService,
    private readonly contatos: ContatosService,
  ) {}

  private serializar<T>(op: T): T {
    const registro = op as Record<string, unknown>;
    const rt = registro.rtNegocio;
    const parceiro = registro.parceiro as { rtPadrao?: unknown } | null | undefined;
    return {
      ...registro,
      rtNegocio: rt == null ? null : Number(rt),
      parceiro: parceiro
        ? { ...parceiro, rtPadrao: parceiro.rtPadrao == null ? null : Number(parceiro.rtPadrao) }
        : parceiro,
    } as T;
  }

  private async restringirNegociosProprios(
    where: Prisma.OportunidadeWhereInput,
    empresaId: string,
    usuario?: { id: string; perfil: string } | null,
  ) {
    if (!usuario) return;
    const todos = await this.permissoes.veTodosNegocios({
      id: usuario.id,
      empresaId,
      perfil: usuario.perfil,
    });
    if (!todos) where.responsavelId = usuario.id;
  }

  async listar(
    empresaId: string,
    query: PaginacaoQuery,
    usuario?: { id: string; perfil: string } | null,
  ) {
    const where: Prisma.OportunidadeWhereInput = { empresaId };
    if (query.etapaId) where.etapaId = query.etapaId;
    if (query.responsavelId) where.responsavelId = query.responsavelId;
    if (query.categoriaId) where.categoriaId = query.categoriaId;
    await this.restringirNegociosProprios(where, empresaId, usuario);
    if (query.busca) {
      where.OR = [
        { titulo: { contains: query.busca } },
        { codigo: { contains: query.busca } },
        { contato: { nome: { contains: query.busca } } },
      ];
    }

    const [dados, total] = await this.prisma.$transaction([
      this.prisma.oportunidade.findMany({
        where,
        include: INCLUDE_PADRAO,
        orderBy: { criadoEm: 'desc' },
        skip: (query.pagina - 1) * query.porPagina,
        take: query.porPagina,
      }),
      this.prisma.oportunidade.count({ where }),
    ]);

    const comResp = await this.anexarResponsaveis(dados);
    return criarRespostaPaginada(
      comResp.map((o) => this.serializar(o as Record<string, unknown>)),
      total,
      query.pagina,
      query.porPagina,
    );
  }

  /**
   * Agrupa oportunidades por etapa para o kanban (inclui Fechado/Perdido).
   * Opps em etapa inativa/removida do funil ativo vão para "Fora do funil".
   */
  async kanban(
    empresaId: string,
    filtros: {
      responsavelId?: string;
      categoriaId?: string;
      parceiroId?: string;
      periodoDe?: string;
      periodoAte?: string;
      escopo?: 'pre' | 'pos' | 'todos';
      finalizadosDias?: number;
    } = {},
    usuario?: { id: string; perfil: string } | null,
  ) {
    if (await this.permissoes.empresaEcolume(empresaId)) {
      return this.kanbanEcolume(empresaId, filtros, usuario);
    }
    const where: Prisma.OportunidadeWhereInput = { empresaId };
    if (filtros.responsavelId) where.responsavelId = filtros.responsavelId;
    if (filtros.categoriaId) where.categoriaId = filtros.categoriaId;
    await this.restringirNegociosProprios(where, empresaId, usuario);

    const [etapasAtivas, oportunidades] = await this.prisma.$transaction([
      this.prisma.etapaFunil.findMany({
        where: { empresaId, ativo: true },
        orderBy: { ordem: 'asc' },
      }),
      this.prisma.oportunidade.findMany({
        where,
        include: INCLUDE_PADRAO,
        orderBy: { atualizadoEm: 'desc' },
      }),
    ]);

    const idsAtivos = new Set(etapasAtivas.map((e) => e.id));
    const orfas = oportunidades.filter((o) => !idsAtivos.has(o.etapaId));
    const comResponsavel = await this.anexarResponsaveis(oportunidades);
    const porId = new Map(comResponsavel.map((o) => [o.id, o]));

    const colunas = etapasAtivas.map((etapa) => ({
      etapa,
      oportunidades: oportunidades
        .filter((o) => o.etapaId === etapa.id)
        .map((o) => porId.get(o.id)!),
    }));

    if (orfas.length > 0) {
      colunas.push({
        etapa: {
          id: '__fora_do_funil__',
          empresaId,
          nome: 'Fora do funil',
          ordem: 9_999,
          tipo: TipoEtapaFunil.ABERTA,
          chaveSistema: null,
          ativo: false,
          criadoEm: new Date(0),
          atualizadoEm: new Date(0),
        },
        oportunidades: orfas.map((o) => porId.get(o.id)!),
      });
    }

    return colunas;
  }

  /** ECOL-19 — dual board: cards de negócio (pré) + cards de pedido (pós). */
  async kanbanEcolume(
    empresaId: string,
    filtros: {
      responsavelId?: string;
      parceiroId?: string;
      periodoDe?: string;
      periodoAte?: string;
      escopo?: 'pre' | 'pos' | 'todos';
      finalizadosDias?: number;
    } = {},
    usuario?: { id: string; perfil: string } | null,
  ) {
    await garantirEtapasEcolume(this.prisma, empresaId);
    if (usuario) {
      const todos = await this.permissoes.veTodosNegocios({
        id: usuario.id,
        empresaId,
        perfil: usuario.perfil,
      });
      if (!todos) filtros = { ...filtros, responsavelId: usuario.id };
    }
    const empCfg = await this.platform.empresa.findUnique({
      where: { id: empresaId },
      select: { configuracoes: true },
    });
    const motivosPerda = motivosPerdaDeConfig(empCfg?.configuracoes);
    const etapasPreDb = await this.prisma.etapaFunil.findMany({
      where: {
        empresaId,
        chaveSistema: { in: [...COLUNAS_PRE_VENDA_ECOLUME] },
        ativo: true,
      },
      select: { id: true, chaveSistema: true },
    });
    const etapasPre: Record<string, string> = {};
    for (const e of etapasPreDb) {
      if (e.chaveSistema) etapasPre[e.chaveSistema] = e.id;
    }
    const escopo = filtros.escopo ?? 'todos';
    const finalizadosDias = filtros.finalizadosDias ?? 30;
    const agora = new Date();
    const corteFinalizados = new Date(agora.getTime() - finalizadosDias * 86_400_000);

    const whereOpp: Prisma.OportunidadeWhereInput = { empresaId };
    if (filtros.responsavelId) whereOpp.responsavelId = filtros.responsavelId;
    if (filtros.parceiroId) whereOpp.parceiroId = filtros.parceiroId;
    if (filtros.periodoDe || filtros.periodoAte) {
      whereOpp.criadoEm = {};
      if (filtros.periodoDe) whereOpp.criadoEm.gte = new Date(filtros.periodoDe);
      if (filtros.periodoAte) whereOpp.criadoEm.lte = new Date(filtros.periodoAte);
    }

    const oportunidades = await this.prisma.oportunidade.findMany({
      where: whereOpp,
      include: {
        ...INCLUDE_PADRAO,
        orcamentos: { select: { id: true, numero: true, status: true, total: true, atualizadoEm: true } },
        pedidos: {
          where: { status: { not: 'CANCELADO' } },
          select: { id: true },
        },
      },
      orderBy: { atualizadoEm: 'desc' },
    });
    const comResp = await this.anexarResponsaveis(oportunidades);

    const wherePed: Prisma.PedidoWhereInput = {
      empresaId,
      status: { not: 'CANCELADO' },
    };
    if (filtros.responsavelId) {
      wherePed.oportunidade = { responsavelId: filtros.responsavelId };
    }
    if (filtros.parceiroId) {
      wherePed.oportunidade = {
        ...(wherePed.oportunidade as object),
        parceiroId: filtros.parceiroId,
      };
    }

    const pedidos = await this.prisma.pedido.findMany({
      where: wherePed,
      include: {
        checklist: true,
        atividades: {
          where: { tipo: 'ENTREGA', concluida: false },
          orderBy: { vencimento: 'asc' },
          take: 1,
          select: { id: true, vencimento: true, periodoDia: true, diaInteiro: true },
        },
        oportunidade: {
          include: {
            contato: { select: { id: true, nome: true, nomeFantasia: true } },
            parceiro: { select: { id: true, nome: true } },
          },
        },
      },
      orderBy: { atualizadoEm: 'desc' },
    });

    const preCols = COLUNAS_PRE_VENDA_ECOLUME.map((chave) => ({
      chave,
      nome: rotuloColuna(chave),
      tipo: 'NEGOCIO' as const,
      cards: [] as Array<Record<string, unknown>>,
    }));
    const posCols = COLUNAS_POS_VENDA_ECOLUME.map((chave) => ({
      chave,
      nome: rotuloColuna(chave),
      tipo: 'PEDIDO' as const,
      cards: [] as Array<Record<string, unknown>>,
    }));
    const prePorChave = new Map<string, (typeof preCols)[number]>(
      preCols.map((c) => [c.chave, c]),
    );
    const posPorChave = new Map<string, (typeof posCols)[number]>(
      posCols.map((c) => [c.chave, c]),
    );

    let totalOrcamentosAbertos = 0;

    if (escopo !== 'pos') {
      for (const op of comResp) {
        const orcs = op.orcamentos ?? [];
        const abertos = orcs.filter((o) => temOrcamentoAberto([o]));
        totalOrcamentosAbertos += abertos.reduce((s, o) => s + (o.total ?? 0), 0);
        const col = colunaPreVendaDe({
          chaveEtapa: op.etapa?.chaveSistema ?? null,
          tipoEtapa: op.etapa?.tipo ?? TipoEtapaFunil.ABERTA,
          orcs,
          temPedidoAtivo: (op.pedidos?.length ?? 0) > 0,
        });
        if (!col) continue;
        const bucket = prePorChave.get(col);
        if (!bucket) continue;
        const abertoRecente = [...abertos].sort(
          (a, b) => new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime(),
        )[0];
        bucket.cards.push({
          tipo: 'NEGOCIO',
          id: op.id,
          codigo: op.codigo,
          titulo: op.titulo,
          clienteNome: op.contato?.nome ?? null,
          parceiroNome: op.parceiro?.nome ?? null,
          valorOrcamentoAberto: abertoRecente?.total ?? null,
          quantidadeOrcamentos: orcs.length,
          responsavel: op.responsavel,
          prioridade: op.prioridade,
          diasParado: diasDesde(op.atualizadoEm, agora),
          etapaId: op.etapaId,
          motivoPerda: op.motivoPerda,
        });
      }
    }

    if (escopo !== 'pre') {
      const respIds = [
        ...new Set(pedidos.map((p) => p.oportunidade?.responsavelId).filter(Boolean) as string[]),
      ];
      const usuarios =
        respIds.length > 0
          ? await this.platform.usuario.findMany({
              where: { id: { in: respIds } },
              select: { id: true, nome: true, email: true },
            })
          : [];
      const respMap = new Map(usuarios.map((u) => [u.id, u]));

      for (const ped of pedidos) {
        const chave = colunaPedidoDe(ped);
        if (!chave) continue;
        if (
          chave === ChaveEtapaSistema.PEDIDO_FINALIZADO &&
          ped.finalizadoEm &&
          ped.finalizadoEm < corteFinalizados &&
          filtros.finalizadosDias !== 0
        ) {
          continue;
        }
        const bucket = posPorChave.get(chave);
        if (!bucket) continue;
        const pendencias = (ped.checklist ?? [])
          .filter((c) => c.aplicavel && !c.concluido)
          .map((c) => ({ tipo: c.tipo, rotulo: c.rotulo }));
        const rid = ped.oportunidade?.responsavelId ?? null;
        const proxEntrega = ped.atividades?.[0] ?? null;
        bucket.cards.push({
          tipo: 'PEDIDO',
          id: ped.id,
          numero: ped.numero,
          oportunidadeId: ped.oportunidadeId,
          negocioCodigo: ped.oportunidade?.codigo ?? null,
          negocioTitulo: ped.oportunidade?.titulo ?? null,
          clienteNome: ped.oportunidade?.contato?.nome ?? null,
          valor: ped.total,
          pendenciasChecklist: pendencias,
          dataEntrega: proxEntrega?.vencimento ?? null,
          entregaAtividadeId: proxEntrega?.id ?? null,
          periodoEntrega: proxEntrega?.periodoDia ?? null,
          responsavel: rid ? respMap.get(rid) ?? null : null,
          faseKanban: ped.faseKanban,
          status: ped.status,
        });
      }
    }

    return {
      modo: 'ecolume' as const,
      preVenda: preCols,
      posVenda: posCols,
      totalOrcamentosAbertos,
      motivosPerda,
      finalizadosDias,
      etapasPre,
    };
  }

  async buscarKanban(empresaId: string, q: string) {
    const termo = q.trim();
    if (!termo) return { tipo: null, oportunidadeId: null, destaque: null };

    const upper = termo.toUpperCase();
    if (await this.permissoes.empresaEcolume(empresaId)) {
      if (/^PED-/i.test(upper) || /^ORC-/i.test(upper) || /^NEG-/i.test(upper)) {
        if (/^PED-/i.test(upper)) {
          const ped = await this.prisma.pedido.findFirst({
            where: { empresaId, numero: { equals: upper, mode: 'insensitive' } },
            select: { id: true, oportunidadeId: true, numero: true },
          });
          if (ped) {
            return {
              tipo: 'PEDIDO',
              oportunidadeId: ped.oportunidadeId,
              destaque: { pedidoId: ped.id, numero: ped.numero },
            };
          }
        }
        if (/^ORC-/i.test(upper)) {
          const orc = await this.prisma.orcamento.findFirst({
            where: { empresaId, numero: { equals: upper, mode: 'insensitive' } },
            select: { id: true, oportunidadeId: true, numero: true },
          });
          if (orc) {
            return {
              tipo: 'ORCAMENTO',
              oportunidadeId: orc.oportunidadeId,
              destaque: { orcamentoId: orc.id, numero: orc.numero },
            };
          }
        }
        if (/^NEG-/i.test(upper)) {
          const neg = await this.prisma.oportunidade.findFirst({
            where: { empresaId, codigo: { equals: upper, mode: 'insensitive' } },
            select: { id: true, codigo: true },
          });
          if (neg) {
            return {
              tipo: 'NEGOCIO',
              oportunidadeId: neg.id,
              destaque: { codigo: neg.codigo },
            };
          }
        }
      }
    }

    const contato = await this.prisma.contato.findFirst({
      where: {
        empresaId,
        OR: [
          { nome: { contains: termo, mode: 'insensitive' } },
          { nomeFantasia: { contains: termo, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    const opp = await this.prisma.oportunidade.findFirst({
      where: {
        empresaId,
        OR: [
          { titulo: { contains: termo, mode: 'insensitive' } },
          { codigo: { contains: termo, mode: 'insensitive' } },
          ...(contato ? [{ contatoId: contato.id }] : []),
          { parceiro: { nome: { contains: termo, mode: 'insensitive' } } },
        ],
      },
      select: { id: true, codigo: true },
      orderBy: { atualizadoEm: 'desc' },
    });
    if (!opp) return { tipo: null, oportunidadeId: null, destaque: null };
    return {
      tipo: 'NEGOCIO',
      oportunidadeId: opp.id,
      destaque: { codigo: opp.codigo },
    };
  }

  private async anexarResponsaveis<T extends { responsavelId?: string | null }>(
    oportunidades: T[],
  ): Promise<Array<T & { responsavel: { id: string; nome: string; email: string } | null }>> {
    const ids = [
      ...new Set(
        oportunidades
          .map((o) => o.responsavelId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (ids.length === 0) {
      return oportunidades.map((o) => ({ ...o, responsavel: null }));
    }
    const usuarios = await this.platform.usuario.findMany({
      where: { id: { in: ids } },
      select: { id: true, nome: true, email: true },
    });
    const porId = new Map(usuarios.map((u) => [u.id, u]));
    return oportunidades.map((o) => ({
      ...o,
      responsavel: o.responsavelId ? porId.get(o.responsavelId) ?? null : null,
    }));
  }

  async obter(
    empresaId: string,
    id: string,
    usuario?: { id: string; perfil: string } | null,
  ) {
    const oportunidade = await this.prisma.oportunidade.findFirst({
      where: { id, empresaId },
      include: INCLUDE_DETALHE,
    });
    if (!oportunidade) {
      throw Erros.naoEncontrado('OPORTUNIDADE_NAO_ENCONTRADA', 'Oportunidade nao encontrada');
    }
    if (usuario) {
      const todos = await this.permissoes.veTodosNegocios({
        id: usuario.id,
        empresaId,
        perfil: usuario.perfil,
      });
      if (!todos && oportunidade.responsavelId !== usuario.id) {
        throw Erros.naoEncontrado('OPORTUNIDADE_NAO_ENCONTRADA', 'Oportunidade nao encontrada');
      }
    }

    // Oportunidades anteriores à timeline: registra a etapa atual como ponto inicial.
    if (oportunidade.historicoEtapas.length === 0) {
      await this.prisma.historicoEtapaOportunidade.create({
        data: {
          empresaId,
          oportunidadeId: id,
          etapaId: oportunidade.etapaId,
          etapaNome: oportunidade.etapa.nome,
          origem: OrigemHistoricoEtapa.CRIACAO,
          criadoEm: oportunidade.criadoEm,
        },
      });
      await this.eventos.registrar(this.prisma, {
        empresaId,
        oportunidadeId: id,
        tipo: TipoEvento.OPORTUNIDADE_CRIADA,
        titulo: 'Oportunidade criada',
        descricao: `Entrada em ${oportunidade.etapa.nome}`,
        origem: OrigemHistoricoEtapa.CRIACAO,
        criadoEm: oportunidade.criadoEm,
      });
      const seed = await this.prisma.oportunidade.findFirstOrThrow({
        where: { id, empresaId },
        include: INCLUDE_DETALHE,
      });
      return this.enriquecerDetalhe(empresaId, seed);
    }

    if (oportunidade.eventos.length === 0) {
      await this.prisma.eventoOportunidade.createMany({
        data: oportunidade.historicoEtapas.map((item, indice) => ({
          empresaId,
          oportunidadeId: id,
          tipo: indice === 0 ? TipoEvento.OPORTUNIDADE_CRIADA : TipoEvento.ETAPA_ALTERADA,
          titulo: item.etapaAnteriorNome
            ? `${item.etapaAnteriorNome} → ${item.etapaNome}`
            : 'Oportunidade criada',
          descricao: item.etapaAnteriorNome ? `Entrada em ${item.etapaNome}` : `Entrada em ${item.etapaNome}`,
          origem: item.origem,
          usuarioId: item.usuarioId,
          criadoEm: item.criadoEm,
        })),
      });
      const atualizada = await this.prisma.oportunidade.findFirstOrThrow({
        where: { id, empresaId },
        include: INCLUDE_DETALHE,
      });
      return this.enriquecerDetalhe(empresaId, atualizada);
    }

    return this.enriquecerDetalhe(empresaId, oportunidade);
  }

  private async enriquecerDetalhe<T extends { id: string; responsavelId?: string | null }>(
    empresaId: string,
    oportunidade: T,
  ) {
    const [comResp] = await this.anexarResponsaveis([oportunidade]);
    const anexos = await this.prisma.arquivo.findMany({
      where: { empresaId, entidade: 'OPORTUNIDADE', entidadeId: oportunidade.id },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        nome: true,
        tipoMime: true,
        tamanho: true,
        criadoEm: true,
        enviadoPorId: true,
      },
    });
    const autores = [
      ...new Set(anexos.map((a) => a.enviadoPorId).filter((x): x is string => Boolean(x))),
    ];
    const usuarios = autores.length
      ? await this.platform.usuario.findMany({
          where: { id: { in: autores }, empresaId },
          select: { id: true, nome: true },
        })
      : [];
    const porId = new Map(usuarios.map((u) => [u.id, u]));
    return this.serializar({
      ...comResp!,
      anexos: anexos.map((a) => ({
        ...a,
        autor: a.enviadoPorId ? porId.get(a.enviadoPorId) ?? null : null,
      })),
    });
  }

  private async proximoCodigo(
    tx: Prisma.TransactionClient,
    empresaId: string,
    prefixo: 'OP' | 'NEG',
  ): Promise<string> {
    const ultima = await tx.oportunidade.findFirst({
      where: { empresaId, codigo: { startsWith: `${prefixo}-` } },
      select: { codigo: true },
      orderBy: { codigo: 'desc' },
    });
    const sequencia = Number(ultima?.codigo.match(/(\d+)$/)?.[1] ?? 0) + 1;
    return `${prefixo}-${String(sequencia).padStart(4, '0')}`;
  }

  private async vincularArquivos(
    tx: Prisma.TransactionClient,
    empresaId: string,
    oportunidadeId: string,
    arquivoIds: string[] | undefined,
  ) {
    if (!arquivoIds?.length) return;
    const arquivos = await tx.arquivo.findMany({
      where: { empresaId, id: { in: arquivoIds } },
      select: { id: true },
    });
    if (arquivos.length !== arquivoIds.length) {
      throw Erros.naoEncontrado('ARQUIVO_NAO_ENCONTRADO', 'Arquivo nao encontrado nesta empresa');
    }
    await tx.arquivo.updateMany({
      where: { empresaId, id: { in: arquivoIds } },
      data: { entidade: 'OPORTUNIDADE', entidadeId: oportunidadeId },
    });
  }

  private async resolverEtapa(
    empresaId: string,
    etapaId?: string | null,
    chaveSistema?: string | null,
  ) {
    if (etapaId) {
      const etapa = await this.prisma.etapaFunil.findFirst({ where: { id: etapaId, empresaId } });
      if (!etapa) throw Erros.naoEncontrado('ETAPA_NAO_ENCONTRADA', 'Etapa nao encontrada');
      return etapa;
    }
    if (chaveSistema) {
      const porChave = await this.prisma.etapaFunil.findFirst({
        where: { empresaId, chaveSistema, ativo: true },
      });
      if (porChave) return porChave;
    }
    const primeira = await this.prisma.etapaFunil.findFirst({
      where: { empresaId, ativo: true, tipo: TipoEtapaFunil.ABERTA },
      orderBy: { ordem: 'asc' },
    });
    if (!primeira) throw Erros.invalido('FUNIL_VAZIO', 'Configure ao menos uma etapa aberta');
    return primeira;
  }

  async criar(
    empresaId: string,
    dto: CriarOportunidadeInput,
    opcoes: OpcoesCriarOportunidade = {},
  ) {
    const ecolume = await this.permissoes.empresaEcolume(empresaId);
    if (ecolume) await garantirEtapasEcolume(this.prisma, empresaId);
    let contatoId = dto.contatoId;

    if (!contatoId && dto.clienteMinimo) {
      if (!ecolume) {
        throw Erros.invalido('CLIENTE_MINIMO_INDISPONIVEL', 'Cadastro minimo so na personalizacao ECOLUME');
      }
      const criado = await this.contatos.criar(empresaId, {
        nome: dto.clienteMinimo.nome,
        telefone: dto.clienteMinimo.telefone,
        email: dto.clienteMinimo.email ?? undefined,
        natureza: dto.clienteMinimo.natureza ?? NaturezaPessoa.PF,
        tipo: TipoContato.OUTRO,
        dadosPersonalizados: {},
      });
      contatoId = criado.id as string;
    }

    if (!contatoId) {
      throw Erros.invalido('CLIENTE_OBRIGATORIO', 'Informe o cliente');
    }

    const contato = await this.prisma.contato.findFirst({
      where: { id: contatoId, empresaId },
    });
    if (!contato) throw Erros.naoEncontrado('CONTATO_NAO_ENCONTRADO', 'Contato nao encontrado');

    let parceiroId: string | null = null;
    let rtNegocio: number | null = null;
    let origemNegocio: OrigemNegocio | null = null;
    let titulo: string;
    let responsavelId = dto.responsavelId ?? opcoes.usuarioId ?? null;

    if (ecolume) {
      if (!dto.origemNegocio) {
        throw Erros.invalido('ORIGEM_NEGOCIO_OBRIGATORIA', 'Informe a origem do negocio');
      }
      origemNegocio = dto.origemNegocio;
      if (origemNegocio === OrigemNegocio.VIA_PARCEIRO) {
        if (!dto.parceiroId) {
          throw Erros.invalido('PARCEIRO_OBRIGATORIO', 'Informe o parceiro');
        }
        const parceiro = await this.prisma.contato.findFirst({
          where: { id: dto.parceiroId, empresaId, ehParceiro: true },
        });
        if (!parceiro) {
          throw Erros.naoEncontrado('PARCEIRO_NAO_ENCONTRADO', 'Parceiro nao encontrado nesta empresa');
        }
        parceiroId = parceiro.id;
        rtNegocio =
          dto.rtNegocio != null
            ? Number(dto.rtNegocio)
            : parceiro.rtPadrao != null
              ? Number(parceiro.rtPadrao)
              : null;
      } else if (dto.parceiroId) {
        throw Erros.invalido('PARCEIRO_NAO_PERMITIDO', 'Origem direta nao aceita parceiro');
      }
      const nomeSugestao = `${contato.nome} — Projeto`;
      titulo = dto.titulo?.trim() || nomeSugestao;
      if (!responsavelId) {
        throw Erros.invalido('RESPONSAVEL_OBRIGATORIO', 'Informe o responsavel');
      }
      const resp = await this.platform.usuario.findFirst({
        where: { id: responsavelId, empresaId },
        select: { id: true },
      });
      if (!resp) throw Erros.naoEncontrado('USUARIO_NAO_ENCONTRADO', 'Responsavel nao encontrado');
    } else {
      titulo = ''; // preenchido com codigo abaixo
    }

    const etapa = await this.resolverEtapa(
      empresaId,
      dto.etapaId,
      opcoes.chaveSistemaEtapa ?? (ecolume ? ChaveEtapaSistema.NOVO_CONTATO : undefined),
    );
    const dadosPersonalizados = await this.campos.validarPara(
      empresaId,
      EntidadeCampoPersonalizado.OPORTUNIDADE,
      dto.dadosPersonalizados,
    );
    const origemHistorico = opcoes.origemHistorico ?? OrigemHistoricoEtapa.CRIACAO;

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`${empresaId}:oportunidade-codigo`}))
      `;
      const codigo = await this.proximoCodigo(tx, empresaId, ecolume ? 'NEG' : 'OP');
      if (!ecolume) titulo = codigo;

      const criada = await tx.oportunidade.create({
        data: {
          empresaId,
          codigo,
          titulo,
          contatoId,
          obraId: dto.obraId ?? null,
          categoriaId: dto.categoriaId ?? null,
          etapaId: etapa.id,
          responsavelId,
          descricao: dto.descricao ?? null,
          origem: dto.origem ?? null,
          prioridade: dto.prioridade,
          valorEstimado: dto.valorEstimado ?? null,
          previsaoFechamento: dto.previsaoFechamento ?? null,
          proximaAcao: dto.proximaAcao ?? null,
          dataProximaAcao: dto.dataProximaAcao ?? null,
          codigoOrcamento: dto.codigoOrcamento ?? null,
          dadosPersonalizados: dadosPersonalizados as object,
          origemNegocio,
          parceiroId,
          rtNegocio: rtNegocio == null ? null : new Prisma.Decimal(rtNegocio),
          obraCep: ecolume ? dto.obraCep?.replace(/\D/g, '') || null : null,
          obraLogradouro: ecolume ? dto.obraLogradouro?.trim() || null : null,
          obraNumero: ecolume ? dto.obraNumero?.trim() || null : null,
          obraComplemento: ecolume ? dto.obraComplemento?.trim() || null : null,
          obraBairro: ecolume ? dto.obraBairro?.trim() || null : null,
          obraCidade: ecolume ? dto.obraCidade?.trim() || null : null,
          obraUf: ecolume ? dto.obraUf?.trim().toUpperCase() || null : null,
        },
        include: INCLUDE_PADRAO,
      });

      await this.vincularArquivos(tx, empresaId, criada.id, dto.arquivoIds);

      await tx.historicoEtapaOportunidade.create({
        data: {
          empresaId,
          oportunidadeId: criada.id,
          etapaId: etapa.id,
          etapaNome: etapa.nome,
          origem: origemHistorico,
          usuarioId: opcoes.usuarioId ?? null,
        },
      });

      await this.eventos.registrar(tx, {
        empresaId,
        oportunidadeId: criada.id,
        tipo: TipoEvento.OPORTUNIDADE_CRIADA,
        titulo: ecolume ? 'Negocio criado' : 'Oportunidade criada',
        descricao: `Entrada em ${etapa.nome}`,
        origem: origemHistorico,
        usuarioId: opcoes.usuarioId,
      });

      return this.serializar(criada);
    });
  }

  async atualizar(empresaId: string, id: string, dto: AtualizarOportunidadeInput) {
    const atual = await this.obter(empresaId, id);
    const ecolume = await this.permissoes.empresaEcolume(empresaId);

    const data: Prisma.OportunidadeUpdateInput = {
      titulo: ecolume
        ? dto.titulo === undefined
          ? undefined
          : dto.titulo.trim()
        : dto.titulo === undefined
          ? undefined
          : atual.codigo,
      descricao: dto.descricao,
      origem: dto.origem,
      prioridade: dto.prioridade,
      valorEstimado: dto.valorEstimado,
      previsaoFechamento: dto.previsaoFechamento,
      proximaAcao: dto.proximaAcao,
      dataProximaAcao: dto.dataProximaAcao,
      codigoOrcamento: dto.codigoOrcamento,
      motivoPerda: dto.motivoPerda,
    };

    if (dto.contatoId) {
      const contato = await this.prisma.contato.findFirst({
        where: { id: dto.contatoId, empresaId },
      });
      if (!contato) throw Erros.naoEncontrado('CONTATO_NAO_ENCONTRADO', 'Contato nao encontrado');
      data.contato = { connect: { id: dto.contatoId } };
    }
    if (dto.obraId !== undefined) {
      data.obra = dto.obraId ? { connect: { id: dto.obraId } } : { disconnect: true };
    }
    if (dto.categoriaId !== undefined) {
      data.categoria = dto.categoriaId ? { connect: { id: dto.categoriaId } } : { disconnect: true };
    }
    if (dto.responsavelId !== undefined) {
      if (ecolume && !dto.responsavelId) {
        throw Erros.invalido('RESPONSAVEL_OBRIGATORIO', 'Informe o responsavel');
      }
      data.responsavelId = dto.responsavelId;
    }

    if (ecolume) {
      if (dto.origemNegocio !== undefined) {
        data.origemNegocio = dto.origemNegocio;
        const origem = dto.origemNegocio ?? (atual as { origemNegocio?: OrigemNegocio | null }).origemNegocio;
        if (origem === OrigemNegocio.VIA_PARCEIRO) {
          const pid = dto.parceiroId ?? (atual as { parceiroId?: string | null }).parceiroId;
          if (!pid) throw Erros.invalido('PARCEIRO_OBRIGATORIO', 'Informe o parceiro');
        } else if (origem === OrigemNegocio.CLIENTE_DIRETO) {
          data.parceiro = { disconnect: true };
        }
      }
      if (dto.parceiroId !== undefined) {
        if (dto.parceiroId) {
          const parceiro = await this.prisma.contato.findFirst({
            where: { id: dto.parceiroId, empresaId, ehParceiro: true },
          });
          if (!parceiro) {
            throw Erros.naoEncontrado('PARCEIRO_NAO_ENCONTRADO', 'Parceiro nao encontrado nesta empresa');
          }
          data.parceiro = { connect: { id: dto.parceiroId } };
          if (dto.rtNegocio === undefined && (atual as { rtNegocio?: number | null }).rtNegocio == null) {
            data.rtNegocio =
              parceiro.rtPadrao != null ? new Prisma.Decimal(Number(parceiro.rtPadrao)) : null;
          }
        } else {
          data.parceiro = { disconnect: true };
        }
      }
      if (dto.rtNegocio !== undefined) {
        data.rtNegocio = dto.rtNegocio == null ? null : new Prisma.Decimal(Number(dto.rtNegocio));
      }
      if (dto.obraCep !== undefined) data.obraCep = dto.obraCep?.replace(/\D/g, '') || null;
      if (dto.obraLogradouro !== undefined) data.obraLogradouro = dto.obraLogradouro?.trim() || null;
      if (dto.obraNumero !== undefined) data.obraNumero = dto.obraNumero?.trim() || null;
      if (dto.obraComplemento !== undefined) data.obraComplemento = dto.obraComplemento?.trim() || null;
      if (dto.obraBairro !== undefined) data.obraBairro = dto.obraBairro?.trim() || null;
      if (dto.obraCidade !== undefined) data.obraCidade = dto.obraCidade?.trim() || null;
      if (dto.obraUf !== undefined) data.obraUf = dto.obraUf?.trim().toUpperCase() || null;
      if (dto.arquivoIds !== undefined) {
        await this.prisma.$transaction(async (tx) => {
          await this.vincularArquivos(tx, empresaId, id, dto.arquivoIds);
        });
      }
    }

    if (dto.dadosPersonalizados !== undefined) {
      data.dadosPersonalizados = (await this.campos.validarPara(
        empresaId,
        EntidadeCampoPersonalizado.OPORTUNIDADE,
        dto.dadosPersonalizados,
      )) as object;
    }

    const atualizado = await this.prisma.oportunidade.update({
      where: { id },
      data,
      include: INCLUDE_PADRAO,
    });
    return this.serializar(atualizado);
  }

  /** Marca um ajuste (ou todos, se sem id) como feito. */
  async marcarAjusteCorrigido(
    empresaId: string,
    id: string,
    usuarioId?: string,
    ajusteId?: string,
  ) {
    const atual = await this.prisma.oportunidade.findFirst({ where: { id, empresaId } });
    if (!atual) {
      throw Erros.naoEncontrado('OPORTUNIDADE_NAO_ENCONTRADA', 'Oportunidade nao encontrada');
    }

    const atuais = { ...((atual.dadosPersonalizados ?? {}) as Record<string, unknown>) };
    const ajustes = lerAjustes(atuais, atual.descricao);
    const marcados: typeof ajustes = [];

    if (ajusteId) {
      const indiceLegado = ajusteId.startsWith('legado-') ? Number(ajusteId.slice(7)) : Number.NaN;
      const item =
        ajustes.find((ajuste) => ajuste.id === ajusteId) ??
        (Number.isInteger(indiceLegado) ? ajustes[indiceLegado] : undefined);
      if (!item) {
        throw Erros.naoEncontrado('AJUSTE_NAO_ENCONTRADO', 'Pedido de ajuste nao encontrado');
      }
      item.status = 'corrigido';
      marcados.push(item);
    } else {
      for (const item of ajustes) {
        if (item.status !== 'corrigido') marcados.push(item);
        item.status = 'corrigido';
      }
    }

    const dados = persistirAjustes(atuais, ajustes);

    await this.prisma.$transaction(async (tx) => {
      await tx.oportunidade.update({
        where: { id },
        data: { dadosPersonalizados: dados as object },
      });

      if (!ajusteId) {
        await tx.atividade.updateMany({
          where: {
            empresaId,
            oportunidadeId: id,
            tipo: TipoAtividade.REVISAR_ORCAMENTO,
            concluida: false,
          },
          data: { concluida: true, concluidaEm: new Date() },
        });
      } else {
        for (const item of marcados) {
          const porTexto = await tx.atividade.updateMany({
            where: {
              empresaId,
              oportunidadeId: id,
              tipo: TipoAtividade.REVISAR_ORCAMENTO,
              concluida: false,
              descricao: item.texto,
            },
            data: { concluida: true, concluidaEm: new Date() },
          });
          if (porTexto.count > 0) continue;
          const tarefa = await tx.atividade.findFirst({
            where: {
              empresaId,
              oportunidadeId: id,
              tipo: TipoAtividade.REVISAR_ORCAMENTO,
              concluida: false,
            },
            orderBy: { criadoEm: 'asc' },
          });
          if (tarefa) {
            await tx.atividade.update({
              where: { id: tarefa.id },
              data: { concluida: true, concluidaEm: new Date() },
            });
          }
        }
      }
    });

    await this.eventos.registrar(this.prisma, {
      empresaId,
      oportunidadeId: id,
      tipo: TipoEvento.AJUSTE_CORRIGIDO,
      titulo: marcados.length > 1 ? 'Ajustes de orçamento corrigidos' : 'Ajuste de orçamento corrigido',
      descricao:
        marcados.length === 1
          ? marcados[0]!.texto
          : 'O time marcou os pedidos de ajuste como feitos.',
      origem: OrigemHistoricoEtapa.MANUAL,
      usuarioId,
    });
    await this.eventos.sincronizarProximaAcao(empresaId, id);
    return this.obter(empresaId, id);
  }

  async mover(
    empresaId: string,
    id: string,
    dto: MoverInput,
    opcoes: OpcoesMoverOportunidade = {},
  ) {
    const atual = await this.prisma.oportunidade.findFirst({
      where: { id, empresaId },
      include: { etapa: true },
    });
    if (!atual) {
      throw Erros.naoEncontrado('OPORTUNIDADE_NAO_ENCONTRADA', 'Oportunidade nao encontrada');
    }

    if (atual.etapaId === dto.etapaId) {
      return this.obter(empresaId, id);
    }

    const ecolume = await this.permissoes.empresaEcolume(empresaId);
    if (ecolume) await garantirEtapasEcolume(this.prisma, empresaId);

    const destino = await this.prisma.etapaFunil.findFirst({
      where: { id: dto.etapaId, empresaId },
    });

    let motivoResolvido = dto.motivoPerda ?? null;
    if (ecolume && destino?.tipo === TipoEtapaFunil.PERDIDA) {
      const empCfg = await this.platform.empresa.findUnique({
        where: { id: empresaId },
        select: { configuracoes: true },
      });
      const catalogo = motivosPerdaDeConfig(empCfg?.configuracoes);
      const r = resolverMotivoPerda(
        {
          codigoMotivoPerda: dto.codigoMotivoPerda,
          motivoPerda: dto.motivoPerda,
        },
        catalogo,
      );
      if ('erro' in r) throw Erros.invalido('MOTIVO_PERDA_INVALIDO', r.erro);
      motivoResolvido = r.motivo;
    }

    const transicao = avaliarTransicaoEtapa(
      destino ? { id: destino.id, tipo: destino.tipo, ativo: destino.ativo } : null,
      motivoResolvido,
    );

    if (!transicao.permitido || !destino) {
      throw Erros.invalido('TRANSICAO_INVALIDA', transicao.erro ?? 'Transicao invalida');
    }

    if (ecolume && destino.chaveSistema) {
      const pre = new Set<string>([
        ChaveEtapaSistema.NOVO_CONTATO,
        ChaveEtapaSistema.ORCAMENTO_EM_ABERTO,
        ChaveEtapaSistema.PERDIDO,
        ChaveEtapaSistema.QUALIFICACAO,
      ]);
      if (!pre.has(destino.chaveSistema)) {
        throw Erros.invalido(
          'TRANSICAO_INVALIDA',
          'Movimente pedidos pelas colunas pos-venda',
        );
      }
    }

    const origem = opcoes.origem ?? OrigemHistoricoEtapa.MANUAL;

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`${empresaId}:opp-mover:${id}`}))
      `;

      await tx.oportunidade.update({
        where: { id },
        data: {
          etapaId: dto.etapaId,
          fechadaEm: transicao.fechadaEm,
          motivoPerda: transicao.motivoPerda,
        },
      });

      await tx.historicoEtapaOportunidade.create({
        data: {
          empresaId,
          oportunidadeId: id,
          etapaId: destino.id,
          etapaNome: destino.nome,
          etapaAnteriorId: atual.etapaId,
          etapaAnteriorNome: atual.etapa.nome,
          origem,
          usuarioId: opcoes.usuarioId ?? null,
        },
      });

      await this.eventos.registrar(tx, {
        empresaId,
        oportunidadeId: id,
        tipo: TipoEvento.ETAPA_ALTERADA,
        titulo: `${atual.etapa.nome} → ${destino.nome}`,
        descricao:
          origem === OrigemHistoricoEtapa.MANUAL
            ? 'Etapa corrigida manualmente'
            : 'Progresso atualizado automaticamente',
        origem,
        usuarioId: opcoes.usuarioId,
        dados: { etapaAnteriorId: atual.etapaId, etapaId: destino.id },
      });

      // Legado: GANHA converte/baixa. ECOLUME: conversão só pela ECOL-17.
      if (!ecolume && destino.tipo === TipoEtapaFunil.GANHA) {
        const candidatos = [
          StatusOrcamento.ENVIADO,
          StatusOrcamento.ACEITO,
          StatusOrcamento.RASCUNHO,
        ] as const;

        const jaConvertido = await tx.orcamento.findFirst({
          where: {
            empresaId,
            oportunidadeId: id,
            status: StatusOrcamento.CONVERTIDO,
          },
        });

        let final = jaConvertido
          ? null
          : await tx.orcamento.findFirst({
              where: {
                empresaId,
                oportunidadeId: id,
                vigente: true,
                status: { in: [...candidatos] },
              },
              include: { itens: { select: { id: true } } },
            });

        if (!jaConvertido && (!final || final.itens.length === 0)) {
          final = await tx.orcamento.findFirst({
            where: {
              empresaId,
              oportunidadeId: id,
              status: { in: [...candidatos] },
              itens: { some: {} },
            },
            orderBy: [{ atualizadoEm: 'desc' }, { versao: 'desc' }],
            include: { itens: { select: { id: true } } },
          });
        }

        if (!jaConvertido && final && final.itens.length > 0) {
          await this.produtos.baixarPorOrcamento(
            tx,
            empresaId,
            final.id,
            id,
            opcoes.usuarioId,
          );
          await tx.orcamento.updateMany({
            where: { oportunidadeId: id, empresaId, vigente: true, id: { not: final.id } },
            data: { vigente: false },
          });
          await tx.orcamento.update({
            where: { id: final.id },
            data: {
              status: StatusOrcamento.CONVERTIDO,
              vigente: true,
              convertidoEm: new Date(),
            },
          });
          await this.eventos.registrar(tx, {
            empresaId,
            oportunidadeId: id,
            tipo: TipoEvento.ESTOQUE_BAIXADO,
            titulo: 'Estoque baixado pelo orçamento final',
            descricao: `Baixa automática do orçamento ${final.numero} (último montado; WhatsApp opcional).`,
            origem,
            usuarioId: opcoes.usuarioId,
            dados: { orcamentoId: final.id },
          });
        }
      }

      if (destino.tipo === TipoEtapaFunil.PERDIDA) {
        if (ecolume) {
          // ECOL-19: ORCs abertos → RECUSADO; pedidos existentes permanecem.
          await tx.orcamento.updateMany({
            where: {
              empresaId,
              oportunidadeId: id,
              status: {
                in: [
                  StatusOrcamento.ENVIADO,
                  StatusOrcamento.ACEITO,
                  StatusOrcamento.RASCUNHO,
                ],
              },
            },
            data: { status: StatusOrcamento.RECUSADO, vigente: false },
          });
        } else {
          await tx.orcamento.updateMany({
            where: {
              empresaId,
              oportunidadeId: id,
              vigente: true,
              status: {
                in: [StatusOrcamento.ENVIADO, StatusOrcamento.ACEITO, StatusOrcamento.RASCUNHO],
              },
            },
            data: { status: StatusOrcamento.CANCELADO, vigente: false },
          });
        }
      }

      return tx.oportunidade.findFirstOrThrow({
        where: { id, empresaId },
        include: INCLUDE_DETALHE,
      });
    });
  }

  /**
   * Avança para a etapa com a chaveSistema dada, apenas se a ordem atual for menor
   * (não regride). Retorna null se não houver mudança.
   */
  async moverPorChave(
    empresaId: string,
    oportunidadeId: string,
    chaveSistema: string,
    origem: OrigemHistoricoEtapa,
    usuarioId?: string | null,
  ) {
    const destino = await this.prisma.etapaFunil.findFirst({
      where: { empresaId, chaveSistema, ativo: true },
    });
    if (!destino) return null;

    const atual = await this.prisma.oportunidade.findFirst({
      where: { id: oportunidadeId, empresaId },
      include: { etapa: true },
    });
    if (!atual) return null;
    if (atual.etapaId === destino.id) return null;
    if (atual.etapa.ordem >= destino.ordem) return null;

    return this.mover(
      empresaId,
      oportunidadeId,
      { etapaId: destino.id },
      { origem, usuarioId },
    );
  }

  async remover(empresaId: string, id: string) {
    await this.obter(empresaId, id);
    await this.prisma.oportunidade.delete({ where: { id } });
    return { ok: true };
  }
}
