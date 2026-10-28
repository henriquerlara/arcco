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
  TipoAuditoria,
  TipoContato,
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

describe.skipIf(!ATIVO)('ECOL-28b CC-e + e-mail DANFE (mock Focus)', () => {
  const auditoria = new AuditoriaService(platform as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const campos = new CamposPersonalizadosService(operacional as never);
  const contatos = new ContatosService(operacional as never, platform as never, campos, permissoes);
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
        numero: '9101',
        serie: '1',
        chave_nfe: `MOCK${Date.now()}`.padEnd(44, '0').slice(0, 44),
        protocolo: `MOCK-${Date.now()}`,
        mensagem: 'Emissao simulada',
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
      body: { status: 'cancelado', mensagem: 'Cancelamento mock' },
    })),
    cartaCorrecao: vi.fn(async (_ref: string, _texto: string) => ({
      mock: true,
      statusHttp: 200,
      body: { status: 'autorizado', numero_carta_correcao: 1, mensagem: 'CC-e simulada' },
    })),
    enviarEmail: vi.fn(async (_ref: string, emails: string[]) => ({
      mock: true,
      statusHttp: 200,
      body: { status: 'ok', mensagem: 'E-mail simulado (token ausente)', emails },
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
  let outraId = '';
  let usuarioId = '';
  let clienteId = '';
  let clienteOutraId = '';
  let ator = { id: '', empresaId: '', perfil: PerfilUsuario.PROPRIETARIO as string };
  let atorOutra = { id: '', empresaId: '', perfil: PerfilUsuario.PROPRIETARIO as string };

  const configBase = {
    personalizacaoComercial: 'ECOLUME',
    onboardingConcluido: true,
  };

  beforeAll(async () => {
    const enderecoFiscal = {
      logradouro: 'Rua Emitente',
      numero: '100',
      bairro: 'Centro',
      municipio: 'Sao Paulo',
      uf: 'SP',
      cep: '01001000',
    };
    const [ecolume, padrao, outra] = await Promise.all([
      platform.empresa.create({
        data: {
          nome: `CCE28B ${sufixo}`,
          segmento: 'OUTRO',
          databaseName: 'db_empresa_arcco',
          cnpj: '12345678000195',
          inscricaoEstadual: '123456789',
          enderecoFiscal,
          configuracoes: configBase,
        },
      }),
      platform.empresa.create({
        data: {
          nome: `CCE28BP ${sufixo}`,
          segmento: 'OUTRO',
          databaseName: 'db_empresa_arcco',
          configuracoes: { onboardingConcluido: true },
        },
      }),
      platform.empresa.create({
        data: {
          nome: `CCE28BO ${sufixo}`,
          segmento: 'OUTRO',
          databaseName: 'db_empresa_arcco',
          cnpj: '12345678000195',
          enderecoFiscal,
          configuracoes: configBase,
        },
      }),
    ]);
    empresas.push(ecolume.id, padrao.id, outra.id);
    ecolumeId = ecolume.id;
    padraoId = padrao.id;
    outraId = outra.id;

    const user = await platform.usuario.create({
      data: {
        empresaId: ecolumeId,
        nome: `User CCE ${sufixo}`,
        email: `cce28b-${sufixo}@teste.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    const userOutra = await platform.usuario.create({
      data: {
        empresaId: outraId,
        nome: `User CCE O ${sufixo}`,
        email: `cce28bo-${sufixo}@teste.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    usuarioId = user.id;
    ator = { id: usuarioId, empresaId: ecolumeId, perfil: PerfilUsuario.PROPRIETARIO };
    atorOutra = { id: userOutra.id, empresaId: outraId, perfil: PerfilUsuario.PROPRIETARIO };

    for (const empresaId of [ecolumeId, padraoId, outraId]) {
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

    const novoCliente = (empresaId: string, nome: string, extra: object = {}) =>
      contatos.criar(empresaId, {
        nome,
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
        ...extra,
      } as never);
    clienteId = (
      await novoCliente(ecolumeId, `Cliente CCE ${sufixo}`, { email: `cliente-${sufixo}@teste.local` })
    ).id as string;
    clienteOutraId = (await novoCliente(outraId, `Cliente CCE O ${sufixo}`)).id as string;
  }, 90_000);

  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.eventoNotaFiscal.deleteMany({ where: { empresaId } }).catch(() => undefined);
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

  async function montarPedido(empresaId = ecolumeId, contatoId = clienteId, a = ator, qtd = 2) {
    const neg = await negocios.criar(
      empresaId,
      {
        contatoId,
        titulo: `Neg CCE ${randomUUID().slice(0, 6)}`,
        origemNegocio: OrigemNegocio.CLIENTE_DIRETO,
        responsavelId: a.id,
        prioridade: PrioridadeOportunidade.MEDIA,
        dadosPersonalizados: {},
      },
      { usuarioId: a.id },
    );
    const prod = await produtos.criar(
      empresaId,
      {
        nome: `Prod CCE ${randomUUID().slice(0, 6)}`,
        nomeFiscal: `Nome fiscal CCE ${sufixo}`,
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
      a.id,
    );
    const orc = await orcamentos.criar(empresaId, a.id, {
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
    return pedidos.converter(
      empresaId,
      { orcamentoId: orc.id, modeloPagamento: ModeloPagamentoPedido.PIX_AVISTA, orcamentosSubstituirIds: [] },
      a,
    );
  }

  async function emitirAutorizada(empresaId = ecolumeId, contatoId = clienteId, a = ator) {
    const ped = await montarPedido(empresaId, contatoId, a, 1);
    const prep = await nfe.preparar(empresaId, ped.id, a);
    const nf = await nfe.emitir(
      empresaId,
      ped.id,
      {
        itens: [{ itemPedidoId: prep.itens[0].itemPedidoId, quantidade: 1 }],
        idempotencyKey: `ecol28b-${randomUUID()}`,
      },
      a,
    );
    expect(nf.status).toBe(StatusNotaFiscal.AUTORIZADA);
    return { ped, nf };
  }

  const TEXTO = 'Correcao do endereco do destinatario conforme cadastro.';

  it('CC-e em AUTORIZADA (mock): evento + auditoria + sequência', async () => {
    const { nf } = await emitirAutorizada();
    focus.cartaCorrecao.mockClear();

    const r1 = await nfe.cartaCorrecao(ecolumeId, nf.id, { correcao: TEXTO }, ator);
    expect(r1.cartaCorrecaoSuportada).toBe(true);
    expect(r1.mock).toBe(true);
    expect(r1.evento.tipo).toBe('CCE');
    expect(r1.evento.status).toBe('AUTORIZADO');
    expect(r1.evento.numeroSequencia).toBe(1);
    expect(r1.evento.mock).toBe(true);
    expect(r1.evento.texto).toBe(TEXTO);
    expect(focus.cartaCorrecao).toHaveBeenCalledWith(nf.refFocus, TEXTO);

    const r2 = await nfe.cartaCorrecao(
      ecolumeId,
      nf.id,
      { correcao: `${TEXTO} Segunda correcao.` },
      ator,
    );
    expect(r2.evento.numeroSequencia).toBe(2);

    const logs = await operacional.logAuditoria.findMany({
      where: {
        empresaId: ecolumeId,
        tipo: TipoAuditoria.CARTA_CORRECAO_NF,
        entidadeId: nf.id,
      },
    });
    expect(logs).toHaveLength(2);
    expect(JSON.stringify(logs)).not.toMatch(/token|senha|certificado/i);

    const eventosDb = await operacional.eventoNotaFiscal.findMany({
      where: { empresaId: ecolumeId, notaFiscalId: nf.id, tipo: 'CCE' },
    });
    expect(eventosDb).toHaveLength(2);
  }, 120_000);

  it('CC-e rejeita RASCUNHO, CANCELADA, texto curto e sem permissão', async () => {
    const { ped, nf } = await emitirAutorizada();

    await expect(
      nfe.cartaCorrecao(ecolumeId, nf.id, { correcao: 'curto' }, ator),
    ).rejects.toMatchObject({ codigo: 'CCE_TEXTO_INVALIDO' });
    await expect(
      nfe.cartaCorrecao(ecolumeId, nf.id, { correcao: 'x'.repeat(1001) }, ator),
    ).rejects.toMatchObject({ codigo: 'CCE_TEXTO_INVALIDO' });

    // GESTOR sem concessão não possui CARTA_CORRECAO
    await expect(
      nfe.cartaCorrecao(
        ecolumeId,
        nf.id,
        { correcao: TEXTO },
        { id: randomUUID(), empresaId: ecolumeId, perfil: PerfilUsuario.GESTOR },
      ),
    ).rejects.toMatchObject({ codigo: 'SEM_PERMISSAO' });

    const rascunho = await operacional.notaFiscal.create({
      data: {
        empresaId: ecolumeId,
        orcamentoId: ped.orcamentoId,
        oportunidadeId: ped.oportunidadeId,
        pedidoId: ped.id,
        status: StatusNotaFiscal.RASCUNHO,
        refFocus: `rasc-${randomUUID()}`,
      },
    });
    await expect(
      nfe.cartaCorrecao(ecolumeId, rascunho.id, { correcao: TEXTO }, ator),
    ).rejects.toMatchObject({ codigo: 'NF_NAO_AUTORIZADA' });

    await nfe.cancelar(
      ecolumeId,
      nf.id,
      { justificativa: 'Cancelamento para teste de CC-e', confirmar: true },
      ator,
    );
    await expect(
      nfe.cartaCorrecao(ecolumeId, nf.id, { correcao: TEXTO }, ator),
    ).rejects.toMatchObject({ codigo: 'NF_NAO_AUTORIZADA' });
  }, 120_000);

  it('CC-e rejeitada pelo emissor persiste REJEITADO sem auditoria', async () => {
    const { nf } = await emitirAutorizada();
    focus.cartaCorrecao.mockResolvedValueOnce({
      mock: true,
      statusHttp: 200,
      body: { status: 'erro_autorizacao', mensagem_sefaz: 'Rejeicao 573: teste' },
    });
    await expect(
      nfe.cartaCorrecao(ecolumeId, nf.id, { correcao: TEXTO }, ator),
    ).rejects.toMatchObject({ codigo: 'CCE_NAO_AUTORIZADA' });
    const ev = await operacional.eventoNotaFiscal.findMany({
      where: { empresaId: ecolumeId, notaFiscalId: nf.id },
    });
    expect(ev).toHaveLength(1);
    expect(ev[0].status).toBe('REJEITADO');
    expect(ev[0].numeroSequencia).toBeNull();
    const logs = await operacional.logAuditoria.count({
      where: { empresaId: ecolumeId, tipo: TipoAuditoria.CARTA_CORRECAO_NF, entidadeId: nf.id },
    });
    expect(logs).toBe(0);
  }, 90_000);

  it('CC-e bloqueia após 20 autorizadas', async () => {
    const { nf } = await emitirAutorizada();
    await operacional.eventoNotaFiscal.createMany({
      data: Array.from({ length: 20 }, (_, i) => ({
        empresaId: ecolumeId,
        notaFiscalId: nf.id,
        tipo: 'CCE',
        status: 'AUTORIZADO',
        numeroSequencia: i + 1,
        texto: `Carta numero ${i + 1} de teste de limite`,
        mock: true,
      })),
    });
    focus.cartaCorrecao.mockClear();
    await expect(
      nfe.cartaCorrecao(ecolumeId, nf.id, { correcao: TEXTO }, ator),
    ).rejects.toMatchObject({ codigo: 'CCE_LIMITE_ATINGIDO' });
    expect(focus.cartaCorrecao).not.toHaveBeenCalled();
  }, 90_000);

  it('E-mail em AUTORIZADA (mock): evento AGENDADO + auditoria sem segredos', async () => {
    const { nf } = await emitirAutorizada();
    focus.enviarEmail.mockClear();
    const r = await nfe.enviarEmailDanfe(
      ecolumeId,
      nf.id,
      { emails: ['Cliente@Teste.com', 'cliente@teste.com', 'contador@teste.com'] },
      ator,
    );
    expect(r.mock).toBe(true);
    expect(r.envioReal).toBe(false);
    expect(r.aviso).toContain('FOCUS_NFE_TOKEN');
    expect(r.evento.tipo).toBe('EMAIL');
    expect(r.evento.status).toBe('AGENDADO');
    expect(r.evento.mock).toBe(true);
    expect(r.evento.emails).toEqual(['cliente@teste.com', 'contador@teste.com']);
    expect(focus.enviarEmail).toHaveBeenCalledWith(nf.refFocus, [
      'cliente@teste.com',
      'contador@teste.com',
    ]);
    const logs = await operacional.logAuditoria.findMany({
      where: { empresaId: ecolumeId, tipo: TipoAuditoria.ENVIO_EMAIL_NF, entidadeId: nf.id },
    });
    expect(logs).toHaveLength(1);
    expect(JSON.stringify(logs)).not.toMatch(/token|senha|certificado/i);
  }, 90_000);

  it('E-mail: valida e-mails, status da nota, HTTP erro e permissão', async () => {
    const { ped, nf } = await emitirAutorizada();
    await expect(
      nfe.enviarEmailDanfe(ecolumeId, nf.id, { emails: [] }, ator),
    ).rejects.toMatchObject({ codigo: 'EMAILS_INVALIDOS' });
    await expect(
      nfe.enviarEmailDanfe(ecolumeId, nf.id, { emails: ['sem-arroba'] }, ator),
    ).rejects.toMatchObject({ codigo: 'EMAILS_INVALIDOS' });
    await expect(
      nfe.enviarEmailDanfe(
        ecolumeId,
        nf.id,
        { emails: ['a@teste.com'] },
        { id: randomUUID(), empresaId: ecolumeId, perfil: PerfilUsuario.GESTOR },
      ),
    ).rejects.toMatchObject({ codigo: 'SEM_PERMISSAO' });

    focus.enviarEmail.mockResolvedValueOnce({
      mock: false,
      statusHttp: 422,
      body: { mensagem: 'Falha simulada' },
    });
    await expect(
      nfe.enviarEmailDanfe(ecolumeId, nf.id, { emails: ['a@teste.com'] }, ator),
    ).rejects.toMatchObject({ codigo: 'EMAIL_NF_FALHOU' });
    const erro = await operacional.eventoNotaFiscal.findFirstOrThrow({
      where: { empresaId: ecolumeId, notaFiscalId: nf.id, tipo: 'EMAIL' },
    });
    expect(erro.status).toBe('ERRO');

    const rascunho = await operacional.notaFiscal.create({
      data: {
        empresaId: ecolumeId,
        orcamentoId: ped.orcamentoId,
        oportunidadeId: ped.oportunidadeId,
        pedidoId: ped.id,
        status: StatusNotaFiscal.PROCESSANDO,
        refFocus: `proc-${randomUUID()}`,
      },
    });
    await expect(
      nfe.enviarEmailDanfe(ecolumeId, rascunho.id, { emails: ['a@teste.com'] }, ator),
    ).rejects.toMatchObject({ codigo: 'NF_NAO_AUTORIZADA' });
  }, 90_000);

  it('payload inclui informacoes_adicionais_contribuinte só com informações do contador', async () => {
    const original = await platform.empresa.findUniqueOrThrow({ where: { id: ecolumeId } });
    try {
      // Só tratamentoSt: nada é enviado (não inventa linha de ST).
      await platform.empresa.update({
        where: { id: ecolumeId },
        data: { configuracoes: { ...configBase, tratamentoSt: 'ST apurada pelo contador' } },
      });
      focus.emitirNfe.mockClear();
      await emitirAutorizada();
      let payload = (focus.emitirNfe.mock.calls[0] as unknown as [string, Record<string, unknown>])[1];
      expect(payload.informacoes_adicionais_contribuinte).toBeUndefined();
      expect(payload._envioEmailViaFocus).toBe(false);
      expect(payload._envioEmailPendente).toBeUndefined();

      // Informações + ST: concatenadas com quebra de linha.
      await platform.empresa.update({
        where: { id: ecolumeId },
        data: {
          configuracoes: {
            ...configBase,
            tratamentoSt: 'ST apurada pelo contador',
            informacoesComplementaresNfe: 'Info complementar do contador',
          },
        },
      });
      focus.emitirNfe.mockClear();
      await emitirAutorizada();
      payload = (focus.emitirNfe.mock.calls[0] as unknown as [string, Record<string, unknown>])[1];
      expect(payload.informacoes_adicionais_contribuinte).toBe(
        'Info complementar do contador\nST apurada pelo contador',
      );
      // P3 continua incompleta: não habilita emissão real nem altera CFOP.
      expect(payload._parametrosInformados).toBe(false);
    } finally {
      await platform.empresa.update({
        where: { id: ecolumeId },
        data: { configuracoes: original.configuracoes as never },
      });
    }
  }, 120_000);

  it('statusHomologacao: sem token/P3, certificado só na Focus, sem segredos', async () => {
    const st = await nfe.statusHomologacao(ecolumeId, ator);
    expect(st.tokenConfigurado).toBe(false);
    expect(st.p3Completo).toBe(false);
    expect(st.emissaoRealHabilitada).toBe(false);
    expect(st.p3Faltando).toContain('regimeTributario');
    expect(st.ambiente).toBe('homologacao');
    expect(st.certificado.provedorFocus).toBe(true);
    expect(st.certificado.armazenamentoLocal).toBe(false);
    expect(st.cartaCorrecaoDisponivel).toBe(true);
    expect(st.emailDanfeDisponivel).toBe(true);
    expect(st.cartaCorrecaoReal).toBe(false);
    expect(st.emailDanfeReal).toBe(false);
    expect(JSON.stringify(st)).not.toMatch(/senha[^ ]*":|"token"/i);
  }, 30_000);

  it('cancelar informa cartaCorrecaoSuportada: true', async () => {
    const { nf } = await emitirAutorizada();
    const r = await nfe.cancelar(
      ecolumeId,
      nf.id,
      { justificativa: 'Cancelamento para verificar capacidade', confirmar: true },
      ator,
    );
    expect(r.cartaCorrecaoSuportada).toBe(true);
  }, 60_000);

  it('isolamento de tenant: outra empresa não acessa CC-e/e-mail da NF', async () => {
    const { nf } = await emitirAutorizada();
    await expect(
      nfe.cartaCorrecao(outraId, nf.id, { correcao: TEXTO }, atorOutra),
    ).rejects.toMatchObject({ codigo: 'NF_NAO_ENCONTRADA' });
    await expect(
      nfe.enviarEmailDanfe(outraId, nf.id, { emails: ['a@teste.com'] }, atorOutra),
    ).rejects.toMatchObject({ codigo: 'NF_NAO_ENCONTRADA' });
    const eventosOutra = await operacional.eventoNotaFiscal.count({
      where: { empresaId: outraId },
    });
    expect(eventosOutra).toBe(0);

    // E a outra empresa consegue na própria NF.
    const propria = await emitirAutorizada(outraId, clienteOutraId, atorOutra);
    const r = await nfe.cartaCorrecao(outraId, propria.nf.id, { correcao: TEXTO }, atorOutra);
    expect(r.evento.empresaId).toBe(outraId);
  }, 120_000);

  it('legado (flag off): CC-e/e-mail/status indisponíveis', async () => {
    const atorPadrao = { id: usuarioId, empresaId: padraoId, perfil: PerfilUsuario.PROPRIETARIO };
    await expect(
      nfe.cartaCorrecao(padraoId, randomUUID(), { correcao: TEXTO }, atorPadrao),
    ).rejects.toMatchObject({ codigo: 'NFE_PEDIDO_INDISPONIVEL' });
    await expect(
      nfe.enviarEmailDanfe(padraoId, randomUUID(), { emails: ['a@teste.com'] }, atorPadrao),
    ).rejects.toMatchObject({ codigo: 'NFE_PEDIDO_INDISPONIVEL' });
    await expect(nfe.statusHomologacao(padraoId, atorPadrao)).rejects.toMatchObject({
      codigo: 'NFE_PEDIDO_INDISPONIVEL',
    });
  }, 30_000);
});
