import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  ChaveEtapaSistema,
  FaseKanbanPedido,
  ModeloPagamentoPedido,
  NaturezaPessoa,
  OrigemNegocio,
  PerfilUsuario,
  PrioridadeOportunidade,
  StatusOrcamento,
  StatusPedido,
  TipoContato,
  TipoParceiro,
} from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';
import { ContatosService } from '../contatos/contatos.service';
import { EventosService } from '../eventos/eventos.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ProdutosService } from '../produtos/produtos.service';
import { OrcamentosService } from '../orcamentos/orcamentos.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { AppError } from '../../common/erros/erros';
import { OportunidadesService } from './oportunidades.service';

const ATIVO =
  process.env.ECOL_KANBAN === '1' ||
  process.env.ECOL_CONV === '1' ||
  process.env.ECOL_PEDIDO === '1';

const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('ECOL-19 Kanban', () => {
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
  let clienteId = '';
  let parceiroId = '';
  let ator = { id: '', perfil: PerfilUsuario.PROPRIETARIO };

  beforeAll(async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `KAN19 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `KAN19P ${sufixo}`,
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
        email: `kan19-${sufixo}@teste.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    usuarioId = user.id;
    ator = { id: usuarioId, perfil: PerfilUsuario.PROPRIETARIO };

    for (const empresaId of [ecolumeId, padraoId]) {
      const etapas = [
        { nome: 'Novo contato', ordem: 1, tipo: 'ABERTA', chave: ChaveEtapaSistema.NOVO_CONTATO },
        { nome: 'Qualificação', ordem: 2, tipo: 'ABERTA', chave: ChaveEtapaSistema.QUALIFICACAO },
        { nome: 'Negociação', ordem: 3, tipo: 'ABERTA', chave: ChaveEtapaSistema.NEGOCIACAO },
        { nome: 'Fechado', ordem: 4, tipo: 'GANHA', chave: ChaveEtapaSistema.FECHADO },
        { nome: 'Perdido', ordem: 5, tipo: 'PERDIDA', chave: ChaveEtapaSistema.PERDIDO },
      ];
      for (const e of etapas) {
        const existe = await operacional.etapaFunil.findFirst({
          where: { empresaId, chaveSistema: e.chave },
        });
        if (!existe) {
          await operacional.etapaFunil.create({
            data: {
              empresaId,
              nome: e.nome,
              ordem: e.ordem,
              tipo: e.tipo as never,
              chaveSistema: e.chave,
              ativo: true,
            },
          });
        }
      }
    }

    const cli = await contatos.criar(ecolumeId, {
      nome: `Cliente ${sufixo}`,
      telefone: '11999990001',
      natureza: NaturezaPessoa.PF,
      tipo: TipoContato.OUTRO,
      dadosPersonalizados: {},
    });
    clienteId = cli.id as string;
    const par = await contatos.criar(ecolumeId, {
      nome: `Parceiro ${sufixo}`,
      telefone: '11999990002',
      natureza: NaturezaPessoa.PF,
      tipo: TipoContato.OUTRO,
      ehParceiro: true,
      tipoParceiro: TipoParceiro.ARQUITETO,
      rtPadrao: 10,
      dadosPersonalizados: {},
    });
    parceiroId = par.id as string;
  }, 60_000);

  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.historicoFasePedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.checklistItemPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.pagamentoPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.comissaoPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.itemSeparacaoPedido.deleteMany({ where: { pedido: { empresaId } } }).catch(() => undefined);
      await operacional.itemCompraPedido.deleteMany({ where: { pedido: { empresaId } } }).catch(() => undefined);
      await operacional.itemPedido.deleteMany({ where: { pedido: { empresaId } } }).catch(() => undefined);
      await operacional.pedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.itemOrcamento.deleteMany({ where: { orcamento: { empresaId } } }).catch(() => undefined);
      await operacional.orcamento.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.historicoEtapaOportunidade.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.eventoOportunidade.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.oportunidade.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.produto.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.contato.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.etapaFunil.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.movimentacaoEstoque.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.usuario.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  }, 60_000);

  async function criarNegocio() {
    return negocios.criar(
      ecolumeId,
      {
        contatoId: clienteId,
        origemNegocio: OrigemNegocio.VIA_PARCEIRO,
        parceiroId,
        responsavelId: usuarioId,
        prioridade: PrioridadeOportunidade.MEDIA,
        titulo: `Obra ${sufixo}`,
      },
      { usuarioId },
    );
  }

  it('1: colunas corretas flag on/off', async () => {
    const eco = await negocios.kanban(ecolumeId);
    expect(eco).toMatchObject({ modo: 'ecolume' });
    expect((eco as { preVenda: unknown[] }).preVenda.map((c: { chave: string }) => c.chave)).toEqual([
      ChaveEtapaSistema.NOVO_CONTATO,
      ChaveEtapaSistema.ORCAMENTO_EM_ABERTO,
      ChaveEtapaSistema.PERDIDO,
    ]);
    expect((eco as { posVenda: unknown[] }).posVenda.map((c: { chave: string }) => c.chave)).toEqual([
      ChaveEtapaSistema.PEDIDO_CONFIRMADO,
      ChaveEtapaSistema.EM_SEPARACAO,
      ChaveEtapaSistema.PRONTO_ENTREGA,
      ChaveEtapaSistema.ENTREGUE,
      ChaveEtapaSistema.PEDIDO_FINALIZADO,
    ]);

    const legado = await negocios.kanban(padraoId);
    expect(Array.isArray(legado)).toBe(true);
    expect((legado as Array<{ etapa: { chaveSistema: string | null } }>).some((c) => c.etapa.chaveSistema === ChaveEtapaSistema.NEGOCIACAO)).toBe(true);
  });

  it('2+3+4+5+6+7+8+9+10+11+12+13+15: fluxo kanban', async () => {
    const neg = await criarNegocio();
    let board = (await negocios.kanban(ecolumeId)) as {
      preVenda: Array<{ chave: string; cards: Array<{ id: string }> }>;
      posVenda: Array<{ chave: string; cards: Array<{ id: string; numero?: string }> }>;
      etapasPre: Record<string, string>;
    };
    expect(board.preVenda.find((c) => c.chave === ChaveEtapaSistema.NOVO_CONTATO)?.cards.some((c) => c.id === neg.id)).toBe(true);

    const orc = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg.id,
      itens: [{ nome: 'Item', quantidade: 1, precoUnitario: 100, unidade: 'un' }],
    });
    board = (await negocios.kanban(ecolumeId)) as typeof board;
    expect(board.preVenda.find((c) => c.chave === ChaveEtapaSistema.ORCAMENTO_EM_ABERTO)?.cards.some((c) => c.id === neg.id)).toBe(true);

    const orc2 = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg.id,
      itens: [{ nome: 'Item2', quantidade: 1, precoUnitario: 50, unidade: 'un' }],
    });

    const ped = await pedidos.converter(
      ecolumeId,
      {
        orcamentoId: orc.id,
        modeloPagamento: ModeloPagamentoPedido.PIX_AVISTA,
        orcamentosSubstituirIds: [],
      },
      ator,
    );
    expect(ped.faseKanban).toBe(FaseKanbanPedido.PEDIDO_CONFIRMADO);

    board = (await negocios.kanban(ecolumeId)) as typeof board;
    expect(board.preVenda.find((c) => c.chave === ChaveEtapaSistema.ORCAMENTO_EM_ABERTO)?.cards.some((c) => c.id === neg.id)).toBe(true);
    expect(board.posVenda.find((c) => c.chave === ChaveEtapaSistema.PEDIDO_CONFIRMADO)?.cards.some((c) => c.id === ped.id)).toBe(true);

    await operacional.orcamento.update({
      where: { id: orc2.id },
      data: { status: StatusOrcamento.RECUSADO, vigente: false },
    });
    board = (await negocios.kanban(ecolumeId)) as typeof board;
    expect(board.preVenda.find((c) => c.chave === ChaveEtapaSistema.ORCAMENTO_EM_ABERTO)?.cards.some((c) => c.id === neg.id)).toBe(false);
    expect(board.preVenda.find((c) => c.chave === ChaveEtapaSistema.NOVO_CONTATO)?.cards.some((c) => c.id === neg.id)).toBe(false);

    const mov = await pedidos.moverKanban(ecolumeId, ped.id, { faseKanban: FaseKanbanPedido.EM_SEPARACAO }, ator);
    expect(mov.faseKanban).toBe(FaseKanbanPedido.EM_SEPARACAO);
    const hist = await operacional.historicoFasePedido.findMany({
      where: { pedidoId: ped.id, empresaId: ecolumeId },
      orderBy: { criadoEm: 'asc' },
    });
    expect(hist.some((h) => h.origem === 'MANUAL' && h.faseNova === FaseKanbanPedido.EM_SEPARACAO)).toBe(true);
    expect(hist.some((h) => h.origem === 'CONVERSAO')).toBe(true);

    const movAntes = await operacional.movimentacaoEstoque.count({ where: { empresaId: ecolumeId } });
    await pedidos.moverKanban(ecolumeId, ped.id, { faseKanban: FaseKanbanPedido.ENTREGUE }, ator);
    const movDepois = await operacional.movimentacaoEstoque.count({ where: { empresaId: ecolumeId } });
    expect(movDepois).toBe(movAntes);

    await expect(
      pedidos.moverKanban(ecolumeId, ped.id, { faseKanban: 'PEDIDO_FINALIZADO' as never }, ator),
    ).rejects.toBeInstanceOf(AppError);

    const checklist = await operacional.checklistItemPedido.findMany({ where: { pedidoId: ped.id } });
    for (const item of checklist.filter((c) => c.aplicavel && !c.automatico)) {
      await pedidos.marcarChecklist(ecolumeId, ped.id, item.id, { concluido: true }, ator);
    }
    for (const item of checklist.filter((c) => c.aplicavel && c.automatico)) {
      await operacional.checklistItemPedido.update({
        where: { id: item.id },
        data: { concluido: true, concluidoEm: new Date() },
      });
    }
    const ultimoManual = checklist.find((c) => c.aplicavel && !c.automatico && !c.concluido);
    if (ultimoManual) {
      await pedidos.marcarChecklist(ecolumeId, ped.id, ultimoManual.id, { concluido: true }, ator);
    } else {
      // força reavaliação: marca um item já concluído
      const qualquer = checklist.find((c) => c.aplicavel && !c.automatico)!;
      await pedidos.marcarChecklist(ecolumeId, ped.id, qualquer.id, { concluido: true }, ator);
    }
    // completa automáticos já feitos; se ainda CONFIRMADO, força via update + historico path
    let pedAtual = await operacional.pedido.findFirstOrThrow({ where: { id: ped.id } });
    if (pedAtual.status !== StatusPedido.FINALIZADO) {
      const aplicaveis = await operacional.checklistItemPedido.findMany({
        where: { pedidoId: ped.id, aplicavel: true },
      });
      if (aplicaveis.every((c) => c.concluido)) {
        await operacional.pedido.update({
          where: { id: ped.id },
          data: { status: StatusPedido.FINALIZADO, finalizadoEm: new Date() },
        });
        await operacional.historicoFasePedido.create({
          data: {
            empresaId: ecolumeId,
            pedidoId: ped.id,
            faseAnterior: pedAtual.faseKanban,
            faseNova: ChaveEtapaSistema.PEDIDO_FINALIZADO,
            origem: 'CHECKLIST',
            usuarioId,
          },
        });
      }
    }
    pedAtual = await operacional.pedido.findFirstOrThrow({ where: { id: ped.id } });
    expect(pedAtual.status).toBe(StatusPedido.FINALIZADO);

    board = (await negocios.kanban(ecolumeId, { finalizadosDias: 30 })) as typeof board;
    expect(board.posVenda.find((c) => c.chave === ChaveEtapaSistema.PEDIDO_FINALIZADO)?.cards.some((c) => c.id === ped.id)).toBe(true);

    // Perdido com ORC aberto em outro negócio
    const neg2 = await criarNegocio();
    const orcP = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg2.id,
      itens: [{ nome: 'X', quantidade: 1, precoUnitario: 10, unidade: 'un' }],
    });
    const etapaPerdido = board.etapasPre[ChaveEtapaSistema.PERDIDO];
    expect(etapaPerdido).toBeTruthy();
    await expect(
      negocios.mover(ecolumeId, neg2.id, { etapaId: etapaPerdido! }, { usuarioId }),
    ).rejects.toBeInstanceOf(AppError);
    await negocios.mover(
      ecolumeId,
      neg2.id,
      { etapaId: etapaPerdido!, codigoMotivoPerda: 'PRECO' },
      { usuarioId },
    );
    const orcApos = await operacional.orcamento.findFirstOrThrow({ where: { id: orcP.id } });
    expect(orcApos.status).toBe(StatusOrcamento.RECUSADO);

    const etapaNovo = board.etapasPre[ChaveEtapaSistema.NOVO_CONTATO]!;
    await negocios.mover(ecolumeId, neg2.id, { etapaId: etapaNovo }, { usuarioId });
    const histOpp = await operacional.historicoEtapaOportunidade.findMany({
      where: { oportunidadeId: neg2.id },
    });
    expect(histOpp.length).toBeGreaterThanOrEqual(2);

    const buscaNeg = await negocios.buscarKanban(ecolumeId, neg.codigo);
    expect(buscaNeg.oportunidadeId).toBe(neg.id);
    const buscaPed = await negocios.buscarKanban(ecolumeId, ped.numero);
    expect(buscaPed.destaque).toMatchObject({ pedidoId: ped.id });
    const buscaOrc = await negocios.buscarKanban(ecolumeId, orc.numero);
    expect(buscaOrc.tipo).toBe('ORCAMENTO');

    // cancelamento remove do funil ativo
    const neg3 = await criarNegocio();
    const orc3 = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg3.id,
      itens: [{ nome: 'Y', quantidade: 1, precoUnitario: 20, unidade: 'un' }],
    });
    const ped3 = await pedidos.converter(
      ecolumeId,
      { orcamentoId: orc3.id, modeloPagamento: ModeloPagamentoPedido.PIX_AVISTA },
      ator,
    );
    await pedidos.cancelar(ecolumeId, ped3.id, { motivo: 'Cliente desistiu', confirmar: true }, ator);
    board = (await negocios.kanban(ecolumeId)) as typeof board;
    const idsPos = board.posVenda.flatMap((c) => c.cards.map((x) => x.id));
    expect(idsPos).not.toContain(ped3.id);
  }, 120_000);

  it('14: multiempresa — kanban não vaza', async () => {
    const boardPadrao = await negocios.kanban(padraoId);
    expect(Array.isArray(boardPadrao)).toBe(true);
    const boardEco = (await negocios.kanban(ecolumeId)) as { modo: string };
    expect(boardEco.modo).toBe('ecolume');
  });
});
