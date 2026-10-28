import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  ChaveEtapaSistema,
  ModeloPagamentoPedido,
  NaturezaPessoa,
  OrigemNegocio,
  PerfilUsuario,
  PermissaoComercial,
  PrioridadeOportunidade,
  StatusComissaoPedido,
  StatusNotaFiscal,
  StatusOrcamento,
  StatusPedido,
  TipoAuditoria,
  TipoContato,
  TipoMovimentacaoEstoque,
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
  process.env.ECOL_CANCEL === '1' ||
  process.env.ECOL_CONV === '1' ||
  process.env.ECOL_PEDIDO === '1';

const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('ECOL-18 Cancelamento de pedido', () => {
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
  let vendedorId = '';
  let clienteId = '';
  let parceiroId = '';
  let ator = { id: '', perfil: PerfilUsuario.PROPRIETARIO };

  beforeAll(async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `CAN18 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `CAN18P ${sufixo}`,
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
        email: `can18-${sufixo}@teste.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    usuarioId = user.id;
    ator = { id: usuarioId, perfil: PerfilUsuario.PROPRIETARIO };

    const vend = await platform.usuario.create({
      data: {
        empresaId: ecolumeId,
        nome: `Vend ${sufixo}`,
        email: `can18v-${sufixo}@teste.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.VENDEDOR,
      },
    });
    vendedorId = vend.id;

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

    clienteId = (
      await contatos.criar(ecolumeId, {
        nome: `Cliente CAN ${sufixo}`,
        telefone: '11970005001',
        natureza: NaturezaPessoa.PF,
        tipo: TipoContato.OUTRO,
        dadosPersonalizados: {},
      })
    ).id as string;

    parceiroId = (
      await contatos.criar(ecolumeId, {
        nome: `Parceiro CAN ${sufixo}`,
        telefone: '11970005002',
        natureza: NaturezaPessoa.PF,
        tipo: TipoContato.OUTRO,
        ehParceiro: true,
        rtPadrao: 10,
        dadosPersonalizados: {},
      })
    ).id as string;
  }, 90_000);

  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.checklistItemPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.pagamentoPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.comissaoPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.itemSeparacaoPedido
        .deleteMany({ where: { pedido: { empresaId } } })
        .catch(() => undefined);
      await operacional.itemCompraPedido
        .deleteMany({ where: { pedido: { empresaId } } })
        .catch(() => undefined);
      await operacional.notaFiscal.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.movimentacaoEstoque.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.itemPedido.deleteMany({ where: { pedido: { empresaId } } }).catch(() => undefined);
      await operacional.pedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.itemOrcamento.deleteMany({ where: { orcamento: { empresaId } } }).catch(() => undefined);
      await operacional.orcamento.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.logAuditoria.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.produto.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.oportunidade.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.contato.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.etapaFunil.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.concessaoPermissao.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.usuario.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  }, 90_000);

  async function criarNegocio(rt = 10) {
    return negocios.criar(
      ecolumeId,
      {
        contatoId: clienteId,
        titulo: `Neg CAN ${randomUUID().slice(0, 6)}`,
        origemNegocio: OrigemNegocio.VIA_PARCEIRO,
        parceiroId,
        rtNegocio: rt,
        responsavelId: usuarioId,
        prioridade: PrioridadeOportunidade.MEDIA,
        dadosPersonalizados: {},
      },
      { usuarioId },
    );
  }

  async function criarProduto(nome: string, estoque: number, controla = true) {
    return produtos.criar(
      ecolumeId,
      {
        nome,
        unidade: 'un',
        precoVenda: 50,
        controlaEstoque: controla,
        estoqueMinimo: 0,
        ativo: true,
        saldoInicial: estoque,
      } as never,
      usuarioId,
    );
  }

  async function converterBasico(opts: {
    estoque?: number;
    qtd?: number;
    avulso?: boolean;
    semControle?: boolean;
  } = {}) {
    const neg = await criarNegocio(10);
    const itens: Array<Record<string, unknown>> = [];
    let prod: { id: string; nome: string; custoMedio?: unknown; ultimoPreco?: unknown } | null =
      null;
    if (opts.avulso) {
      itens.push({
        nome: 'Avulso',
        quantidade: 1,
        precoUnitario: 20,
        unidade: 'un',
        precoManual: true,
      });
    } else if (opts.semControle) {
      prod = await criarProduto(`SC ${sufixo}`, 0, false);
      itens.push({
        produtoId: prod.id,
        nome: prod.nome,
        quantidade: opts.qtd ?? 2,
        precoUnitario: 30,
        unidade: 'un',
        precoManual: true,
      });
    } else {
      prod = await criarProduto(`P ${randomUUID().slice(0, 4)}`, opts.estoque ?? 4);
      itens.push({
        produtoId: prod.id,
        nome: prod.nome,
        quantidade: opts.qtd ?? 10,
        precoUnitario: 40,
        unidade: 'un',
        precoManual: true,
      });
    }
    const orc = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg.id as string,
      itens: itens as never,
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
    return { neg, orc, ped, prod };
  }

  it('1+2+3+5+6+7: cancelamento, estorno 4→-6→4, custo intacto, comissão e ORC', async () => {
    const { orc, ped, prod } = await converterBasico({ estoque: 4, qtd: 10 });
    expect(prod).toBeTruthy();
    const antes = await operacional.produto.findFirstOrThrow({ where: { id: prod!.id } });
    expect(antes.estoqueAtual).toBe(-6);
    const custoMedio = antes.custoMedio;
    const ultimoPreco = antes.ultimoPreco;

    const cancelado = await pedidos.cancelar(
      ecolumeId,
      ped.id,
      { motivo: 'Cliente desistiu do pedido', confirmar: true },
      ator,
    );
    expect(cancelado.status).toBe(StatusPedido.CANCELADO);
    expect(cancelado.motivoCancelamento).toBe('Cliente desistiu do pedido');
    expect(cancelado.canceladoEm).toBeTruthy();
    expect(cancelado.comissao?.status).toBe(StatusComissaoPedido.CANCELADA);
    expect(cancelado.pagamentos!.length).toBeGreaterThan(0);
    expect(cancelado.alertaPagamentosRecebidos?.valorRecebido).toBeGreaterThan(0);

    const depois = await operacional.produto.findFirstOrThrow({ where: { id: prod!.id } });
    expect(depois.estoqueAtual).toBe(4);
    expect(depois.custoMedio?.toString()).toBe(custoMedio?.toString());
    expect(depois.ultimoPreco?.toString()).toBe(ultimoPreco?.toString());

    const orcDepois = await operacional.orcamento.findFirstOrThrow({ where: { id: orc.id } });
    expect(orcDepois.status).toBe(StatusOrcamento.RECUSADO);

    const estornos = await operacional.movimentacaoEstoque.findMany({
      where: {
        empresaId: ecolumeId,
        pedidoId: ped.id,
        tipo: TipoMovimentacaoEstoque.ENTRADA,
        motivo: 'ESTORNO_PEDIDO',
      },
    });
    expect(estornos).toHaveLength(1);
    expect(estornos[0]!.quantidade).toBe(10);

    const logs = await operacional.logAuditoria.findMany({
      where: {
        empresaId: ecolumeId,
        tipo: TipoAuditoria.CANCELAMENTO_PEDIDO,
        entidadeId: ped.id,
      },
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const rec = await produtos.reconciliar(ecolumeId);
    expect(rec.itens.find((i) => i.produtoId === prod!.id)?.consistente).toBe(true);
  }, 60_000);

  it('4: avulso e sem controle não geram estorno', async () => {
    const a = await converterBasico({ avulso: true });
    const c1 = await pedidos.cancelar(
      ecolumeId,
      a.ped.id,
      { motivo: 'Avulso cancelado', confirmar: true },
      ator,
    );
    expect(c1.status).toBe(StatusPedido.CANCELADO);
    const estA = await operacional.movimentacaoEstoque.count({
      where: { pedidoId: a.ped.id, motivo: 'ESTORNO_PEDIDO' },
    });
    expect(estA).toBe(0);

    const s = await converterBasico({ semControle: true, qtd: 3 });
    await pedidos.cancelar(
      ecolumeId,
      s.ped.id,
      { motivo: 'Sem controle', confirmar: true },
      ator,
    );
    const estS = await operacional.movimentacaoEstoque.count({
      where: { pedidoId: s.ped.id, motivo: 'ESTORNO_PEDIDO' },
    });
    expect(estS).toBe(0);
    const p = await operacional.produto.findFirstOrThrow({ where: { id: s.prod!.id } });
    expect(p.estoqueAtual).toBe(0);
  }, 60_000);

  it('8: NF-e autorizada bloqueia cancelamento', async () => {
    const { orc, ped, prod } = await converterBasico({ estoque: 5, qtd: 1 });
    await operacional.notaFiscal.create({
      data: {
        empresaId: ecolumeId,
        orcamentoId: orc.id,
        oportunidadeId: ped.oportunidadeId,
        status: StatusNotaFiscal.AUTORIZADA,
        numero: '1',
        serie: '1',
        autorizadoEm: new Date(),
      },
    });
    await expect(
      pedidos.cancelar(
        ecolumeId,
        ped.id,
        { motivo: 'Tentativa com NF', confirmar: true },
        ator,
      ),
    ).rejects.toMatchObject({ codigo: 'NF_AUTORIZADA_BLOQUEIA_CANCELAMENTO' });
    const p = await operacional.produto.findFirstOrThrow({ where: { id: prod!.id } });
    expect(p.estoqueAtual).toBe(4);
    const pedDb = await operacional.pedido.findFirstOrThrow({ where: { id: ped.id } });
    expect(pedDb.status).toBe(StatusPedido.CONFIRMADO);
  }, 45_000);

  it('9: duplicado e concorrente — um estorno', async () => {
    const { ped, prod } = await converterBasico({ estoque: 8, qtd: 3 });
    const [a, b] = await Promise.allSettled([
      pedidos.cancelar(ecolumeId, ped.id, { motivo: 'Concorrente A', confirmar: true }, ator),
      pedidos.cancelar(ecolumeId, ped.id, { motivo: 'Concorrente B', confirmar: true }, ator),
    ]);
    const ok = [a, b].filter((r) => r.status === 'fulfilled');
    const falha = [a, b].filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(falha).toHaveLength(1);
    const estornos = await operacional.movimentacaoEstoque.count({
      where: { pedidoId: ped.id, motivo: 'ESTORNO_PEDIDO' },
    });
    expect(estornos).toBe(1);
    const p = await operacional.produto.findFirstOrThrow({ where: { id: prod!.id } });
    expect(p.estoqueAtual).toBe(8);

    await expect(
      pedidos.cancelar(ecolumeId, ped.id, { motivo: 'De novo', confirmar: true }, ator),
    ).rejects.toMatchObject({ codigo: 'PEDIDO_JA_CANCELADO' });
  }, 45_000);

  it('10: rollback se auditoria de cancelamento falhar', async () => {
    const { ped, prod } = await converterBasico({ estoque: 6, qtd: 2 });
    const original = auditoria.registrar.bind(auditoria);
    auditoria.registrar = async (tx, entrada) => {
      if (entrada.tipo === TipoAuditoria.CANCELAMENTO_PEDIDO) {
        throw Object.assign(new Error('falha audit'), { codigo: 'AUDITORIA_TESTE' });
      }
      return original(tx, entrada);
    };
    await expect(
      pedidos.cancelar(
        ecolumeId,
        ped.id,
        { motivo: 'Rollback teste', confirmar: true },
        ator,
      ),
    ).rejects.toBeTruthy();
    auditoria.registrar = original;

    const pedDb = await operacional.pedido.findFirstOrThrow({ where: { id: ped.id } });
    expect(pedDb.status).toBe(StatusPedido.CONFIRMADO);
    const p = await operacional.produto.findFirstOrThrow({ where: { id: prod!.id } });
    expect(p.estoqueAtual).toBe(4);
    const est = await operacional.movimentacaoEstoque.count({
      where: { pedidoId: ped.id, motivo: 'ESTORNO_PEDIDO' },
    });
    expect(est).toBe(0);
  }, 45_000);

  it('11: lista de compra após estorno deixa de listar o negativo', async () => {
    const { ped, prod } = await converterBasico({ estoque: 1, qtd: 5 });
    const antes = await produtos.listaCompra(ecolumeId);
    expect(antes.flatMap((g) => g.itens).some((i) => i.produtoId === prod!.id)).toBe(true);
    await pedidos.cancelar(
      ecolumeId,
      ped.id,
      { motivo: 'Atualiza lista de compra', confirmar: true },
      ator,
    );
    const depois = await produtos.listaCompra(ecolumeId);
    expect(depois.flatMap((g) => g.itens).some((i) => i.produtoId === prod!.id)).toBe(false);
  }, 45_000);

  it('12: permissões, isolamento e legado', async () => {
    const { ped } = await converterBasico({ estoque: 3, qtd: 1 });
    await expect(
      pedidos.cancelar(
        ecolumeId,
        ped.id,
        { motivo: 'Sem permissao', confirmar: true },
        { id: vendedorId, perfil: PerfilUsuario.VENDEDOR },
      ),
    ).rejects.toMatchObject({ codigo: 'SEM_PERMISSAO' });

    await permissoes.conceder(
      ecolumeId,
      vendedorId,
      [PermissaoComercial.CANCELAR_PEDIDO],
      usuarioId,
    );
    const ok = await pedidos.cancelar(
      ecolumeId,
      ped.id,
      { motivo: 'Com permissao', confirmar: true },
      { id: vendedorId, perfil: PerfilUsuario.VENDEDOR },
    );
    expect(ok.status).toBe(StatusPedido.CANCELADO);

    await expect(
      pedidos.cancelar(
        padraoId,
        ped.id,
        { motivo: 'Legado', confirmar: true },
        ator,
      ),
    ).rejects.toMatchObject({ codigo: 'PEDIDO_INDISPONIVEL' });

    await expect(
      pedidos.cancelar(
        ecolumeId,
        ped.id,
        { motivo: 'Repeticao', confirmar: true },
        ator,
      ),
    ).rejects.toMatchObject({ codigo: 'PEDIDO_JA_CANCELADO' });
  }, 60_000);
});
