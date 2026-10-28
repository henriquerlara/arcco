/**
 * ECOL-28 — Roteiro da seção 17 (PDF), massa isolada.
 * Flag: ECOL_ROTEIRO=1 (ou ECOL_CONV=1).
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient, StatusNotaFiscal } from '@prisma/client';
import {
  ChaveEtapaSistema,
  FaseKanbanPedido,
  ModeloPagamentoPedido,
  NaturezaPessoa,
  OrigemNegocio,
  PerfilUsuario,
  PrioridadeOportunidade,
  StatusComissaoPedido,
  StatusOrcamento,
  StatusPedido,
  TipoAtividade,
  TipoChecklistPedido,
  TipoContato,
  TipoParceiro,
} from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { ArquivosService } from '../arquivos/arquivos.service';
import { LocalStorageProvider } from '../arquivos/local.provider';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AtividadesService } from '../atividades/atividades.service';
import { FollowUpsService } from '../atividades/follow-ups.service';
import { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';
import { ContatosService } from '../contatos/contatos.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { EmpresasService } from '../empresas/empresas.service';
import { EventosService } from '../eventos/eventos.service';
import type { FocusNfeClient } from '../fiscal/focus-nfe.client';
import { NfePedidoService } from '../fiscal/nfe-pedido.service';
import { FornecedoresService } from '../fornecedores/fornecedores.service';
import { montarNfeXml } from '../notas-entrada/fixtures/nfe-sintetica';
import { NotasEntradaService } from '../notas-entrada/notas-entrada.service';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { OrcamentosService } from '../orcamentos/orcamentos.service';
import { extrairTextoPdf } from '../orcamentos/pdf-orcamento';
import { PedidosService } from '../pedidos/pedidos.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ProdutosService } from '../produtos/produtos.service';

const ATIVO = process.env.ECOL_ROTEIRO === '1' || process.env.ECOL_CONV === '1';
const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];
const CNPJ_STELLA = '11222333000181';

describe.skipIf(!ATIVO)('ECOL-28 Roteiro §17', () => {
  const auditoria = new AuditoriaService(platform as never, operacional as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const campos = new CamposPersonalizadosService(operacional as never);
  const contatos = new ContatosService(operacional as never, platform as never, campos, permissoes);
  const eventos = new EventosService(operacional as never);
  const produtos = new ProdutosService(operacional as never, auditoria, permissoes);
  const fornecedores = new FornecedoresService(operacional as never, permissoes, auditoria);
  const negocios = new OportunidadesService(
    operacional as never,
    platform as never,
    campos,
    eventos,
    produtos,
    permissoes,
    contatos,
  );
  const storage = new LocalStorageProvider();
  const arquivos = new ArquivosService(operacional as never, storage);
  const orcamentos = new OrcamentosService(
    operacional as never,
    platform as never,
    arquivos,
    produtos,
    permissoes,
    {} as never,
  );
  const pedidos = new PedidosService(operacional as never, permissoes, produtos, auditoria);
  const notasEntrada = new NotasEntradaService(
    operacional as never,
    permissoes,
    auditoria,
    arquivos,
  );
  const atividades = new AtividadesService(operacional as never, eventos, permissoes);
  const followUps = new FollowUpsService(
    operacional as never,
    platform as never,
    eventos,
    permissoes,
  );
  const dashboard = new DashboardService(
    operacional as never,
    platform as never,
    followUps,
    permissoes,
  );
  const empresasSvc = new EmpresasService(platform as never, operacional as never, auditoria);
  const focus = {
    configurado: () => false,
    ambiente: () => 'homologacao' as const,
    emitirNfe: vi.fn(async () => ({
      mock: true,
      statusHttp: 200,
      body: {
        status: 'autorizado',
        numero: '17001',
        serie: '1',
        chave_nfe: `R17${Date.now()}`.padEnd(44, '0').slice(0, 44),
        protocolo: `R17-${Date.now()}`,
        mensagem: 'Simulado §17',
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
    arquivos,
    empresasSvc,
    permissoes,
    auditoria,
  );

  let ecolumeId = '';
  let usuarioId = '';
  let ator = { id: '', perfil: PerfilUsuario.PROPRIETARIO as string, empresaId: '' };
  let anaId = '';
  let joaoId = '';
  let fitaId = '';
  let perfilId = '';
  let negId = '';
  let orc1Id = '';
  let orc2Id = '';
  let ped1Id = '';

  beforeAll(async () => {
    const eco = await platform.empresa.create({
      data: {
        nome: `R17 ${sufixo}`,
        segmento: 'ILUMINACAO',
        databaseName: 'db_empresa_arcco',
        cnpj: '12345678000195',
        inscricaoEstadual: '123456789',
        enderecoFiscal: {
          logradouro: 'Rua Emitente',
          numero: '10',
          bairro: 'Centro',
          municipio: 'Sao Paulo',
          uf: 'SP',
          cep: '01001000',
        },
        configuracoes: {
          personalizacaoComercial: 'ECOLUME',
          onboardingConcluido: true,
          regimeTributario: 'SIMPLES',
          cfopPadrao: '5102',
          csosnPadrao: '102',
          naturezaOperacao: 'Venda',
        },
      },
    });
    empresas.push(eco.id);
    ecolumeId = eco.id;
    const user = await platform.usuario.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Admin R17',
        email: `r17.${sufixo}@teste.arcco.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    usuarioId = user.id;
    ator = { id: usuarioId, perfil: PerfilUsuario.PROPRIETARIO, empresaId: ecolumeId };

    for (const e of [
      { chave: ChaveEtapaSistema.NOVO_CONTATO, nome: 'Novo contato', ordem: 1 },
      { chave: ChaveEtapaSistema.ORCAMENTO_ENVIADO, nome: 'Orçamento enviado', ordem: 2 },
    ]) {
      const existe = await operacional.etapaFunil.findFirst({
        where: { empresaId: ecolumeId, chaveSistema: e.chave },
      });
      if (!existe) {
        await operacional.etapaFunil.create({
          data: {
            empresaId: ecolumeId,
            nome: e.nome,
            ordem: e.ordem,
            tipo: 'ABERTA',
            chaveSistema: e.chave,
            ativo: true,
          },
        });
      }
    }
  }, 90_000);

  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.itemNotaFiscal.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.notaFiscal.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.itemNotaEntrada.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.notaEntrada.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.atividade.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.checklistItemPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.pagamentoPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.comissaoPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.historicoFasePedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.itemPedido.deleteMany({ where: { pedido: { empresaId } } }).catch(() => undefined);
      await operacional.pedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.itemOrcamento.deleteMany({ where: { orcamento: { empresaId } } }).catch(() => undefined);
      await operacional.orcamento.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.movimentacaoEstoque.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.oportunidade.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.produto.updateMany({ where: { empresaId }, data: { fornecedorId: null } });
      await operacional.produto.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.fornecedor.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.contato.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.arquivo.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.logAuditoria.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.etapaFunil.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.logAuditoria.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.usuario.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  }, 120_000);

  it('passos 1–12 do PDF com valores oficiais', async () => {
    // 1. Cadastros
    anaId = (
      await contatos.criar(ecolumeId, {
        nome: 'Ana Souza',
        telefone: '11971001001',
        natureza: NaturezaPessoa.PF,
        tipo: TipoContato.OUTRO,
        ehParceiro: true,
        tipoParceiro: TipoParceiro.ARQUITETO_DESIGNER,
        rtPadrao: 10,
        dadosPersonalizados: {},
      })
    ).id as string;
    joaoId = (
      await contatos.criar(ecolumeId, {
        nome: 'João Pereira',
        telefone: '11971001002',
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

    const stella = await fornecedores.criar(ecolumeId, {
      nome: 'Stella LED LTDA',
      nomeCurto: 'Stella',
      cnpj: CNPJ_STELLA,
      aliquotaSt: 30,
    });
    await fornecedores.criar(ecolumeId, {
      nome: 'Fornecedor B LTDA',
      nomeCurto: 'B',
      cnpj: '34028316000103',
      aliquotaSt: 0,
    });

    const fitaBase = await produtos.criar(
      ecolumeId,
      {
        nome: 'Fita LED Stella',
        descricaoComercial: 'Descrição comercial Stella editada',
        unidade: 'un',
        precoVenda: 0,
        controlaEstoque: true,
        estoqueMinimo: 0,
        ativo: true,
        codigoFornecedor: 'FITA-STELLA',
        saldoInicial: 3,
      } as never,
      usuarioId,
    );
    await operacional.produto.update({
      where: { id: fitaBase.id },
      data: {
        fornecedorId: stella.id,
        ipi: 10,
        margem: 1.6,
        ultimoPreco: 120,
        ncm: '94054010',
        origemFiscal: '0',
        nomeFiscal: 'Fita LED Stella fiscal',
      },
    });
    fitaId = fitaBase.id;
    const perfilBase = await produtos.criar(
      ecolumeId,
      {
        nome: 'Perfil alumínio',
        descricaoComercial: 'Perfil comercial',
        unidade: 'un',
        precoVenda: 0,
        controlaEstoque: true,
        estoqueMinimo: 0,
        ativo: true,
        saldoInicial: 25,
      } as never,
      usuarioId,
    );
    await operacional.produto.update({
      where: { id: perfilBase.id },
      data: {
        ipi: 0,
        margem: 1.6,
        ultimoPreco: 56.7,
        ncm: '76042100',
        origemFiscal: '0',
        nomeFiscal: 'Perfil aluminio fiscal',
      },
    });
    perfilId = perfilBase.id;
    expect(fitaBase.estoqueAtual).toBe(3);
    expect(perfilBase.estoqueAtual).toBe(25);

    // 2. NEG
    const neg = await negocios.criar(
      ecolumeId,
      {
        titulo: 'Projeto João',
        contatoId: joaoId,
        parceiroId: anaId,
        rtNegocio: 10,
        origemNegocio: OrigemNegocio.VIA_PARCEIRO,
        prioridade: PrioridadeOportunidade.MEDIA,
        responsavelId: usuarioId,
        dadosPersonalizados: {},
      } as never,
      { usuarioId },
    );
    negId = neg.id as string;
    expect(neg.codigo).toMatch(/^NEG-\d{4}$/);
    const etapa = await operacional.etapaFunil.findFirstOrThrow({
      where: { id: neg.etapaId as string },
    });
    expect(etapa.chaveSistema).toBe(ChaveEtapaSistema.NOVO_CONTATO);

    // 3. ORC-0001
    const orc1 = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: negId,
      itens: [
        { produtoId: fitaId, nome: 'Descrição comercial Stella editada', quantidade: 5, unidade: 'un' },
        { produtoId: perfilId, nome: 'Perfil comercial', quantidade: 6, unidade: 'un' },
      ],
    });
    orc1Id = orc1.id;
    const itens1 = orc1.itens as Array<{ precoUnitario: number; nome: string }>;
    expect(itens1.find((i) => i.nome.includes('Stella'))!.precoUnitario).toBeCloseTo(274.56, 2);
    expect(itens1.find((i) => i.nome.includes('Perfil'))!.precoUnitario).toBeCloseTo(90.72, 2);
    expect(Number(orc1.total)).toBeCloseTo(1917.12, 2);

    // 4. PDF + enviado + bloqueio
    const comPdf = await orcamentos.gerarPdf(ecolumeId, orc1Id, usuarioId);
    const arquivoId = (comPdf as { arquivoId?: string }).arquivoId!;
    const { buffer } = await arquivos.conteudo(ecolumeId, arquivoId);
    const textoPdf = extrairTextoPdf(buffer);
    expect(textoPdf).toMatch(/274[,.]56/);
    expect(textoPdf.toLowerCase()).not.toMatch(/custo medio|custo médio|\bipi\b|\bmargem\b/);
    await orcamentos.marcarEnviado(ecolumeId, orc1Id);
    await expect(
      orcamentos.atualizar(ecolumeId, orc1Id, {
        itens: [{ nome: 'x', quantidade: 1, precoUnitario: 1, unidade: 'un', precoManual: true }],
      }),
    ).rejects.toMatchObject({ codigo: 'ORCAMENTO_BLOQUEADO' });

    // 5. Duplicar → 4 fitas = 1642,56
    const orc2 = await orcamentos.duplicar(ecolumeId, usuarioId, orc1Id);
    orc2Id = orc2.id;
    await orcamentos.atualizar(ecolumeId, orc2Id, {
      itens: [
        {
          produtoId: fitaId,
          nome: 'Descrição comercial Stella editada',
          quantidade: 4,
          unidade: 'un',
          precoUnitario: 274.56,
          precoManual: true,
        },
        {
          produtoId: perfilId,
          nome: 'Perfil comercial',
          quantidade: 6,
          unidade: 'un',
          precoUnitario: 90.72,
          precoManual: true,
        },
      ],
    });
    const orc2Db = await operacional.orcamento.findFirstOrThrow({ where: { id: orc2Id } });
    expect(Number(orc2Db.total)).toBeCloseTo(1642.56, 2);
    expect(orc2Db.orcamentoOrigemId).toBe(orc1Id);

    // 6. Converter
    const ped1 = await pedidos.converter(
      ecolumeId,
      {
        orcamentoId: orc2Id,
        modeloPagamento: ModeloPagamentoPedido.SINAL_RESTANTE_ENTREGA,
        percentualSinal: 50,
        orcamentosSubstituirIds: [orc1Id],
      },
      ator,
    );
    ped1Id = ped1.id;
    expect(ped1.pagamentos).toHaveLength(2);
    expect(Number(ped1.pagamentos![0]!.valor)).toBeCloseTo(821.28, 2);
    expect(Number(ped1.pagamentos![1]!.valor)).toBeCloseTo(821.28, 2);
    expect(ped1.comissao?.valorComissao).toBeCloseTo(164.26, 2);
    expect(
      (await operacional.orcamento.findFirstOrThrow({ where: { id: orc1Id } })).status,
    ).toBe(StatusOrcamento.SUBSTITUIDO);
    expect((await operacional.produto.findFirstOrThrow({ where: { id: fitaId } })).estoqueAtual).toBe(
      -1,
    );
    expect(
      (await operacional.produto.findFirstOrThrow({ where: { id: perfilId } })).estoqueAtual,
    ).toBe(19);

    // 7. XML 10×125
    const chave = `3526101122233300018155001${String(Date.now()).slice(-10)}`.padEnd(44, '0').slice(0, 44);
    const xml = montarNfeXml({
      chave,
      cnpjEmit: CNPJ_STELLA,
      nomeEmit: 'Stella LED LTDA',
      vNF: 1250,
      itens: [
        {
          nItem: 1,
          cProd: 'FITA-STELLA',
          xProd: 'Fita LED Stella',
          qCom: 10,
          vUnCom: 125,
          NCM: '94054010',
        },
      ],
    });
    const preview = await notasEntrada.previsualizar(ecolumeId, xml, ator);
    expect(preview.itens[0]!.acaoSugerida).toMatch(/reconhecido|vincular/);
    await notasEntrada.confirmar(
      ecolumeId,
      {
        xml,
        itens: [
          {
            numeroItem: 1,
            acao: preview.itens[0]!.acaoSugerida === 'reconhecido' ? 'reconhecido' : 'vincular',
            produtoId: fitaId,
          },
        ],
      },
      ator,
    );
    const fitaEntrada = await operacional.produto.findFirstOrThrow({ where: { id: fitaId } });
    expect(fitaEntrada.estoqueAtual).toBe(9);
    expect(Number(fitaEntrada.ultimoPreco)).toBeCloseTo(125, 2);
    expect(Number(fitaEntrada.custoMedio)).toBeCloseTo(125, 2);

    // 8. Checklist + kanban + entrega
    const pedCompleto = await pedidos.obter(ecolumeId, ped1Id);
    const chkComprados = pedCompleto.checklist!.find(
      (c) => c.tipo === TipoChecklistPedido.ITENS_COMPRADOS,
    )!;
    const chkSep = pedCompleto.checklist!.find(
      (c) => c.tipo === TipoChecklistPedido.MATERIAL_SEPARADO,
    )!;
    await pedidos.marcarChecklist(ecolumeId, ped1Id, chkComprados.id, { concluido: true }, ator);
    await pedidos.marcarChecklist(ecolumeId, ped1Id, chkSep.id, { concluido: true }, ator);
    await pedidos.moverKanban(
      ecolumeId,
      ped1Id,
      { faseKanban: FaseKanbanPedido.PRONTO_ENTREGA },
      ator,
    );
    const sug = await atividades.sugerirEntrega(ecolumeId, ped1Id);
    const entrega = await atividades.criar(ecolumeId, usuarioId, {
      tipo: TipoAtividade.ENTREGA,
      titulo: 'Entrega João',
      vencimento: new Date(),
      pedidoId: ped1Id,
      entregaLogradouro: sug.endereco.logradouro ?? 'Av Paulista',
      entregaCidade: sug.endereco.cidade ?? 'Sao Paulo',
      entregaUf: sug.endereco.uf ?? 'SP',
      contatoLocalTelefone: sug.contatoLocalTelefone ?? '11971001002',
    });

    // 9. NF-e integral (mock Focus)
    const prep = await nfe.preparar(ecolumeId, ped1Id, ator);
    await nfe.emitir(
      ecolumeId,
      ped1Id,
      {
        itens: prep.itens.map((i) => ({
          itemPedidoId: i.itemPedidoId,
          quantidade: i.quantidadeDisponivel,
        })),
        idempotencyKey: `r17-nf-${sufixo}`,
      },
      ator,
    );
    const nf = await operacional.notaFiscal.findFirst({
      where: { empresaId: ecolumeId, pedidoId: ped1Id },
    });
    expect(nf?.status).toBe(StatusNotaFiscal.AUTORIZADA);
    expect(
      (
        await operacional.checklistItemPedido.findFirst({
          where: { pedidoId: ped1Id, tipo: TipoChecklistPedido.NF_EMITIDA },
        })
      )?.concluido,
    ).toBe(true);

    // 10. Entrega final + pagamentos + checklist de pagamento
    await atividades.concluirEntrega(ecolumeId, entrega.id, { final: true }, usuarioId);
    const pags = await operacional.pagamentoPedido.findMany({ where: { pedidoId: ped1Id } });
    for (const p of pags) {
      if (p.status !== 'RECEBIDO') {
        await pedidos.marcarPagamentoRecebido(ecolumeId, ped1Id, p.id, {}, ator);
      }
    }
    const pedAposPag = await pedidos.obter(ecolumeId, ped1Id);
    const chkPag = pedAposPag.checklist!.find(
      (c) => c.tipo === TipoChecklistPedido.PAGAMENTO_RECEBIDO,
    )!;
    if (!chkPag.concluido) {
      await pedidos.marcarChecklist(ecolumeId, ped1Id, chkPag.id, { concluido: true }, ator);
    }

    // 11. Comissão → FINALIZADO
    await pedidos.marcarComissaoPaga(ecolumeId, ped1Id, ator, 'PIX');
    expect(
      (await operacional.pedido.findFirstOrThrow({ where: { id: ped1Id } })).status,
    ).toBe(StatusPedido.FINALIZADO);
    expect(
      (await operacional.comissaoPedido.findFirstOrThrow({ where: { pedidoId: ped1Id } })).status,
    ).toBe(StatusComissaoPedido.PAGA);
    const checks = await operacional.checklistItemPedido.findMany({
      where: { pedidoId: ped1Id, aplicavel: true },
    });
    expect(checks.every((c) => c.concluido)).toBe(true);

    // Dashboard no mês do 1º fechamento
    const m = await dashboard.metricas(ecolumeId, { chave: 'mes' }, ator);
    expect(m.modo).toBe('ecolume');
    const ind = (m as { indicadores: Record<string, number> }).indicadores;
    expect(ind.faturamento).toBeCloseTo(1642.56, 2);
    expect(ind.vendasConcluidas).toBe(1);
    expect(ind.ticketMedio).toBeCloseTo(1642.56, 2);
    const ana = (m as { parceiros: Array<Record<string, unknown>> }).parceiros.find(
      (p) => p.nome === 'Ana Souza',
    );
    expect(ana?.quantidadePedidos).toBe(1);
    expect(Number(ana?.comissaoGerada)).toBeCloseTo(164.26, 2);

    // 12. PED-0002 no mesmo NEG
    const orc3 = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: negId,
      itens: [
        {
          produtoId: perfilId,
          nome: 'Perfil comercial',
          quantidade: 1,
          unidade: 'un',
          precoUnitario: 90.72,
          precoManual: true,
        },
      ],
    });
    const ped2 = await pedidos.converter(
      ecolumeId,
      {
        orcamentoId: orc3.id,
        modeloPagamento: ModeloPagamentoPedido.PIX_AVISTA,
        orcamentosSubstituirIds: [],
      },
      ator,
    );
    expect(ped2.id).not.toBe(ped1Id);
    const ped1Intact = await operacional.pedido.findFirstOrThrow({ where: { id: ped1Id } });
    expect(ped1Intact.status).toBe(StatusPedido.FINALIZADO);
    expect(Number(ped1Intact.total)).toBeCloseTo(1642.56, 2);
  }, 180_000);
});
