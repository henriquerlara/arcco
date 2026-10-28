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
  TipoAuditoria,
  TipoChecklistPedido,
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
  process.env.ECOL_NFE === '1' ||
  process.env.ECOL_PEDIDO === '1' ||
  process.env.ECOL_CONV === '1';

const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('ECOL-24 NF-e do pedido', () => {
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
    emitirNfe: vi.fn(async (_ref: string, payload: Record<string, unknown>) => ({
      mock: true,
      statusHttp: 200,
      body: {
        status: 'autorizado',
        numero: '9001',
        serie: '1',
        chave_nfe: `MOCK${Date.now()}`.padEnd(44, '0').slice(0, 44),
        protocolo: `MOCK-${Date.now()}`,
        mensagem: 'Emissao simulada',
        _payloadEcho: payload,
      },
    })),
    consultarNfe: vi.fn(async () => ({
      mock: true,
      statusHttp: 200,
      body: { status: 'autorizado', mensagem: 'Consulta mock' },
    })),
    cancelarNfe: vi.fn(async () => ({
      mock: true,
      statusHttp: 200,
      body: { status: 'cancelado', mensagem: 'Cancelamento mock' },
    })),
    baixarArquivo: vi.fn(async () => null),
  };

  const nfe = new NfePedidoService(
    operacional as never,
    platform as never,
    focus as unknown as FocusNfeClient,
    { enviar: async () => ({ id: 'arq-nf' }) } as never,
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
        nome: `NFE24 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        cnpj: '12345678000195',
        inscricaoEstadual: '123456789',
        enderecoFiscal: {
          logradouro: 'Rua Emitente',
          numero: '100',
          bairro: 'Centro',
          municipio: 'Sao Paulo',
          uf: 'SP',
          cep: '01001000',
        },
        configuracoes: {
          personalizacaoComercial: 'ECOLUME',
          onboardingConcluido: true,
          // P3 deliberadamente ausente
        },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `NFE24P ${sufixo}`,
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
        nome: `User NFE ${sufixo}`,
        email: `nfe24-${sufixo}@teste.local`,
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
        nome: `Cliente NFE ${sufixo}`,
        telefone: '11980006001',
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

  async function montarPedido(qtd = 10) {
    const neg = await negocios.criar(
      ecolumeId,
      {
        contatoId: clienteId,
        titulo: `Neg NFE ${randomUUID().slice(0, 6)}`,
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
        nome: `Prod NFE ${sufixo}`,
        nomeFiscal: `Nome fiscal NFE ${sufixo}`,
        unidade: 'un',
        precoVenda: 100,
        controlaEstoque: true,
        estoqueMinimo: 0,
        ativo: true,
        saldoInicial: 50,
        ncm: '94036000',
        origemFiscal: '0',
        cest: '2100100',
      } as never,
      usuarioId,
    );
    const orc = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg.id as string,
      itens: [
        {
          produtoId: prod.id,
          nome: 'Linha comercial',
          quantidade: qtd,
          unidade: 'un',
          precoUnitario: 100,
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
    return { neg, prod, orc, ped };
  }

  it('1-2: preparar usa nome fiscal; descricao editada so na NF', async () => {
    const { ped, prod } = await montarPedido(4);
    const prep = await nfe.preparar(ecolumeId, ped.id, ator);
    expect(prep.emissaoRealHabilitada).toBe(false);
    expect(prep.itens[0].nomeFiscalPadrao).toContain('Nome fiscal');
    expect(prep.pendencias.some((p) => p.codigo === 'P3_PARAMETROS')).toBe(true);

    focus.emitirNfe.mockClear();
    const nf = await nfe.emitir(
      ecolumeId,
      ped.id,
      {
        itens: [
          {
            itemPedidoId: prep.itens[0].itemPedidoId,
            quantidade: 1,
            descricao: 'Descricao so nesta NF',
          },
        ],
        idempotencyKey: `ecol24-desc-${sufixo}`,
      },
      ator,
    );
    expect(nf.status).toBe(StatusNotaFiscal.AUTORIZADA);
    expect(nf.itens?.[0]?.descricao).toBe('Descricao so nesta NF');
    const prodDb = await operacional.produto.findFirstOrThrow({ where: { id: prod.id } });
    expect(prodDb.nomeFiscal).toContain('Nome fiscal');
    const payload = focus.emitirNfe.mock.calls[0]?.[1] as Record<string, unknown>;
    const items = payload.items as Array<Record<string, unknown>>;
    expect(items[0].descricao).toBe('Descricao so nesta NF');
    expect(payload._parametrosInformados).toBe(false);
  }, 90_000);

  it('3-4: parcial + bloqueio acima do vendido', async () => {
    const { ped } = await montarPedido(5);
    const prep = await nfe.preparar(ecolumeId, ped.id, ator);
    const itemId = prep.itens[0].itemPedidoId;

    await nfe.emitir(
      ecolumeId,
      ped.id,
      {
        itens: [{ itemPedidoId: itemId, quantidade: 2 }],
        idempotencyKey: `ecol24-par1-${sufixo}`,
      },
      ator,
    );
    const prep2 = await nfe.preparar(ecolumeId, ped.id, ator);
    expect(prep2.itens[0].quantidadeDisponivel).toBe(3);

    await expect(
      nfe.emitir(
        ecolumeId,
        ped.id,
        {
          itens: [{ itemPedidoId: itemId, quantidade: 9 }],
          idempotencyKey: `ecol24-exc-${sufixo}`,
        },
        ator,
      ),
    ).rejects.toMatchObject({ codigo: 'QUANTIDADE_EXCEDE_DISPONIVEL' });
  }, 90_000);

  it('5: concorrentes sem duplicar faturamento', async () => {
    const { ped } = await montarPedido(2);
    const prep = await nfe.preparar(ecolumeId, ped.id, ator);
    const itemId = prep.itens[0].itemPedidoId;
    const [a, b] = await Promise.allSettled([
      nfe.emitir(
        ecolumeId,
        ped.id,
        {
          itens: [{ itemPedidoId: itemId, quantidade: 2 }],
          idempotencyKey: `ecol24-c1-${sufixo}-${Date.now()}`,
        },
        ator,
      ),
      nfe.emitir(
        ecolumeId,
        ped.id,
        {
          itens: [{ itemPedidoId: itemId, quantidade: 2 }],
          idempotencyKey: `ecol24-c2-${sufixo}-${Date.now()}`,
        },
        ator,
      ),
    ]);
    const ok = [a, b].filter((r) => r.status === 'fulfilled');
    const falha = [a, b].filter((r) => r.status === 'rejected');
    expect(ok.length).toBe(1);
    expect(falha.length).toBe(1);
    const prepF = await nfe.preparar(ecolumeId, ped.id, ator);
    expect(prepF.itens[0].quantidadeDisponivel).toBe(0);
  }, 90_000);

  it('6: validacao CPF/endereco/NCM/P3', async () => {
    const { ped } = await montarPedido(1);
    await operacional.contato.update({
      where: { id: clienteId },
      data: { documento: null, logradouro: null },
    });
    const prep = await nfe.preparar(ecolumeId, ped.id, ator);
    expect(prep.pendencias.some((p) => p.codigo === 'DEST_DOCUMENTO')).toBe(true);
    expect(prep.pendencias.some((p) => p.codigo === 'DEST_ENDERECO')).toBe(true);
    expect(prep.pendencias.some((p) => p.codigo === 'P3_PARAMETROS')).toBe(true);
    // restaura destinatário
    await operacional.contato.update({
      where: { id: clienteId },
      data: {
        documento: '39053344705',
        logradouro: 'Av Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
        cidade: 'Sao Paulo',
        uf: 'SP',
        cep: '01310100',
      },
    });
  }, 60_000);

  it('7-8: rejeicao legivel e processando sem autorizar', async () => {
    const { ped } = await montarPedido(1);
    const prep = await nfe.preparar(ecolumeId, ped.id, ator);
    const itemId = prep.itens[0].itemPedidoId;

    focus.emitirNfe.mockResolvedValueOnce({
      mock: true,
      statusHttp: 200,
      body: { status: 'erro_autorizacao', mensagem_sefaz: 'Rejeicao 999: teste' },
    });
    const rej = await nfe.emitir(
      ecolumeId,
      ped.id,
      {
        itens: [{ itemPedidoId: itemId, quantidade: 1 }],
        idempotencyKey: `ecol24-rej-${sufixo}`,
      },
      ator,
    );
    expect(rej.status).toBe(StatusNotaFiscal.REJEITADA);
    expect(rej.mensagemErro).toContain('Rejeicao');
    const prepApos = await nfe.preparar(ecolumeId, ped.id, ator);
    expect(prepApos.itens[0].quantidadeDisponivel).toBe(1);

    focus.emitirNfe.mockResolvedValueOnce({
      mock: true,
      statusHttp: 200,
      body: { status: 'processando_autorizacao' },
    });
    const proc = await nfe.emitir(
      ecolumeId,
      ped.id,
      {
        itens: [{ itemPedidoId: itemId, quantidade: 1 }],
        idempotencyKey: `ecol24-proc-${sufixo}`,
      },
      ator,
    );
    expect(proc.status).toBe(StatusNotaFiscal.PROCESSANDO);
    expect(proc.autorizadoEm).toBeNull();
  }, 90_000);

  it('9: retentativa idempotente pela mesma ref', async () => {
    const { ped } = await montarPedido(1);
    const prep = await nfe.preparar(ecolumeId, ped.id, ator);
    const key = `ecol24-idemp-${sufixo}`;
    const a = await nfe.emitir(
      ecolumeId,
      ped.id,
      { itens: [{ itemPedidoId: prep.itens[0].itemPedidoId, quantidade: 1 }], idempotencyKey: key },
      ator,
    );
    const b = await nfe.emitir(
      ecolumeId,
      ped.id,
      { itens: [{ itemPedidoId: prep.itens[0].itemPedidoId, quantidade: 1 }], idempotencyKey: key },
      ator,
    );
    expect(a.id).toBe(b.id);
  }, 60_000);

  it('10: DANFE/XML so quando Focus devolve caminho (mock sem arquivo)', async () => {
    const { ped } = await montarPedido(1);
    const prep = await nfe.preparar(ecolumeId, ped.id, ator);
    const nf = await nfe.emitir(
      ecolumeId,
      ped.id,
      {
        itens: [{ itemPedidoId: prep.itens[0].itemPedidoId, quantidade: 1 }],
        idempotencyKey: `ecol24-docs-${sufixo}`,
      },
      ator,
    );
    expect(nf.arquivoPdfId).toBeNull();
    expect(nf.arquivoXmlId).toBeNull();
  }, 60_000);

  it('11: checklist NF so com cobertura autorizada integral', async () => {
    const { ped } = await montarPedido(4);
    const prep = await nfe.preparar(ecolumeId, ped.id, ator);
    const itemId = prep.itens[0].itemPedidoId;
    await nfe.emitir(
      ecolumeId,
      ped.id,
      {
        itens: [{ itemPedidoId: itemId, quantidade: 2 }],
        idempotencyKey: `ecol24-chk1-${sufixo}`,
      },
      ator,
    );
    let pedDb = await operacional.pedido.findFirstOrThrow({
      where: { id: ped.id },
      include: { checklist: true },
    });
    const nfItem = pedDb.checklist.find((c) => c.tipo === TipoChecklistPedido.NF_EMITIDA)!;
    expect(nfItem.concluido).toBe(false);

    // conclui demais itens manuais para testar finalização só quando NF completa
    for (const c of pedDb.checklist.filter((x) => x.aplicavel && x.tipo !== TipoChecklistPedido.NF_EMITIDA)) {
      await operacional.checklistItemPedido.update({
        where: { id: c.id },
        data: { concluido: true, concluidoEm: new Date(), usuarioId },
      });
    }

    await nfe.emitir(
      ecolumeId,
      ped.id,
      {
        itens: [{ itemPedidoId: itemId, quantidade: 2 }],
        idempotencyKey: `ecol24-chk2-${sufixo}`,
      },
      ator,
    );
    pedDb = await operacional.pedido.findFirstOrThrow({
      where: { id: ped.id },
      include: { checklist: true },
    });
    expect(pedDb.checklist.find((c) => c.tipo === TipoChecklistPedido.NF_EMITIDA)!.concluido).toBe(
      true,
    );
    expect(pedDb.status).toBe(StatusPedido.FINALIZADO);
  }, 90_000);

  it('12: cancelamento fiscal libera cobertura e ECOL-18', async () => {
    const { ped } = await montarPedido(1);
    const prep = await nfe.preparar(ecolumeId, ped.id, ator);
    const nf = await nfe.emitir(
      ecolumeId,
      ped.id,
      {
        itens: [{ itemPedidoId: prep.itens[0].itemPedidoId, quantidade: 1 }],
        idempotencyKey: `ecol24-can-${sufixo}`,
      },
      ator,
    );
    await expect(
      pedidos.cancelar(
        ecolumeId,
        ped.id,
        { motivo: 'Bloqueado por NF', confirmar: true },
        ator,
      ),
    ).rejects.toMatchObject({ codigo: 'NF_AUTORIZADA_BLOQUEIA_CANCELAMENTO' });

    await nfe.cancelar(
      ecolumeId,
      nf.id,
      { justificativa: 'Erro de digitacao na nota fiscal', confirmar: true },
      ator,
    );
    const prep2 = await nfe.preparar(ecolumeId, ped.id, ator);
    expect(prep2.itens[0].quantidadeDisponivel).toBe(1);

    const logs = await operacional.logAuditoria.findMany({
      where: { empresaId: ecolumeId, tipo: TipoAuditoria.CANCELAMENTO_NF },
    });
    expect(logs.length).toBeGreaterThan(0);
  }, 90_000);

  it('13: emissao nao gera nova saida de estoque', async () => {
    const { ped, prod } = await montarPedido(2);
    const antes = await operacional.movimentacaoEstoque.count({
      where: {
        empresaId: ecolumeId,
        produtoId: prod.id,
        tipo: TipoMovimentacaoEstoque.SAIDA,
      },
    });
    const prep = await nfe.preparar(ecolumeId, ped.id, ator);
    await nfe.emitir(
      ecolumeId,
      ped.id,
      {
        itens: [{ itemPedidoId: prep.itens[0].itemPedidoId, quantidade: 2 }],
        idempotencyKey: `ecol24-est-${sufixo}`,
      },
      ator,
    );
    const depois = await operacional.movimentacaoEstoque.count({
      where: {
        empresaId: ecolumeId,
        produtoId: prod.id,
        tipo: TipoMovimentacaoEstoque.SAIDA,
      },
    });
    expect(depois).toBe(antes);
  }, 60_000);

  it('14: legado / nao-ecolume bloqueado', async () => {
    await expect(
      nfe.preparar(padraoId, randomUUID(), {
        id: usuarioId,
        empresaId: padraoId,
        perfil: PerfilUsuario.PROPRIETARIO,
      }),
    ).rejects.toMatchObject({ codigo: 'NFE_PEDIDO_INDISPONIVEL' });
  }, 30_000);

  it('15: timeout consulta antes de reenviar (idempotency)', async () => {
    const { ped } = await montarPedido(1);
    const prep = await nfe.preparar(ecolumeId, ped.id, ator);
    const key = `ecol24-to-${sufixo}`;
    focus.emitirNfe.mockRejectedValueOnce(new Error('timeout rede'));
    focus.consultarNfe.mockResolvedValueOnce({
      mock: true,
      statusHttp: 200,
      body: {
        status: 'autorizado',
        numero: '777',
        serie: '1',
        chave_nfe: '1'.repeat(44),
        mensagem: 'Recuperado via consulta',
      },
    });
    const nf = await nfe.emitir(
      ecolumeId,
      ped.id,
      {
        itens: [{ itemPedidoId: prep.itens[0].itemPedidoId, quantidade: 1 }],
        idempotencyKey: key,
      },
      ator,
    );
    expect(nf.status).toBe(StatusNotaFiscal.AUTORIZADA);
    expect(focus.consultarNfe).toHaveBeenCalled();
    const again = await nfe.emitir(
      ecolumeId,
      ped.id,
      {
        itens: [{ itemPedidoId: prep.itens[0].itemPedidoId, quantidade: 1 }],
        idempotencyKey: key,
      },
      ator,
    );
    expect(again.id).toBe(nf.id);
  }, 60_000);
});
