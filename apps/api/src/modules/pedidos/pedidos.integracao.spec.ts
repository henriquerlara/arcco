import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  ChaveEtapaSistema,
  NaturezaPessoa,
  OrigemNegocio,
  PerfilUsuario,
  PrioridadeOportunidade,
  StatusOrcamento,
  TipoContato,
} from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';
import { ContatosService } from '../contatos/contatos.service';
import { EventosService } from '../eventos/eventos.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ProdutosService } from '../produtos/produtos.service';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { OrcamentosService } from '../orcamentos/orcamentos.service';
import { PedidosService } from './pedidos.service';

const ATIVO =
  process.env.ECOL_PEDIDO === '1' ||
  process.env.ECOL_ORCAMENTO === '1' ||
  process.env.ECOL_NEGOCIO === '1';

const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('ECOL-16 Pedidos no banco', () => {
  const auditoria = new AuditoriaService(platform as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const campos = new CamposPersonalizadosService(operacional as never);
  const contatos = new ContatosService(
    operacional as never,
    platform as never,
    campos,
    permissoes,
  );
  const eventos = new EventosService(operacional as never);
  const produtos = new ProdutosService(operacional as never, auditoria, permissoes);
  const negocios = new OportunidadesService(
    operacional as never,
    platform as never,
    campos,
    eventos,
    produtos,
    permissoes,
    contatos,
  );
  const orcamentos = new OrcamentosService(
    operacional as never,
    platform as never,
    { enviar: async () => ({ id: 'arq' }) } as never,
    produtos,
    permissoes,
    {} as never,
  );
  const pedidos = new PedidosService(operacional as never, permissoes, produtos, auditoria);

  let ecolumeId = '';
  let padraoId = '';
  let usuarioId = '';
  let oppId = '';

  beforeAll(async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `PED16 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `PED16P ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { onboardingConcluido: true },
      },
    });
    empresas.push(ecolume.id, padrao.id);
    ecolumeId = ecolume.id;
    padraoId = padrao.id;

    const user = await platform.usuario.create({
      data: {
        empresaId: ecolumeId,
        nome: `User ${sufixo}`,
        email: `ped16-${sufixo}@teste.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    usuarioId = user.id;

    for (const empresaId of [ecolumeId, padraoId]) {
      const existe = await operacional.etapaFunil.findFirst({
        where: { empresaId, chaveSistema: ChaveEtapaSistema.NOVO_CONTATO },
      });
      if (!existe) {
        await operacional.etapaFunil.create({
          data: {
            empresaId,
            nome: 'Novo contato',
            ordem: 1,
            tipo: 'ABERTA',
            chaveSistema: ChaveEtapaSistema.NOVO_CONTATO,
            ativo: true,
          },
        });
      }
    }

    const cliente = await contatos.criar(ecolumeId, {
      nome: `Cliente PED ${sufixo}`,
      telefone: '11970003001',
      natureza: NaturezaPessoa.PF,
      tipo: TipoContato.OUTRO,
      dadosPersonalizados: {},
    });
    const neg = await negocios.criar(
      ecolumeId,
      {
        contatoId: cliente.id as string,
        titulo: `Neg PED ${sufixo}`,
        origemNegocio: OrigemNegocio.CLIENTE_DIRETO,
        responsavelId: usuarioId,
        prioridade: PrioridadeOportunidade.MEDIA,
        dadosPersonalizados: {},
      },
      { usuarioId },
    );
    oppId = neg.id as string;
  }, 60_000);

  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.itemPedido.deleteMany({
        where: { pedido: { empresaId } },
      }).catch(() => undefined);
      await operacional.pedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.itemOrcamento.deleteMany({
        where: { orcamento: { empresaId } },
      }).catch(() => undefined);
      await operacional.orcamento.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.oportunidade.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.contato.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.etapaFunil.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.usuario.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  }, 60_000);

  it('concorrência PED, 1:1 orçamento, dois PED no negócio, sem CONVERTIDO/estoque', async () => {
    const o1 = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: oppId,
      descontoValor: 0,
      itens: [
        {
          nome: 'Linha A',
          quantidade: 2,
          precoUnitario: 50,
          unidade: 'un',
          precoManual: true,
        },
      ],
    });
    const o2 = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: oppId,
      descontoValor: 5,
      itens: [
        {
          nome: 'Avulso B',
          quantidade: 1,
          precoUnitario: 30,
          unidade: 'un',
          precoManual: true,
        },
      ],
    });

    const [p1a, p1b] = await Promise.allSettled([
      pedidos.criarEstruturaAPartirDeOrcamento(ecolumeId, o1.id, usuarioId),
      pedidos.criarEstruturaAPartirDeOrcamento(ecolumeId, o1.id, usuarioId),
    ]);
    const ok = [p1a, p1b].filter((r) => r.status === 'fulfilled');
    const falha = [p1a, p1b].filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(falha).toHaveLength(1);
    if (falha[0]!.status === 'rejected') {
      expect((falha[0]!.reason as { codigo?: string }).codigo).toBe('ORCAMENTO_JA_TEM_PEDIDO');
    }
    const ped1 = ok[0]!.status === 'fulfilled' ? ok[0]!.value : null;
    expect(ped1?.numero).toMatch(/^PED-\d{4}$/);
    expect(ped1?.itens[0]!.nome).toBe('Linha A');
    expect(ped1?.itens[0]!.totalLinha).toBe(100);

    const ped2 = await pedidos.criarEstruturaAPartirDeOrcamento(ecolumeId, o2.id, usuarioId);
    expect(ped2.numero).toMatch(/^PED-\d{4}$/);
    expect(ped2.numero).not.toBe(ped1!.numero);
    expect(ped2.itens[0]!.produtoId).toBeNull();
    expect(ped2.itens[0]!.nome).toBe('Avulso B');
    expect(ped2.descontoValor).toBe(5);

    const orc1 = await operacional.orcamento.findFirstOrThrow({ where: { id: o1.id } });
    expect(orc1.status).toBe(StatusOrcamento.RASCUNHO);
    const movs = await operacional.movimentacaoEstoque.count({
      where: { empresaId: ecolumeId, orcamentoId: o1.id },
    });
    expect(movs).toBe(0);

    await expect(
      pedidos.criarEstruturaAPartirDeOrcamento(padraoId, o1.id, usuarioId),
    ).rejects.toMatchObject({ codigo: 'PEDIDO_INDISPONIVEL' });
  }, 30_000);
});
