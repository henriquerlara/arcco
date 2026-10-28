import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  ConclusaoEntrega,
  FaseKanbanPedido,
  ModeloPagamentoPedido,
  NaturezaPessoa,
  OrigemNegocio,
  PerfilUsuario,
  PrioridadeOportunidade,
  StatusPedido,
  TipoAtividade,
  TipoChecklistPedido,
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
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { OrcamentosService } from '../orcamentos/orcamentos.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { AppError } from '../../common/erros/erros';
import { AtividadesService } from './atividades.service';

const ATIVO =
  process.env.ECOL_ENTREGA === '1' ||
  process.env.ECOL_KANBAN === '1' ||
  process.env.ECOL_CONV === '1';

const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('ECOL-20 Agenda e entregas', () => {
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
  const atividades = new AtividadesService(operacional as never, eventos, permissoes);

  let ecolumeId = '';
  let padraoId = '';
  let usuarioId = '';
  let clienteId = '';
  let parceiroId = '';
  let ator = { id: '', perfil: PerfilUsuario.PROPRIETARIO };

  beforeAll(async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `ENT20 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `ENT20P ${sufixo}`,
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
        email: `ent20-${sufixo}@teste.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    usuarioId = user.id;
    ator = { id: usuarioId, perfil: PerfilUsuario.PROPRIETARIO };

    for (const empresaId of [ecolumeId, padraoId]) {
      const existe = await operacional.etapaFunil.findFirst({
        where: { empresaId, chaveSistema: 'NOVO_CONTATO' },
      });
      if (!existe) {
        await operacional.etapaFunil.create({
          data: {
            empresaId,
            nome: 'Novo contato',
            ordem: 1,
            tipo: 'ABERTA',
            chaveSistema: 'NOVO_CONTATO',
            ativo: true,
          },
        });
      }
    }

    const cli = await contatos.criar(ecolumeId, {
      nome: `Cliente ${sufixo}`,
      telefone: '11988880001',
      natureza: NaturezaPessoa.PF,
      tipo: TipoContato.OUTRO,
      cep: '01310100',
      logradouro: 'Av Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP',
      dadosPersonalizados: {},
    });
    clienteId = cli.id as string;
    const par = await contatos.criar(ecolumeId, {
      nome: `Parceiro ${sufixo}`,
      telefone: '11988880002',
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
      await operacional.atividade.deleteMany({ where: { empresaId } }).catch(() => undefined);
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

  async function pedidoBasico(opts?: { comObra?: boolean }) {
    const neg = await negocios.criar(
      ecolumeId,
      {
        contatoId: clienteId,
        origemNegocio: OrigemNegocio.VIA_PARCEIRO,
        parceiroId,
        responsavelId: usuarioId,
        prioridade: PrioridadeOportunidade.MEDIA,
        titulo: `Obra ent ${sufixo}`,
        ...(opts?.comObra
          ? {
              obraCep: '04567000',
              obraLogradouro: 'Rua da Obra',
              obraNumero: '50',
              obraBairro: 'Brooklin',
              obraCidade: 'São Paulo',
              obraUf: 'SP',
            }
          : {}),
      },
      { usuarioId },
    );
    const orc = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg.id,
      itens: [{ nome: 'Perfil LED', quantidade: 2, precoUnitario: 80, unidade: 'un', precoManual: true }],
    });
    const ped = await pedidos.converter(
      ecolumeId,
      { orcamentoId: orc.id, modeloPagamento: ModeloPagamentoPedido.PIX_AVISTA },
      ator,
    );
    await pedidos.moverKanban(ecolumeId, ped.id, { faseKanban: FaseKanbanPedido.PRONTO_ENTREGA }, ator);
    return { neg, orc, ped };
  }

  it('1+2: cinco tipos ecolume e vínculos', async () => {
    const { neg, ped } = await pedidoBasico();
    for (const tipo of [
      TipoAtividade.VISITA,
      TipoAtividade.REUNIAO,
      TipoAtividade.FOLLOW_UP,
      TipoAtividade.TAREFA,
    ]) {
      const a = await atividades.criar(ecolumeId, usuarioId, {
        tipo,
        titulo: `${tipo} ${sufixo}`,
        vencimento: new Date(),
        oportunidadeId: neg.id,
        contatoId: clienteId,
      });
      expect(a.tipo).toBe(tipo);
    }
    const ent = await atividades.criar(ecolumeId, usuarioId, {
      tipo: TipoAtividade.ENTREGA,
      titulo: `Entrega ${sufixo}`,
      vencimento: new Date(),
      pedidoId: ped.id,
      contatoLocalNome: 'Porteiro',
      contatoLocalTelefone: '11999990000',
      entregaLogradouro: 'Rua X',
      entregaCidade: 'São Paulo',
      entregaUf: 'SP',
    });
    expect(ent.pedidoId).toBe(ped.id);

    await expect(
      atividades.criar(padraoId, usuarioId, {
        tipo: TipoAtividade.ENTREGA,
        titulo: 'x',
        vencimento: new Date(),
        pedidoId: ped.id,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('3+4+5+6+7: sugestão obra/cliente e itens', async () => {
    const comObra = await pedidoBasico({ comObra: true });
    const sObra = await atividades.sugerirEntrega(ecolumeId, comObra.ped.id);
    expect(sObra.endereco.origem).toBe('OBRA');
    expect(sObra.endereco.logradouro).toBe('Rua da Obra');
    expect(sObra.contatoLocalTelefone).toBeTruthy();
    expect(sObra.itensConferencia.length).toBeGreaterThan(0);
    expect(sObra.itensConferencia[0]!.descricaoComercial).toBeTruthy();

    const semObra = await pedidoBasico({ comObra: false });
    const sCli = await atividades.sugerirEntrega(ecolumeId, semObra.ped.id);
    expect(sCli.endereco.origem).toBe('CLIENTE');
    expect(sCli.endereco.logradouro).toBe('Av Paulista');
  });

  it('8+9+10+11+12+13+14: parciais, final, checklist, kanban, cancelado, estoque', async () => {
    const { ped } = await pedidoBasico();
    const movAntes = await operacional.movimentacaoEstoque.count({ where: { empresaId: ecolumeId } });

    const e1 = await atividades.criar(ecolumeId, usuarioId, {
      tipo: TipoAtividade.ENTREGA,
      titulo: 'Parcial 1',
      vencimento: new Date(),
      pedidoId: ped.id,
    });
    const e2 = await atividades.criar(ecolumeId, usuarioId, {
      tipo: TipoAtividade.ENTREGA,
      titulo: 'Parcial 2',
      vencimento: new Date(Date.now() + 86_400_000),
      pedidoId: ped.id,
    });

    await atividades.concluirEntrega(ecolumeId, e1.id, { final: false }, usuarioId);
    let chk = await operacional.checklistItemPedido.findFirst({
      where: { pedidoId: ped.id, tipo: TipoChecklistPedido.ENTREGUE },
    });
    expect(chk?.concluido).toBe(false);
    let pedDb = await operacional.pedido.findFirstOrThrow({ where: { id: ped.id } });
    expect(pedDb.faseKanban).toBe(FaseKanbanPedido.PRONTO_ENTREGA);

    await atividades.concluirEntrega(ecolumeId, e2.id, { final: false }, usuarioId);
    chk = await operacional.checklistItemPedido.findFirst({
      where: { pedidoId: ped.id, tipo: TipoChecklistPedido.ENTREGUE },
    });
    expect(chk?.concluido).toBe(false);

    const e3 = await atividades.criar(ecolumeId, usuarioId, {
      tipo: TipoAtividade.ENTREGA,
      titulo: 'Final',
      vencimento: new Date(),
      pedidoId: ped.id,
    });

    // completa demais itens do checklist antes da final para forçar FINALIZADO
    const checklist = await operacional.checklistItemPedido.findMany({ where: { pedidoId: ped.id } });
    for (const item of checklist.filter((c) => c.aplicavel && c.tipo !== TipoChecklistPedido.ENTREGUE)) {
      await operacional.checklistItemPedido.update({
        where: { id: item.id },
        data: { concluido: true, concluidoEm: new Date() },
      });
    }

    const fin = await atividades.concluirEntrega(ecolumeId, e3.id, { final: true }, usuarioId);
    expect(fin.conclusaoEntrega).toBe(ConclusaoEntrega.FINAL);
    chk = await operacional.checklistItemPedido.findFirst({
      where: { pedidoId: ped.id, tipo: TipoChecklistPedido.ENTREGUE },
    });
    expect(chk?.concluido).toBe(true);
    pedDb = await operacional.pedido.findFirstOrThrow({ where: { id: ped.id } });
    expect(pedDb.faseKanban).toBe(FaseKanbanPedido.ENTREGUE);
    expect(pedDb.status).toBe(StatusPedido.FINALIZADO);

    const hist = await operacional.historicoFasePedido.count({
      where: { pedidoId: ped.id, origem: 'ENTREGA' },
    });
    expect(hist).toBe(1);

    const dup = await atividades.concluirEntrega(ecolumeId, e3.id, { final: true }, usuarioId);
    expect((dup as { idempotente?: boolean }).idempotente).toBe(true);
    expect(
      await operacional.historicoFasePedido.count({
        where: { pedidoId: ped.id, origem: 'ENTREGA' },
      }),
    ).toBe(1);

    const movDepois = await operacional.movimentacaoEstoque.count({ where: { empresaId: ecolumeId } });
    expect(movDepois).toBe(movAntes);

    const { ped: pedCanc } = await pedidoBasico();
    const eCanc = await atividades.criar(ecolumeId, usuarioId, {
      tipo: TipoAtividade.ENTREGA,
      titulo: 'Nao deve concluir',
      vencimento: new Date(),
      pedidoId: pedCanc.id,
    });
    await pedidos.cancelar(
      ecolumeId,
      pedCanc.id,
      { motivo: 'Cancelado teste entrega', confirmar: true },
      ator,
    );
    await expect(
      atividades.concluirEntrega(ecolumeId, eCanc.id, { final: true }, usuarioId),
    ).rejects.toBeInstanceOf(AppError);
  }, 120_000);

  it('15: legado e multiempresa', async () => {
    const lista = await atividades.listar(padraoId, { pagina: 1, porPagina: 10 });
    expect(lista.dados).toBeDefined();
    await expect(atividades.sugerirEntrega(padraoId, randomUUID())).rejects.toBeInstanceOf(AppError);
  });
});
