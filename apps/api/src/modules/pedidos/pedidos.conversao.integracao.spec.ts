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
  StatusOrcamento,
  StatusPedido,
  TipoAuditoria,
  TipoContato,
  TipoChecklistPedido,
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
  process.env.ECOL_CONV === '1' ||
  process.env.ECOL_PEDIDO === '1' ||
  process.env.ECOL_ORCAMENTO === '1';

const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('ECOL-17 Conversão de pedido', () => {
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
        nome: `CONV17 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `CONV17P ${sufixo}`,
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
        email: `conv17-${sufixo}@teste.local`,
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
        email: `conv17v-${sufixo}@teste.local`,
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

    const cliente = await contatos.criar(ecolumeId, {
      nome: `Cliente CONV ${sufixo}`,
      telefone: '11970004001',
      natureza: NaturezaPessoa.PF,
      tipo: TipoContato.OUTRO,
      dadosPersonalizados: {},
    });
    clienteId = cliente.id as string;

    const parceiro = await contatos.criar(ecolumeId, {
      nome: `Parceiro CONV ${sufixo}`,
      telefone: '11970004002',
      natureza: NaturezaPessoa.PF,
      tipo: TipoContato.OUTRO,
      ehParceiro: true,
      rtPadrao: 15,
      dadosPersonalizados: {},
    });
    parceiroId = parceiro.id as string;
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
        titulo: `Neg CONV ${randomUUID().slice(0, 6)}`,
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

  async function criarProduto(opts: {
    nome: string;
    estoque: number;
    controla?: boolean;
    preco?: number;
  }) {
    return produtos.criar(
      ecolumeId,
      {
        nome: opts.nome,
        unidade: 'un',
        precoVenda: opts.preco ?? 100,
        controlaEstoque: opts.controla ?? true,
        estoqueMinimo: 0,
        ativo: true,
        saldoInicial: opts.estoque,
      } as never,
      usuarioId,
    );
  }

  it('1+9+10+11: conversão completa, comissão RT negócio, checklist e PED', async () => {
    const neg = await criarNegocio(10);
    const fita = await criarProduto({ nome: `Fita ${sufixo}`, estoque: 5 });
    const perfil = await criarProduto({ nome: `Perfil ${sufixo}`, estoque: 25 });
    const sobEnc = await criarProduto({
      nome: `SobEnc ${sufixo}`,
      estoque: 0,
      controla: false,
    });

    const orc = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg.id as string,
      descontoValor: 0,
      itens: [
        {
          produtoId: fita.id,
          nome: fita.nome,
          quantidade: 6,
          precoUnitario: 100,
          unidade: 'un',
          precoManual: true,
        },
        {
          produtoId: perfil.id,
          nome: perfil.nome,
          quantidade: 6,
          precoUnitario: 100,
          unidade: 'un',
          precoManual: true,
        },
        {
          produtoId: sobEnc.id,
          nome: sobEnc.nome,
          quantidade: 2,
          precoUnitario: 50,
          unidade: 'un',
          precoManual: true,
        },
        {
          nome: 'Avulso serviço',
          quantidade: 1,
          precoUnitario: 242.56,
          unidade: 'un',
          precoManual: true,
        },
      ],
    });
    // total = 600+600+100+242.56 = 1542.56 — adjust to 1642.56 via preço
    await orcamentos.atualizar(ecolumeId, orc.id, {
      itens: [
        {
          produtoId: fita.id,
          nome: fita.nome,
          quantidade: 6,
          precoUnitario: 100,
          unidade: 'un',
          precoManual: true,
        },
        {
          produtoId: perfil.id,
          nome: perfil.nome,
          quantidade: 6,
          precoUnitario: 100,
          unidade: 'un',
          precoManual: true,
        },
        {
          produtoId: sobEnc.id,
          nome: sobEnc.nome,
          quantidade: 2,
          precoUnitario: 50,
          unidade: 'un',
          precoManual: true,
        },
        {
          nome: 'Avulso serviço',
          quantidade: 1,
          precoUnitario: 342.56,
          unidade: 'un',
          precoManual: true,
        },
      ],
    });
    const orcAtual = await operacional.orcamento.findFirstOrThrow({ where: { id: orc.id } });
    expect(orcAtual.total).toBeCloseTo(1642.56, 2);

    const ped = await pedidos.converter(
      ecolumeId,
      {
        orcamentoId: orc.id,
        modeloPagamento: ModeloPagamentoPedido.SINAL_RESTANTE_ENTREGA,
        percentualSinal: 50,
        orcamentosSubstituirIds: [],
      },
      ator,
    );

    expect(ped.numero).toMatch(/^PED-\d{4}$/);
    expect(ped.status).toBe(StatusPedido.CONFIRMADO);
    expect(ped.pagamentos).toHaveLength(2);
    expect(Number(ped.pagamentos![0]!.valor)).toBeCloseTo(821.28, 2);
    expect(Number(ped.pagamentos![1]!.valor)).toBeCloseTo(821.28, 2);
    expect(ped.comissao?.valorComissao).toBeCloseTo(164.26, 2);
    expect(ped.comissao?.rtPercentual).toBe(10);
    expect(ped.comissao?.status).toBe(StatusComissaoPedido.A_PAGAR);
    expect(ped.checklist?.filter((c) => c.aplicavel)).toHaveLength(6);
    expect(
      ped.checklist?.find((c) => c.tipo === TipoChecklistPedido.ITENS_COMPRADOS)?.aplicavel,
    ).toBe(true);
    expect(
      ped.checklist?.find((c) => c.tipo === TipoChecklistPedido.COMISSAO_PAGA)?.aplicavel,
    ).toBe(true);
    expect(ped.checklist?.every((c) => !c.concluido)).toBe(true);

    const fitaDepois = await operacional.produto.findFirstOrThrow({ where: { id: fita.id } });
    const perfilDepois = await operacional.produto.findFirstOrThrow({ where: { id: perfil.id } });
    const sobDepois = await operacional.produto.findFirstOrThrow({ where: { id: sobEnc.id } });
    expect(fitaDepois.estoqueAtual).toBe(-1);
    expect(perfilDepois.estoqueAtual).toBe(19);
    expect(sobDepois.estoqueAtual).toBe(0);

    const movs = await operacional.movimentacaoEstoque.findMany({
      where: { empresaId: ecolumeId, pedidoId: ped.id, tipo: TipoMovimentacaoEstoque.BAIXA },
    });
    expect(movs).toHaveLength(2);

    const orcConv = await operacional.orcamento.findFirstOrThrow({ where: { id: orc.id } });
    expect(orcConv.status).toBe(StatusOrcamento.CONVERTIDO);

    const logs = await operacional.logAuditoria.findMany({
      where: { empresaId: ecolumeId, tipo: TipoAuditoria.CONVERSAO_PEDIDO, entidadeId: ped.id },
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const rec = await produtos.reconciliar(ecolumeId);
    const fitaRec = rec.itens.find((i) => i.produtoId === fita.id);
    expect(fitaRec?.consistente).toBe(true);

    const lista = await produtos.listaCompra(ecolumeId);
    const flat = (lista as Array<{ itens?: Array<{ produtoId: string }> }>).flatMap(
      (g) => g.itens ?? [],
    );
    expect(flat.some((i) => i.produtoId === fita.id)).toBe(true);

    // ECOL-27b — pagamento de comissão (§16.3)
    const pago = await pedidos.marcarComissaoPaga(ecolumeId, ped.id, ator, 'PIX');
    expect(pago.comissao?.status).toBe(StatusComissaoPedido.PAGA);
    const logsComissao = await operacional.logAuditoria.findMany({
      where: {
        empresaId: ecolumeId,
        tipo: TipoAuditoria.ALTERACAO_COMISSAO,
        entidadeId: ped.comissao!.id,
      },
    });
    expect(logsComissao).toHaveLength(1);
    expect(logsComissao[0].usuarioId).toBe(ator.id);
    expect(logsComissao[0].posterior).toMatchObject({
      status: StatusComissaoPedido.PAGA,
      formaPagamento: 'PIX',
    });
    await pedidos.marcarComissaoPaga(ecolumeId, ped.id, ator, 'PIX');
    expect(
      await operacional.logAuditoria.count({
        where: {
          empresaId: ecolumeId,
          tipo: TipoAuditoria.ALTERACAO_COMISSAO,
          entidadeId: ped.comissao!.id,
        },
      }),
    ).toBe(1);
  }, 60_000);

  it('2: concorrência — um pedido e uma baixa', async () => {
    const neg = await criarNegocio(10);
    const prod = await criarProduto({ nome: `Conc ${sufixo}`, estoque: 10 });
    const orc = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg.id as string,
      itens: [
        {
          produtoId: prod.id,
          nome: prod.nome,
          quantidade: 3,
          precoUnitario: 40,
          unidade: 'un',
          precoManual: true,
        },
      ],
    });
    const [a, b] = await Promise.allSettled([
      pedidos.converter(
        ecolumeId,
        {
          orcamentoId: orc.id,
          modeloPagamento: ModeloPagamentoPedido.PIX_AVISTA,
          orcamentosSubstituirIds: [],
        },
        ator,
      ),
      pedidos.converter(
        ecolumeId,
        {
          orcamentoId: orc.id,
          modeloPagamento: ModeloPagamentoPedido.PIX_AVISTA,
          orcamentosSubstituirIds: [],
        },
        ator,
      ),
    ]);
    const ok = [a, b].filter((r) => r.status === 'fulfilled');
    const falha = [a, b].filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(falha).toHaveLength(1);
    const movs = await operacional.movimentacaoEstoque.count({
      where: { empresaId: ecolumeId, produtoId: prod.id, tipo: TipoMovimentacaoEstoque.BAIXA },
    });
    expect(movs).toBe(1);
    const p = await operacional.produto.findFirstOrThrow({ where: { id: prod.id } });
    expect(p.estoqueAtual).toBe(7);
  }, 45_000);

  it('3: rollback se auditoria falhar (tipo inválido forçado via spy interno)', async () => {
    const neg = await criarNegocio(10);
    const prod = await criarProduto({ nome: `Roll ${sufixo}`, estoque: 8 });
    const orc = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg.id as string,
      itens: [
        {
          produtoId: prod.id,
          nome: prod.nome,
          quantidade: 1,
          precoUnitario: 20,
          unidade: 'un',
          precoManual: true,
        },
      ],
    });
    const original = auditoria.registrar.bind(auditoria);
    let chamadas = 0;
    auditoria.registrar = async (tx, entrada) => {
      chamadas += 1;
      if (entrada.tipo === TipoAuditoria.CONVERSAO_PEDIDO) {
        throw ErrosFake();
      }
      return original(tx, entrada);
    };
    await expect(
      pedidos.converter(
        ecolumeId,
        {
          orcamentoId: orc.id,
          modeloPagamento: ModeloPagamentoPedido.PIX_AVISTA,
          orcamentosSubstituirIds: [],
        },
        ator,
      ),
    ).rejects.toBeTruthy();
    auditoria.registrar = original;

    const pedCount = await operacional.pedido.count({ where: { orcamentoId: orc.id } });
    expect(pedCount).toBe(0);
    const orcDepois = await operacional.orcamento.findFirstOrThrow({ where: { id: orc.id } });
    expect(orcDepois.status).toBe(StatusOrcamento.RASCUNHO);
    const p = await operacional.produto.findFirstOrThrow({ where: { id: prod.id } });
    expect(p.estoqueAtual).toBe(8);
    expect(chamadas).toBeGreaterThan(0);
  }, 45_000);

  it('5+7+8: avulso/sem controle; substituídos só selecionados; dois PED no NEG', async () => {
    const neg = await criarNegocio(10);
    const prod = await criarProduto({ nome: `Dup ${sufixo}`, estoque: 20 });
    const o1 = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg.id as string,
      itens: [
        {
          produtoId: prod.id,
          nome: prod.nome,
          quantidade: 2,
          precoUnitario: 50,
          unidade: 'un',
          precoManual: true,
        },
        { nome: 'Avulso', quantidade: 1, precoUnitario: 10, unidade: 'un', precoManual: true },
      ],
    });
    const o2 = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg.id as string,
      itens: [
        {
          produtoId: prod.id,
          nome: prod.nome,
          quantidade: 1,
          precoUnitario: 50,
          unidade: 'un',
          precoManual: true,
        },
      ],
    });
    const o3 = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg.id as string,
      itens: [{ nome: 'Outro', quantidade: 1, precoUnitario: 5, unidade: 'un', precoManual: true }],
    });

    const ped1 = await pedidos.converter(
      ecolumeId,
      {
        orcamentoId: o1.id,
        modeloPagamento: ModeloPagamentoPedido.CARTAO_DEBITO,
        orcamentosSubstituirIds: [o3.id],
      },
      ator,
    );
    expect(ped1.itensSeparacao).toHaveLength(1);
    const o2Status = await operacional.orcamento.findFirstOrThrow({ where: { id: o2.id } });
    const o3Status = await operacional.orcamento.findFirstOrThrow({ where: { id: o3.id } });
    expect(o2Status.status).toBe(StatusOrcamento.RASCUNHO);
    expect(o3Status.status).toBe(StatusOrcamento.SUBSTITUIDO);

    const ped2 = await pedidos.converter(
      ecolumeId,
      {
        orcamentoId: o2.id,
        modeloPagamento: ModeloPagamentoPedido.PIX_AVISTA,
        orcamentosSubstituirIds: [],
      },
      ator,
    );
    expect(ped2.numero).not.toBe(ped1.numero);
    expect(ped2.oportunidadeId).toBe(ped1.oportunidadeId);
  }, 60_000);

  it('9: seis modelos e soma divergente sem bloqueio', async () => {
    const modelos = [
      ModeloPagamentoPedido.PIX_AVISTA,
      ModeloPagamentoPedido.CARTAO_CREDITO,
      ModeloPagamentoPedido.CARTAO_DEBITO,
      ModeloPagamentoPedido.SINAL_RESTANTE_ENTREGA,
      ModeloPagamentoPedido.SINAL_BOLETOS,
      ModeloPagamentoPedido.PERSONALIZADO,
    ] as const;
    for (const modelo of modelos) {
      const neg = await criarNegocio(10);
      const orc = await orcamentos.criar(ecolumeId, usuarioId, {
        oportunidadeId: neg.id as string,
        itens: [
          { nome: `Pag ${modelo}`, quantidade: 1, precoUnitario: 200, unidade: 'un', precoManual: true },
        ],
      });
      const dto: Parameters<PedidosService['converter']>[1] = {
        orcamentoId: orc.id,
        modeloPagamento: modelo,
        orcamentosSubstituirIds: [],
        ...(modelo === ModeloPagamentoPedido.CARTAO_CREDITO ||
        modelo === ModeloPagamentoPedido.SINAL_BOLETOS
          ? { parcelas: 2 }
          : {}),
        ...(modelo === ModeloPagamentoPedido.PERSONALIZADO
          ? {
              linhasPersonalizadas: [
                { forma: 'A', valor: 50, recebido: true },
                { forma: 'B', valor: 100 },
              ],
            }
          : {}),
      };
      const ped = await pedidos.converter(ecolumeId, dto, ator);
      expect(ped.pagamentos!.length).toBeGreaterThan(0);
      if (modelo === ModeloPagamentoPedido.PERSONALIZADO) {
        expect(ped.avisoPagamento?.diferenca).not.toBe(0);
      }
    }
  }, 90_000);

  it('12+13: permissões, legado e bloqueio de conversão repetida', async () => {
    const neg = await criarNegocio(10);
    const orc = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg.id as string,
      itens: [
        { nome: 'Perm', quantidade: 1, precoUnitario: 80, unidade: 'un', precoManual: true },
      ],
    });
    await expect(
      pedidos.converter(
        ecolumeId,
        {
          orcamentoId: orc.id,
          modeloPagamento: ModeloPagamentoPedido.PIX_AVISTA,
          orcamentosSubstituirIds: [],
        },
        { id: vendedorId, perfil: PerfilUsuario.VENDEDOR },
      ),
    ).rejects.toMatchObject({ codigo: 'SEM_PERMISSAO' });

    await permissoes.conceder(
      ecolumeId,
      vendedorId,
      [PermissaoComercial.CONVERTER_PEDIDO],
      usuarioId,
    );
    const ped = await pedidos.converter(
      ecolumeId,
      {
        orcamentoId: orc.id,
        modeloPagamento: ModeloPagamentoPedido.PIX_AVISTA,
        orcamentosSubstituirIds: [],
      },
      { id: vendedorId, perfil: PerfilUsuario.VENDEDOR },
    );
    expect(ped.numero).toMatch(/^PED-/);

    await expect(
      pedidos.converter(
        ecolumeId,
        {
          orcamentoId: orc.id,
          modeloPagamento: ModeloPagamentoPedido.PIX_AVISTA,
          orcamentosSubstituirIds: [],
        },
        ator,
      ),
    ).rejects.toMatchObject({ codigo: expect.stringMatching(/JA_|NAO_CONVERSIVEL/) });

    const orcPadrao = await operacional.orcamento.create({
      data: {
        empresaId: padraoId,
        oportunidadeId: (
          await operacional.oportunidade.create({
            data: {
              empresaId: padraoId,
              contatoId: (
                await operacional.contato.create({
                  data: {
                    empresaId: padraoId,
                    nome: `C ${sufixo}`,
                    telefone: '11970004999',
                    telefoneNormalizado: '5511970004999',
                    tipo: 'OUTRO',
                  },
                })
              ).id,
              titulo: 'Legado',
              etapaId: (
                await operacional.etapaFunil.findFirstOrThrow({
                  where: { empresaId: padraoId },
                })
              ).id,
              codigo: `OP-${sufixo}`,
              prioridade: 'MEDIA',
            },
          })
        ).id,
        numero: `ORC-L-${sufixo}`,
        status: StatusOrcamento.RASCUNHO,
        versao: 1,
        vigente: true,
        subtotal: 10,
        total: 10,
        itens: {
          create: [
            {
              nome: 'X',
              quantidade: 1,
              precoUnitario: 10,
              totalLinha: 10,
              ordem: 0,
            },
          ],
        },
      },
    });
    await expect(
      pedidos.converter(
        padraoId,
        {
          orcamentoId: orcPadrao.id,
          modeloPagamento: ModeloPagamentoPedido.PIX_AVISTA,
          orcamentosSubstituirIds: [],
        },
        ator,
      ),
    ).rejects.toMatchObject({ codigo: 'PEDIDO_INDISPONIVEL' });
  }, 60_000);

  it('11b: checklist 100% → FINALIZADO', async () => {
    const neg = await criarNegocio(0);
    await operacional.oportunidade.update({
      where: { id: neg.id as string },
      data: { parceiroId: null, rtNegocio: null, origemNegocio: OrigemNegocio.CLIENTE_DIRETO },
    });
    const orc = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg.id as string,
      itens: [
        { nome: 'Chk', quantidade: 1, precoUnitario: 50, unidade: 'un', precoManual: true },
      ],
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
    const aplicaveis = ped.checklist!.filter((c) => c.aplicavel);
    const manuais = aplicaveis.filter((c) => !c.automatico);
    const automaticos = aplicaveis.filter((c) => c.automatico);
    for (const item of manuais) {
      await pedidos.marcarChecklist(
        ecolumeId,
        ped.id,
        item.id,
        { concluido: true },
        ator,
      );
    }
    for (const item of automaticos) {
      await operacional.checklistItemPedido.update({
        where: { id: item.id },
        data: { concluido: true, concluidoEm: new Date(), usuarioId },
      });
    }
    const algum = manuais[0]!;
    await pedidos.marcarChecklist(ecolumeId, ped.id, algum.id, { concluido: false }, ator);
    const final = await pedidos.marcarChecklist(
      ecolumeId,
      ped.id,
      algum.id,
      { concluido: true },
      ator,
    );
    expect(final.status).toBe(StatusPedido.FINALIZADO);
  }, 45_000);
});

function ErrosFake() {
  return Object.assign(new Error('falha auditoria teste'), { codigo: 'AUDITORIA_TESTE' });
}
