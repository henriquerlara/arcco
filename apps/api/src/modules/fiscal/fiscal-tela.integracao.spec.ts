import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  ChaveEtapaSistema,
  ModeloPagamentoPedido,
  NaturezaPessoa,
  OrigemNegocio,
  PerfilUsuario,
  PrioridadeOportunidade,
  StatusNotaFiscal,
  StatusPedido,
  TipoContato,
  TipoMovimentacaoEstoque,
} from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';
import { ContatosService } from '../contatos/contatos.service';
import { EmpresasService } from '../empresas/empresas.service';
import { EventosService } from '../eventos/eventos.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ProdutosService } from '../produtos/produtos.service';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { OrcamentosService } from '../orcamentos/orcamentos.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { FocusNfeClient } from './focus-nfe.client';
import { NfePedidoService } from './nfe-pedido.service';

const ATIVO =
  process.env.ECOL_FISCAL === '1' ||
  process.env.ECOL_NFE === '1' ||
  process.env.ECOL_PEDIDO === '1';

const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('ECOL-25 Tela Fiscal', () => {
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
  const empresasSvc = new EmpresasService(platform as never);
  const focus = {
    configurado: () => false,
    ambiente: () => 'homologacao' as const,
    emitirNfe: vi.fn(async () => ({
      mock: true,
      statusHttp: 200,
      body: {
        status: 'autorizado',
        numero: '100',
        serie: '1',
        chave_nfe: '2'.repeat(44),
        mensagem: 'mock',
      },
    })),
    consultarNfe: vi.fn(async () => ({
      mock: true,
      statusHttp: 200,
      body: { status: 'autorizado' },
    })),
    cancelarNfe: vi.fn(async () => ({
      mock: true,
      statusHttp: 200,
      body: { status: 'cancelado' },
    })),
    baixarArquivo: vi.fn(async () => null),
  };
  const nfe = new NfePedidoService(
    operacional as never,
    platform as never,
    focus as unknown as FocusNfeClient,
    { enviar: async () => ({ id: 'arq' }) } as never,
    empresasSvc,
    permissoes,
    auditoria,
  );

  let ecolumeId = '';
  let padraoId = '';
  let usuarioId = '';
  let clienteId = '';
  let ator = { id: '', empresaId: '', perfil: PerfilUsuario.PROPRIETARIO };

  beforeAll(async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `FIS25 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        cnpj: '11222333000181',
        enderecoFiscal: {
          logradouro: 'Rua A',
          numero: '1',
          bairro: 'B',
          municipio: 'Sao Paulo',
          uf: 'SP',
          cep: '01001000',
        },
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `FIS25P ${sufixo}`,
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
        nome: `U ${sufixo}`,
        email: `fis25-${sufixo}@t.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    usuarioId = user.id;
    ator = { id: usuarioId, empresaId: ecolumeId, perfil: PerfilUsuario.PROPRIETARIO };

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
        nome: `Cli FIS ${sufixo}`,
        telefone: '11990007001',
        documento: '39053344705',
        natureza: NaturezaPessoa.PF,
        tipo: TipoContato.OUTRO,
        cep: '01310100',
        logradouro: 'Av Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
        cidade: 'Sao Paulo',
        uf: 'SP',
        dadosPersonalizados: {},
      })
    ).id as string;
  }, 90_000);

  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.itemNotaFiscal.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.notaFiscal.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.checklistItemPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.pagamentoPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.comissaoPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.itemSeparacaoPedido
        .deleteMany({ where: { pedido: { empresaId } } })
        .catch(() => undefined);
      await operacional.itemCompraPedido
        .deleteMany({ where: { pedido: { empresaId } } })
        .catch(() => undefined);
      await operacional.historicoFasePedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
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
      await platform.usuario.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  }, 90_000);

  async function montarPedido(qtd = 4) {
    const neg = await negocios.criar(
      ecolumeId,
      {
        contatoId: clienteId,
        titulo: `Neg FIS ${randomUUID().slice(0, 6)}`,
        origemNegocio: OrigemNegocio.CLIENTE_DIRETO,
        responsavelId: usuarioId,
        prioridade: PrioridadeOportunidade.MEDIA,
        dadosPersonalizados: {},
      },
      { usuarioId },
    );
    const prod = await produtos.criar(
      ecolumeId,
      {
        nome: `P FIS ${sufixo}`,
        nomeFiscal: `Fiscal ${sufixo}`,
        unidade: 'un',
        precoVenda: 50,
        controlaEstoque: true,
        estoqueMinimo: 0,
        ativo: true,
        saldoInicial: 40,
        ncm: '94036000',
        origemFiscal: '0',
      } as never,
      usuarioId,
    );
    const orc = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg.id as string,
      itens: [
        {
          produtoId: prod.id,
          nome: 'Linha',
          quantidade: qtd,
          unidade: 'un',
          precoUnitario: 50,
          desconto: 0,
          precoManual: true,
        },
      ] as never,
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
    return { ped, prod };
  }

  it('7+8+10+12: pendentes, parcial, total some da lista, P3/mock', async () => {
    const { ped } = await montarPedido(4);
    const pend0 = await nfe.listarPendentesEmissao(ecolumeId, ator);
    expect(pend0.emissaoRealHabilitada).toBe(false);
    expect(pend0.focusConfigurado).toBe(false);
    const row = pend0.pedidos.find((p) => p.pedidoId === ped.id);
    expect(row).toBeTruthy();
    expect(row!.itensPendentes[0].quantidadePendente).toBe(4);

    const prep = await nfe.preparar(ecolumeId, ped.id, ator);
    await nfe.emitir(
      ecolumeId,
      ped.id,
      {
        itens: [{ itemPedidoId: prep.itens[0].itemPedidoId, quantidade: 1 }],
        idempotencyKey: `fis25-par-${sufixo}`,
      },
      ator,
    );
    const pend1 = await nfe.listarPendentesEmissao(ecolumeId, ator);
    const row1 = pend1.pedidos.find((p) => p.pedidoId === ped.id)!;
    expect(row1.itensPendentes[0].quantidadePendente).toBe(3);

    await nfe.emitir(
      ecolumeId,
      ped.id,
      {
        itens: [{ itemPedidoId: prep.itens[0].itemPedidoId, quantidade: 3 }],
        idempotencyKey: `fis25-tot-${sufixo}`,
      },
      ator,
    );
    const pend2 = await nfe.listarPendentesEmissao(ecolumeId, ator);
    expect(pend2.pedidos.find((p) => p.pedidoId === ped.id)).toBeUndefined();
  }, 90_000);

  it('2+3+4: listar emitidas com status e docs ausentes no mock', async () => {
    const { ped } = await montarPedido(1);
    const prep = await nfe.preparar(ecolumeId, ped.id, ator);
    focus.emitirNfe.mockResolvedValueOnce({
      mock: true,
      statusHttp: 200,
      body: { status: 'erro_autorizacao', mensagem_sefaz: 'Rejeicao teste fiscal' },
    });
    await nfe.emitir(
      ecolumeId,
      ped.id,
      {
        itens: [{ itemPedidoId: prep.itens[0].itemPedidoId, quantidade: 1 }],
        idempotencyKey: `fis25-rej-${sufixo}`,
      },
      ator,
    );
    const lista = await nfe.listarEmitidas(ecolumeId, ator);
    const rej = lista.find((n) => n.pedidoId === ped.id);
    expect(rej?.status).toBe(StatusNotaFiscal.REJEITADA);
    expect(rej?.mensagemErro).toContain('Rejeicao');
    expect(rej?.arquivoPdfId).toBeNull();
    expect(rej?.simulacao).toBe(true);
    expect(rej?.clienteNome).toContain('Cli FIS');
  }, 60_000);

  it('9+11: rejeitada/cancelada libera; cancelado fora de pendentes', async () => {
    const { ped } = await montarPedido(2);
    const prep = await nfe.preparar(ecolumeId, ped.id, ator);
    const nf = await nfe.emitir(
      ecolumeId,
      ped.id,
      {
        itens: [{ itemPedidoId: prep.itens[0].itemPedidoId, quantidade: 2 }],
        idempotencyKey: `fis25-can-${sufixo}`,
      },
      ator,
    );
    expect(
      (await nfe.listarPendentesEmissao(ecolumeId, ator)).pedidos.find(
        (p) => p.pedidoId === ped.id,
      ),
    ).toBeUndefined();

    await nfe.cancelar(
      ecolumeId,
      nf.id,
      { justificativa: 'Correcao de teste fiscal 25', confirmar: true },
      ator,
    );
    const pend = await nfe.listarPendentesEmissao(ecolumeId, ator);
    expect(pend.pedidos.find((p) => p.pedidoId === ped.id)?.itensPendentes[0].quantidadePendente).toBe(
      2,
    );

    const { ped: ped2 } = await montarPedido(1);
    await pedidos.cancelar(
      ecolumeId,
      ped2.id,
      { motivo: 'Cliente desistiu fiscal', confirmar: true },
      ator,
    );
    const pendC = await nfe.listarPendentesEmissao(ecolumeId, ator);
    expect(pendC.pedidos.find((p) => p.pedidoId === ped2.id)).toBeUndefined();
  }, 90_000);

  it('13+14: legado bloqueado; leitura nao mexe estoque', async () => {
    await expect(
      nfe.listarEmitidas(padraoId, {
        id: usuarioId,
        empresaId: padraoId,
        perfil: PerfilUsuario.PROPRIETARIO,
      }),
    ).rejects.toMatchObject({ codigo: 'NFE_PEDIDO_INDISPONIVEL' });

    const { ped, prod } = await montarPedido(1);
    const movAntes = await operacional.movimentacaoEstoque.count({
      where: { empresaId: ecolumeId, produtoId: prod.id, tipo: TipoMovimentacaoEstoque.SAIDA },
    });
    await nfe.listarPendentesEmissao(ecolumeId, ator);
    await nfe.listarEmitidas(ecolumeId, ator);
    const movDepois = await operacional.movimentacaoEstoque.count({
      where: { empresaId: ecolumeId, produtoId: prod.id, tipo: TipoMovimentacaoEstoque.SAIDA },
    });
    expect(movDepois).toBe(movAntes);
    void ped;
  }, 60_000);
});
