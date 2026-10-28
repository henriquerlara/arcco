import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  cartaCorrecaoNfSchema,
  ChaveEtapaSistema,
  digitosDoc,
  enviarEmailNfSchema,
  redigirSegredos,
  FaseKanbanPedido,
  lerParametrosFiscais,
  parametrosFiscaisCompletos,
  PermissaoComercial,
  possuiPermissao,
  StatusNotaFiscal,
  StatusPedido,
  TipoAuditoria,
  TipoChecklistPedido,
  type emitirNfPedidoSchema,
  type PendenciaFiscal,
} from '@arcco/contratos';
import type { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { Erros } from '../../common/erros/erros';
import { carregarEnv } from '../../config/env';
import { ArquivosService } from '../arquivos/arquivos.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EmpresasService } from '../empresas/empresas.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { FocusNfeClient } from './focus-nfe.client';

type EmitirInput = z.infer<typeof emitirNfPedidoSchema>;
type Ator = { id: string; empresaId: string; perfil: string };

const TIPO_EVENTO_CCE = 'CCE';
const TIPO_EVENTO_EMAIL = 'EMAIL';
/** Limite da Sefaz/Focus de cartas de correção por NF-e. */
const LIMITE_CCE_POR_NFE = 20;
const StatusEventoNf = {
  AUTORIZADO: 'AUTORIZADO',
  REJEITADO: 'REJEITADO',
  AGENDADO: 'AGENDADO',
  ERRO: 'ERRO',
} as const;

const STATUS_RESERVA: StatusNotaFiscal[] = [
  StatusNotaFiscal.PROCESSANDO,
  StatusNotaFiscal.AUTORIZADA,
];

@Injectable()
export class NfePedidoService {
  private readonly logger = new Logger('NfePedido');

  constructor(
    private readonly prisma: PrismaService,
    private readonly platform: PlatformPrismaService,
    private readonly focus: FocusNfeClient,
    private readonly arquivos: ArquivosService,
    private readonly empresas: EmpresasService,
    private readonly permissoes: PermissoesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private async exigirEmitir(ator: Ator) {
    await this.exigirPermissaoFiscal(ator, PermissaoComercial.EMITIR_NF);
  }

  private async exigirPermissaoFiscal(ator: Ator, chave: PermissaoComercial) {
    if (!(await this.permissoes.empresaEcolume(ator.empresaId))) {
      throw Erros.invalido('NFE_PEDIDO_INDISPONIVEL', 'Emissao de NF-e do pedido so na ECOLUME');
    }
    const ctx = await this.permissoes.resolver(ator);
    if (!possuiPermissao(ctx, chave)) {
      throw Erros.semPermissao();
    }
  }

  /** Preparação + validação (sem gravar). */
  async preparar(empresaId: string, pedidoId: string, ator: Ator) {
    await this.exigirEmitir(ator);
    const pedido = await this.carregarPedido(empresaId, pedidoId);
    const disponivel = await this.quantidadesDisponiveis(empresaId, pedidoId);
    const pendencias = await this.validarPendencias(empresaId, pedido);
    const params = await this.paramsFiscais(empresaId);
    return {
      pedidoId: pedido.id,
      numero: pedido.numero,
      statusPedido: pedido.status,
      emissaoRealHabilitada: parametrosFiscaisCompletos(params) && this.focus.configurado(),
      parametrosFiscais: params,
      pendencias,
      itens: pedido.itens.map((item) => {
        const disp = disponivel.get(item.id) ?? 0;
        const prod = item.produto;
        return {
          itemPedidoId: item.id,
          nome: item.nome,
          nomeFiscalPadrao: prod?.nomeFiscal || item.nome,
          codigoInterno: item.codigoInterno ?? prod?.codigoInterno ?? null,
          produtoId: item.produtoId,
          quantidadeVendida: item.quantidade,
          quantidadeDisponivel: disp,
          precoUnitario: item.precoUnitario,
          unidade: item.unidade,
          ncm: prod?.ncm ?? null,
          cest: prod?.cest ?? null,
          origemFiscal: prod?.origemFiscal ?? null,
          avulso: !item.produtoId,
        };
      }),
      notas: await this.prisma.notaFiscal.findMany({
        where: { empresaId, pedidoId },
        orderBy: { criadoEm: 'desc' },
        include: { itens: true, eventos: { orderBy: { criadoEm: 'desc' } } },
      }),
      cartaCorrecaoDisponivel: true,
      emailDanfeDisponivel: true,
      emailDanfeReal: this.focus.configurado(),
      emailDestinatarioPadrao: pedido.oportunidade.contato.email ?? null,
    };
  }

  async emitir(empresaId: string, pedidoId: string, dto: EmitirInput, ator: Ator) {
    await this.exigirEmitir(ator);
    const params = await this.paramsFiscais(empresaId);
    const realOk = parametrosFiscaisCompletos(params) && this.focus.configurado();
    // Sem P3/token: só mock estrutural. Com token mas sem P3: bloqueia (não inventa CFOP).
    if (this.focus.configurado() && !parametrosFiscaisCompletos(params)) {
      throw Erros.invalido(
        'EMISSAO_BLOQUEADA_P3',
        'Parametros fiscais (regime, CFOP, CSOSN/CST, natureza) nao definidos — pendencia P3/ECOL-02',
        { parametrosFiscais: params },
      );
    }

    const prefix = carregarEnv().FOCUS_NFE_REF_PREFIX || 'arcco';
    const ref =
      dto.idempotencyKey?.trim() ||
      `${prefix}-ped-${pedidoId.slice(0, 8)}-${Date.now()}`;

    // Idempotência: mesma ref já existe
    const existente = await this.prisma.notaFiscal.findFirst({
      where: { empresaId, refFocus: ref },
      include: { itens: true },
    });
    if (existente) return existente;

    let nfId = '';
    try {
      nfId = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`${empresaId}:nfe-ped:${pedidoId}`}))
        `;

        const pedido = await this.carregarPedidoTx(tx, empresaId, pedidoId);
        if (pedido.status === StatusPedido.CANCELADO) {
          throw Erros.invalido('PEDIDO_CANCELADO', 'Pedido cancelado nao pode emitir NF-e');
        }

        const pendencias = await this.validarPendencias(empresaId, pedido);
        const selecionados = new Set(dto.itens.map((i) => i.itemPedidoId));
        // P3/token/IE/avulso genérico: avisos. Cadastrais dos itens selecionados bloqueiam.
        const avisos = new Set([
          'P3_PARAMETROS',
          'CERTIFICADO_TOKEN',
          'DEST_IE',
          'ITEM_AVULSO_FISCAL',
        ]);
        const bloqueantes = pendencias.filter(
          (p) =>
            !avisos.has(p.codigo) &&
            (!p.itemPedidoId || selecionados.has(p.itemPedidoId)),
        );
        if (bloqueantes.length) {
          throw Erros.invalido('VALIDACAO_FISCAL', 'Ha pendencias fiscais cadastrais', {
            pendencias: bloqueantes,
          });
        }

        const disponivel = await this.quantidadesDisponiveisTx(tx, empresaId, pedidoId);
        const linhas: Array<{
          item: (typeof pedido.itens)[number];
          qtd: number;
          descricao: string;
          ncm: string;
          cest: string | null;
          origemFiscal: string | null;
        }> = [];

        for (const sel of dto.itens) {
          const item = pedido.itens.find((i) => i.id === sel.itemPedidoId);
          if (!item) {
            throw Erros.invalido('ITEM_PEDIDO_INVALIDO', 'Item do pedido nao encontrado', {
              itemPedidoId: sel.itemPedidoId,
            });
          }
          const disp = disponivel.get(item.id) ?? 0;
          if (sel.quantidade > disp + 1e-9) {
            throw Erros.invalido(
              'QUANTIDADE_EXCEDE_DISPONIVEL',
              `Quantidade maior que a disponivel para faturamento (item ${item.nome})`,
              {
                itemPedidoId: item.id,
                solicitada: sel.quantidade,
                disponivel: disp,
              },
            );
          }

          let ncm = digitosDoc(item.produto?.ncm);
          let cest = item.produto?.cest ?? null;
          let origemFiscal = item.produto?.origemFiscal ?? null;
          if (!item.produtoId) {
            ncm = digitosDoc(sel.ncm);
            if (ncm.length !== 8) {
              throw Erros.invalido(
                'ITEM_AVULSO_FISCAL',
                `Item avulso "${item.nome}" exige NCM (8 digitos) nesta NF`,
                { itemPedidoId: item.id, campo: 'ncm', onde: `Pedido ${pedido.numero}` },
              );
            }
            cest = sel.cest?.trim() || null;
            origemFiscal = sel.origemFiscal?.trim() || null;
            if (!origemFiscal) {
              throw Erros.invalido(
                'ITEM_AVULSO_FISCAL',
                `Item avulso "${item.nome}" exige origem fiscal nesta NF`,
                { itemPedidoId: item.id, campo: 'origemFiscal', onde: `Pedido ${pedido.numero}` },
              );
            }
          }

          linhas.push({
            item,
            qtd: sel.quantidade,
            descricao: (sel.descricao?.trim() || item.produto?.nomeFiscal || item.nome).slice(0, 120),
            ncm,
            cest,
            origemFiscal,
          });
          disponivel.set(item.id, disp - sel.quantidade);
        }

        const empresa = await this.empresas.obter(empresaId);
        const contato = pedido.oportunidade.contato;
        const cnpjEmitente = digitosDoc(empresa.cnpj);
        const docDest = digitosDoc(contato.documento);
        const endereco = (empresa.enderecoFiscal ?? {}) as Record<string, string>;
        const endCli = this.enderecoCliente(contato, pedido.oportunidade);

        const valorTotal = linhas.reduce(
          (s, l) => s + Number((l.qtd * l.item.precoUnitario).toFixed(2)),
          0,
        );

        const payload = this.montarPayload({
          params,
          cnpjEmitente,
          ie: empresa.inscricaoEstadual ?? undefined,
          enderecoEmit: endereco,
          nomeEmitente: empresa.nomeFantasia || empresa.nome,
          contatoNome: contato.nome,
          docDest,
          emailDest: contato.email ?? undefined,
          enderecoDest: endCli,
          itens: linhas.map((l, idx) => ({
            numero: idx + 1,
            codigo: l.item.codigoInterno || l.item.produto?.codigoInterno || l.item.produtoId || `I${idx + 1}`,
            descricao: l.descricao,
            ncm: l.ncm,
            cest: l.cest ?? undefined,
            origem: l.origemFiscal ?? undefined,
            quantidade: l.qtd,
            valorUnitario: l.item.precoUnitario,
            valorTotal: Number((l.qtd * l.item.precoUnitario).toFixed(2)),
            unidade: l.item.unidade || 'UN',
          })),
          valorTotal,
        });

        const nf = await tx.notaFiscal.create({
          data: {
            empresaId,
            orcamentoId: pedido.orcamentoId,
            oportunidadeId: pedido.oportunidadeId,
            pedidoId,
            status: StatusNotaFiscal.PROCESSANDO,
            refFocus: ref,
            payloadEnvio: payload as object,
            criadoPorId: ator.id,
            itens: {
              create: linhas.map((l, idx) => ({
                id: randomUUID(),
                empresaId,
                itemPedidoId: l.item.id,
                produtoId: l.item.produtoId,
                codigoInterno: l.item.codigoInterno ?? l.item.produto?.codigoInterno ?? null,
                descricao: l.descricao,
                ncm: l.ncm || null,
                cest: l.cest,
                origemFiscal: l.origemFiscal,
                unidade: l.item.unidade || 'UN',
                quantidade: new Prisma.Decimal(l.qtd.toFixed(4)),
                precoUnitario: new Prisma.Decimal(l.item.precoUnitario.toFixed(4)),
                valorTotal: new Prisma.Decimal((l.qtd * l.item.precoUnitario).toFixed(4)),
                ordem: idx,
              })),
            },
          },
        });
        return nf.id;
      });
    } catch (erro) {
      if ((erro as { code?: string })?.code === 'P2002') {
        const again = await this.prisma.notaFiscal.findFirst({
          where: { empresaId, refFocus: ref },
          include: { itens: true },
        });
        if (again) return again;
      }
      throw erro;
    }

    // Fora da TX: chamada ao emissor (nunca com TX aberta)
    try {
      const gravada = await this.prisma.notaFiscal.findFirstOrThrow({ where: { id: nfId } });
      const payload = (gravada.payloadEnvio ?? {}) as Record<string, unknown>;
      void realOk;
      const envio = await this.focus.emitirNfe(ref, payload);
      return this.aplicarResposta(nfId, empresaId, envio.body, envio.mock, ator.id);
    } catch (erro) {
      const msg = (erro as Error).message;
      this.logger.warn(`Emissao pedido falhou ref=${ref}: ${msg}`);
      // Timeout / desconhecido: consultar antes de marcar rejeitada
      try {
        const consulta = await this.focus.consultarNfe(ref);
        return this.aplicarResposta(nfId, empresaId, consulta.body, consulta.mock, ator.id);
      } catch {
        return this.prisma.notaFiscal.update({
          where: { id: nfId },
          data: { status: StatusNotaFiscal.REJEITADA, mensagemErro: msg },
          include: { itens: true },
        });
      }
    }
  }

  async cancelar(
    empresaId: string,
    notaId: string,
    dto: { justificativa: string; confirmar: true },
    ator: Ator,
  ) {
    await this.exigirEmitir(ator);
    const ctx = await this.permissoes.resolver(ator);
    if (!possuiPermissao(ctx, PermissaoComercial.CANCELAR_NF)) {
      throw Erros.semPermissao();
    }
    const nf = await this.prisma.notaFiscal.findFirst({
      where: { id: notaId, empresaId },
      include: { itens: true },
    });
    if (!nf) throw Erros.naoEncontrado('NF_NAO_ENCONTRADA', 'Nota nao encontrada');
    if (nf.status !== StatusNotaFiscal.AUTORIZADA) {
      throw Erros.invalido('NF_NAO_AUTORIZADA', 'So cancela NF-e autorizada');
    }
    if (!nf.refFocus) throw Erros.invalido('NF_SEM_REF', 'Nota sem referencia no emissor');

    if (!this.focus.configurado()) {
      // Mock: cancela localmente
      const atualizada = await this.prisma.notaFiscal.update({
        where: { id: nf.id },
        data: {
          status: StatusNotaFiscal.CANCELADA,
          mensagemErro: `Cancelamento mock: ${dto.justificativa}`,
          respostaFocus: {
            ...((nf.respostaFocus as object) ?? {}),
            status: 'cancelado',
            _mock: true,
            justificativa: dto.justificativa,
          },
        },
        include: { itens: true },
      });
      if (nf.pedidoId) await this.sincronizarChecklistNf(empresaId, nf.pedidoId, ator.id);
      await this.auditoria.registrar(this.prisma, {
        empresaId,
        usuarioId: ator.id,
        tipo: TipoAuditoria.CANCELAMENTO_NF,
        entidade: 'nota_fiscal',
        entidadeId: nf.id,
        anterior: { status: nf.status },
        posterior: { status: StatusNotaFiscal.CANCELADA },
      });
      return {
        ...atualizada,
        cartaCorrecaoSuportada: true,
        limitacao:
          'Focus sem token: cancelamento apenas local (mock). Carta de correção disponível via POST /notas-fiscais/:id/carta-correcao (mock sem token).',
      };
    }

    const canc = await this.focus.cancelarNfe(nf.refFocus, dto.justificativa);
    const aplicada = await this.aplicarResposta(nf.id, empresaId, canc.body, canc.mock, ator.id);
    return {
      ...aplicada,
      cartaCorrecaoSuportada: true,
    };
  }

  /**
   * ECOL-28b — Carta de correção (CC-e) via Focus (síncrono, 15–1000 chars, até 20 por NF-e).
   * Sem token: evento mock (`mock: true`), sem validade na Sefaz.
   * A chamada ao emissor ocorre sob advisory lock da nota para serializar a sequência do evento.
   */
  async cartaCorrecao(
    empresaId: string,
    notaId: string,
    dto: { correcao: string },
    ator: Ator,
  ) {
    await this.exigirPermissaoFiscal(ator, PermissaoComercial.CARTA_CORRECAO);
    const parse = cartaCorrecaoNfSchema.safeParse(dto);
    if (!parse.success) {
      throw Erros.invalido(
        'CCE_TEXTO_INVALIDO',
        'O texto da carta de correcao deve ter entre 15 e 1000 caracteres',
      );
    }
    const correcao = parse.data.correcao;

    const resultado = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`${empresaId}:nfe-evento:${notaId}`}))
        `;
        const nf = await tx.notaFiscal.findFirst({ where: { id: notaId, empresaId } });
        if (!nf) throw Erros.naoEncontrado('NF_NAO_ENCONTRADA', 'Nota nao encontrada');
        if (nf.status !== StatusNotaFiscal.AUTORIZADA) {
          throw Erros.invalido(
            'NF_NAO_AUTORIZADA',
            'Carta de correcao so se aplica a NF-e autorizada (nao cancelada)',
          );
        }
        if (!nf.refFocus) throw Erros.invalido('NF_SEM_REF', 'Nota sem referencia no emissor');

        const autorizadas = await tx.eventoNotaFiscal.count({
          where: {
            empresaId,
            notaFiscalId: nf.id,
            tipo: TIPO_EVENTO_CCE,
            status: StatusEventoNf.AUTORIZADO,
          },
        });
        if (autorizadas >= LIMITE_CCE_POR_NFE) {
          throw Erros.invalido(
            'CCE_LIMITE_ATINGIDO',
            `Limite de ${LIMITE_CCE_POR_NFE} cartas de correcao por NF-e atingido`,
          );
        }

        let envio: Awaited<ReturnType<FocusNfeClient['cartaCorrecao']>>;
        let falhaRede: string | null = null;
        try {
          envio = await this.focus.cartaCorrecao(nf.refFocus, correcao);
        } catch (erro) {
          falhaRede = (erro as Error).message;
          envio = { mock: false, statusHttp: 0, body: {} };
        }
        const statusRaw = String(envio.body.status ?? '').toLowerCase();
        const autorizado = !falhaRede && ['autorizado', 'autorizada'].includes(statusRaw);
        const status = falhaRede
          ? StatusEventoNf.ERRO
          : autorizado
            ? StatusEventoNf.AUTORIZADO
            : StatusEventoNf.REJEITADO;
        const seqFocus = Number(envio.body.numero_carta_correcao);
        const numeroSequencia =
          !envio.mock && Number.isInteger(seqFocus) && seqFocus > 0 ? seqFocus : autorizadas + 1;
        const mensagem =
          falhaRede ??
          String(
            envio.body.mensagem_sefaz ?? envio.body.mensagem ?? envio.body.status_sefaz ?? '',
          );

        const evento = await tx.eventoNotaFiscal.create({
          data: {
            empresaId,
            notaFiscalId: nf.id,
            tipo: TIPO_EVENTO_CCE,
            status,
            numeroSequencia: autorizado ? numeroSequencia : null,
            texto: correcao,
            protocolo: envio.body.protocolo ? String(envio.body.protocolo) : null,
            respostaFocus: redigirSegredos(
              falhaRede ? { erro: falhaRede } : envio.body,
            ) as Prisma.InputJsonValue,
            mock: envio.mock,
            criadoPorId: ator.id,
          },
        });

        if (autorizado) {
          await this.auditoria.registrar(tx, {
            empresaId,
            usuarioId: ator.id,
            tipo: TipoAuditoria.CARTA_CORRECAO_NF,
            entidade: 'nota_fiscal',
            entidadeId: nf.id,
            anterior: { cartasAutorizadas: autorizadas },
            posterior: { numeroSequencia, eventoId: evento.id, mock: envio.mock, texto: correcao },
          });
        }
        return { evento, mock: envio.mock, autorizado, mensagem };
      },
      { timeout: 45_000, maxWait: 15_000 },
    );

    if (!resultado.autorizado) {
      throw Erros.invalido(
        'CCE_NAO_AUTORIZADA',
        resultado.mensagem || 'Carta de correcao nao autorizada pelo emissor',
        { eventoId: resultado.evento.id, status: resultado.evento.status },
      );
    }
    return {
      cartaCorrecaoSuportada: true,
      evento: resultado.evento,
      mock: resultado.mock,
    };
  }

  /**
   * ECOL-28b — reenvio de DANFE/XML por e-mail via Focus (agendado, assíncrono).
   * Sem token: evento AGENDADO com `mock: true` e nenhum e-mail real é enviado.
   */
  async enviarEmailDanfe(
    empresaId: string,
    notaId: string,
    dto: { emails: string[] },
    ator: Ator,
  ) {
    await this.exigirEmitir(ator);
    const parse = enviarEmailNfSchema.safeParse(dto);
    if (!parse.success) {
      throw Erros.invalido('EMAILS_INVALIDOS', 'Informe de 1 a 10 e-mails validos');
    }
    const emails = [...new Set(parse.data.emails)];

    const nf = await this.prisma.notaFiscal.findFirst({ where: { id: notaId, empresaId } });
    if (!nf) throw Erros.naoEncontrado('NF_NAO_ENCONTRADA', 'Nota nao encontrada');
    if (nf.status !== StatusNotaFiscal.AUTORIZADA) {
      throw Erros.invalido('NF_NAO_AUTORIZADA', 'So envia e-mail de NF-e autorizada');
    }
    if (!nf.refFocus) throw Erros.invalido('NF_SEM_REF', 'Nota sem referencia no emissor');

    let envio: Awaited<ReturnType<FocusNfeClient['enviarEmail']>>;
    let falhaRede: string | null = null;
    try {
      envio = await this.focus.enviarEmail(nf.refFocus, emails);
    } catch (erro) {
      falhaRede = (erro as Error).message;
      envio = { mock: false, statusHttp: 0, body: {} };
    }
    const httpOk = envio.statusHttp >= 200 && envio.statusHttp < 300;
    const status = !falhaRede && httpOk ? StatusEventoNf.AGENDADO : StatusEventoNf.ERRO;

    const evento = await this.prisma.$transaction(async (tx) => {
      const criado = await tx.eventoNotaFiscal.create({
        data: {
          empresaId,
          notaFiscalId: nf.id,
          tipo: TIPO_EVENTO_EMAIL,
          status,
          emails,
          respostaFocus: redigirSegredos(
            falhaRede ? { erro: falhaRede } : envio.body,
          ) as Prisma.InputJsonValue,
          mock: envio.mock,
          criadoPorId: ator.id,
        },
      });
      if (status === StatusEventoNf.AGENDADO) {
        await this.auditoria.registrar(tx, {
          empresaId,
          usuarioId: ator.id,
          tipo: TipoAuditoria.ENVIO_EMAIL_NF,
          entidade: 'nota_fiscal',
          entidadeId: nf.id,
          anterior: null,
          posterior: { eventoId: criado.id, emails, mock: envio.mock },
        });
      }
      return criado;
    });

    if (status === StatusEventoNf.ERRO) {
      throw Erros.invalido(
        'EMAIL_NF_FALHOU',
        falhaRede ?? String(envio.body.mensagem ?? 'Emissor recusou o envio de e-mail'),
        { eventoId: evento.id },
      );
    }
    return {
      evento,
      mock: envio.mock,
      envioReal: !envio.mock,
      aviso: envio.mock
        ? 'Envio real de e-mail exige FOCUS_NFE_TOKEN; este registro e apenas simulado.'
        : null,
    };
  }

  /** ECOL-28b — situação de homologação/emissão (sem segredos). */
  async statusHomologacao(empresaId: string, ator: Ator) {
    await this.exigirLeituraFiscal({ ...ator, empresaId });
    const params = await this.paramsFiscais(empresaId);
    const p3Completo = parametrosFiscaisCompletos(params);
    const tokenConfigurado = this.focus.configurado();
    const faltando: string[] = [];
    if (!params.regimeTributario) faltando.push('regimeTributario');
    if (!params.cfopPadrao) faltando.push('cfopPadrao');
    if (!params.naturezaOperacao) faltando.push('naturezaOperacao');
    if (!params.csosnPadrao && !params.cstPadrao) faltando.push('csosnPadrao ou cstPadrao');
    const emissaoRealHabilitada = p3Completo && tokenConfigurado;
    return {
      ambiente: this.focus.ambiente(),
      tokenConfigurado,
      p3Completo,
      p3Faltando: faltando,
      tratamentoStInformado: Boolean(params.tratamentoSt),
      informacoesComplementaresInformadas: Boolean(params.informacoesComplementaresNfe),
      emissaoRealHabilitada,
      modo: tokenConfigurado ? 'focus' : 'mock',
      certificado: {
        provedorFocus: true,
        armazenamentoLocal: false,
        mensagem:
          'Certificado A1 e senha ficam no painel da Focus NFe (conta da empresa). O ARCCO nao armazena arquivo nem senha; so o token da API vai em variavel de ambiente do servidor.',
      },
      cartaCorrecaoDisponivel: true,
      cartaCorrecaoReal: tokenConfigurado,
      emailDanfeDisponivel: true,
      emailDanfeReal: tokenConfigurado,
      mensagem: emissaoRealHabilitada
        ? `Emissao real habilitada em ${this.focus.ambiente()}.`
        : 'Emissao real bloqueada: faltam token Focus e/ou parametros fiscais (P3) do contador. CC-e e e-mail operam em mock.',
    };
  }

  async listarPorPedido(empresaId: string, pedidoId: string) {
    return this.prisma.notaFiscal.findMany({
      where: { empresaId, pedidoId },
      orderBy: { criadoEm: 'desc' },
      include: { itens: true },
    });
  }

  private async exigirLeituraFiscal(ator: Ator) {
    if (!(await this.permissoes.empresaEcolume(ator.empresaId))) {
      throw Erros.invalido('NFE_PEDIDO_INDISPONIVEL', 'Tela Fiscal so na ECOLUME');
    }
  }

  /** ECOL-25 — NF-e de saída da empresa (pedido). */
  async listarEmitidas(empresaId: string, ator: Ator) {
    await this.exigirLeituraFiscal({ ...ator, empresaId });
    const notas = await this.prisma.notaFiscal.findMany({
      where: { empresaId, pedidoId: { not: null } },
      orderBy: [{ autorizadoEm: 'desc' }, { criadoEm: 'desc' }],
      include: {
        itens: true,
        eventos: { orderBy: { criadoEm: 'desc' } },
        pedido: { select: { id: true, numero: true, total: true, status: true } },
        oportunidade: {
          select: {
            id: true,
            titulo: true,
            contato: { select: { id: true, nome: true, email: true } },
          },
        },
      },
      take: 200,
    });
    return notas.map((nf) => {
      const valorItens = nf.itens.reduce((s, i) => s + Number(i.valorTotal), 0);
      const payload = (nf.payloadEnvio ?? {}) as Record<string, unknown>;
      const valorPayload =
        typeof payload.valor_total === 'number' ? payload.valor_total : valorItens;
      const mock = Boolean(
        (nf.respostaFocus as { _mock?: boolean } | null)?._mock,
      );
      return {
        id: nf.id,
        pedidoId: nf.pedidoId,
        pedidoNumero: nf.pedido?.numero ?? null,
        oportunidadeId: nf.oportunidadeId,
        clienteNome: nf.oportunidade.contato?.nome ?? null,
        clienteId: nf.oportunidade.contato?.id ?? null,
        clienteEmail: nf.oportunidade.contato?.email ?? null,
        eventos: nf.eventos.map((e) => ({
          id: e.id,
          tipo: e.tipo,
          status: e.status,
          numeroSequencia: e.numeroSequencia,
          texto: e.texto,
          emails: e.emails,
          mock: e.mock,
          criadoEm: e.criadoEm,
        })),
        status: nf.status,
        numero: nf.numero,
        serie: nf.serie,
        chaveAcesso: nf.chaveAcesso,
        mensagemErro: nf.mensagemErro,
        valorTotal: valorPayload,
        autorizadoEm: nf.autorizadoEm,
        criadoEm: nf.criadoEm,
        arquivoPdfId: nf.arquivoPdfId,
        arquivoXmlId: nf.arquivoXmlId,
        simulacao: mock,
        itens: nf.itens.map((i) => ({
          id: i.id,
          descricao: i.descricao,
          quantidade: Number(i.quantidade),
          precoUnitario: Number(i.precoUnitario),
          valorTotal: Number(i.valorTotal),
          itemPedidoId: i.itemPedidoId,
        })),
      };
    });
  }

  /**
   * ECOL-25 — pedidos com saldo a faturar.
   * Reusa reserva PROCESSANDO+AUTORIZADA da ECOL-24 (sem segunda regra).
   */
  async listarPendentesEmissao(empresaId: string, ator: Ator) {
    await this.exigirLeituraFiscal({ ...ator, empresaId });
    const params = await this.paramsFiscais(empresaId);
    const emissaoRealHabilitada =
      parametrosFiscaisCompletos(params) && this.focus.configurado();

    const pedidos = await this.prisma.pedido.findMany({
      where: {
        empresaId,
        status: { not: StatusPedido.CANCELADO },
      },
      include: {
        itens: true,
        oportunidade: {
          select: {
            id: true,
            contato: { select: { id: true, nome: true } },
          },
        },
      },
      orderBy: { criadoEm: 'desc' },
      take: 200,
    });

    const saida = [];
    for (const ped of pedidos) {
      const disponivel = await this.quantidadesDisponiveis(empresaId, ped.id);
      const itensPendentes = ped.itens
        .map((item) => {
          const qtd = disponivel.get(item.id) ?? 0;
          return {
            itemPedidoId: item.id,
            nome: item.nome,
            quantidadeVendida: item.quantidade,
            quantidadePendente: qtd,
            unidade: item.unidade,
            precoUnitario: item.precoUnitario,
          };
        })
        .filter((i) => i.quantidadePendente > 1e-9);
      if (!itensPendentes.length) continue;
      const valorPendente = itensPendentes.reduce(
        (s, i) => s + Number((i.quantidadePendente * i.precoUnitario).toFixed(2)),
        0,
      );
      saida.push({
        pedidoId: ped.id,
        numero: ped.numero,
        statusPedido: ped.status,
        totalPedido: ped.total,
        valorPendente,
        criadoEm: ped.criadoEm,
        oportunidadeId: ped.oportunidadeId,
        clienteNome: ped.oportunidade.contato?.nome ?? null,
        clienteId: ped.oportunidade.contato?.id ?? null,
        itensPendentes,
        emissaoRealHabilitada,
        parametrosFiscais: params,
      });
    }
    return {
      emissaoRealHabilitada,
      parametrosFiscais: params,
      focusConfigurado: this.focus.configurado(),
      pedidos: saida,
    };
  }

  // ——— internos ———

  private async paramsFiscais(empresaId: string) {
    const emp = await this.platform.empresa.findUnique({
      where: { id: empresaId },
      select: { configuracoes: true },
    });
    return lerParametrosFiscais(emp?.configuracoes);
  }

  private async carregarPedido(empresaId: string, pedidoId: string) {
    const pedido = await this.prisma.pedido.findFirst({
      where: { id: pedidoId, empresaId },
      include: {
        itens: { include: { produto: true }, orderBy: { ordem: 'asc' } },
        oportunidade: {
          include: {
            contato: true,
          },
        },
      },
    });
    if (!pedido) throw Erros.naoEncontrado('PEDIDO_NAO_ENCONTRADO', 'Pedido nao encontrado');
    return pedido;
  }

  private carregarPedidoTx(
    tx: Prisma.TransactionClient,
    empresaId: string,
    pedidoId: string,
  ) {
    return tx.pedido.findFirstOrThrow({
      where: { id: pedidoId, empresaId },
      include: {
        itens: { include: { produto: true }, orderBy: { ordem: 'asc' } },
        oportunidade: { include: { contato: true } },
      },
    });
  }

  private async quantidadesDisponiveis(empresaId: string, pedidoId: string) {
    return this.quantidadesDisponiveisTx(this.prisma, empresaId, pedidoId);
  }

  private async quantidadesDisponiveisTx(
    db: Prisma.TransactionClient | PrismaService,
    empresaId: string,
    pedidoId: string,
  ) {
    const pedido = await db.pedido.findFirstOrThrow({
      where: { id: pedidoId, empresaId },
      include: { itens: true },
    });
    const reservados = await db.itemNotaFiscal.groupBy({
      by: ['itemPedidoId'],
      where: {
        empresaId,
        itemPedidoId: { not: null },
        nota: {
          pedidoId,
          status: { in: STATUS_RESERVA },
        },
      },
      _sum: { quantidade: true },
    });
    const mapa = new Map<string, number>();
    for (const item of pedido.itens) {
      const uso = reservados.find((r) => r.itemPedidoId === item.id);
      const usado = uso?._sum.quantidade ? Number(uso._sum.quantidade) : 0;
      mapa.set(item.id, Math.max(0, item.quantidade - usado));
    }
    return mapa;
  }

  private enderecoCliente(
    contato: {
      cep?: string | null;
      logradouro?: string | null;
      numero?: string | null;
      complemento?: string | null;
      bairro?: string | null;
      cidade?: string | null;
      uf?: string | null;
      inscricaoEstadual?: string | null;
    },
    opp: {
      obraCep?: string | null;
      obraLogradouro?: string | null;
      obraNumero?: string | null;
      obraComplemento?: string | null;
      obraBairro?: string | null;
      obraCidade?: string | null;
      obraUf?: string | null;
    },
  ) {
    return {
      logradouro: contato.logradouro || opp.obraLogradouro || null,
      numero: contato.numero || opp.obraNumero || null,
      complemento: contato.complemento || opp.obraComplemento || null,
      bairro: contato.bairro || opp.obraBairro || null,
      municipio: contato.cidade || opp.obraCidade || null,
      uf: contato.uf || opp.obraUf || null,
      cep: contato.cep || opp.obraCep || null,
      ie: contato.inscricaoEstadual || null,
    };
  }

  private async validarPendencias(
    empresaId: string,
    pedido: Awaited<ReturnType<NfePedidoService['carregarPedido']>>,
  ): Promise<PendenciaFiscal[]> {
    const pendencias: PendenciaFiscal[] = [];
    const empresa = await this.empresas.obter(empresaId);
    const cnpj = digitosDoc(empresa.cnpj);
    if (cnpj.length !== 14) {
      pendencias.push({
        codigo: 'EMPRESA_CNPJ',
        campo: 'cnpj',
        mensagem: 'CNPJ da empresa ausente ou invalido',
        onde: 'Configuracoes → Empresa',
      });
    }
    const end = (empresa.enderecoFiscal ?? {}) as Record<string, string>;
    for (const [campo, rotulo] of [
      ['logradouro', 'logradouro'],
      ['numero', 'numero'],
      ['bairro', 'bairro'],
      ['municipio', 'municipio'],
      ['uf', 'uf'],
      ['cep', 'cep'],
    ] as const) {
      if (!end[campo]) {
        pendencias.push({
          codigo: 'EMPRESA_ENDERECO',
          campo,
          mensagem: `Endereco fiscal da empresa sem ${rotulo}`,
          onde: 'Configuracoes → Empresa (endereco fiscal)',
        });
      }
    }

    const contato = pedido.oportunidade.contato;
    const doc = digitosDoc(contato.documento);
    if (doc.length !== 11 && doc.length !== 14) {
      pendencias.push({
        codigo: 'DEST_DOCUMENTO',
        campo: 'documento',
        mensagem: 'Cliente sem CPF/CNPJ',
        onde: `Clientes → ${contato.nome}`,
      });
    }
    const endCli = this.enderecoCliente(contato, pedido.oportunidade);
    for (const [campo, rotulo] of [
      ['logradouro', 'logradouro'],
      ['numero', 'numero'],
      ['bairro', 'bairro'],
      ['municipio', 'cidade'],
      ['uf', 'UF'],
      ['cep', 'CEP'],
    ] as const) {
      if (!endCli[campo as keyof typeof endCli]) {
        pendencias.push({
          codigo: 'DEST_ENDERECO',
          campo,
          mensagem: `Endereco do destinatario sem ${rotulo}`,
          onde: `Clientes → ${contato.nome} (ou obra do negocio)`,
        });
      }
    }
    if (doc.length === 14 && !endCli.ie) {
      // IE do destinatário PJ: aviso até regra do contador (P3) — não inventar isenção.
      pendencias.push({
        codigo: 'DEST_IE',
        campo: 'inscricaoEstadual',
        mensagem: 'IE do destinatario PJ nao informada (confirmar isencao com contador)',
        onde: `Clientes → ${contato.nome}`,
      });
    }

    for (const item of pedido.itens) {
      if (!item.produtoId) {
        const ncm = digitosDoc(item.produto?.ncm);
        // avulso: produto nulo — exigir NCM via descrição? Sem produto não há NCM cadastral
        pendencias.push({
          codigo: 'ITEM_AVULSO_FISCAL',
          campo: 'ncm',
          mensagem: `Item avulso "${item.nome}" exige dados fiscais (NCM etc.) antes da emissao — cadastre produto ou complete na ECOL-02/P3`,
          onde: `Pedido ${pedido.numero}`,
          itemPedidoId: item.id,
        });
        void ncm;
        continue;
      }
      const ncm = digitosDoc(item.produto?.ncm);
      if (ncm.length !== 8) {
        pendencias.push({
          codigo: 'ITEM_NCM',
          campo: 'ncm',
          mensagem: `Item "${item.nome}" sem NCM (8 digitos)`,
          onde: `Estoque/Produtos → ${item.produto?.nome ?? item.nome}`,
          itemPedidoId: item.id,
        });
      }
      if (!item.produto?.origemFiscal?.trim()) {
        pendencias.push({
          codigo: 'ITEM_ORIGEM',
          campo: 'origemFiscal',
          mensagem: `Item "${item.nome}" sem origem fiscal cadastrada`,
          onde: `Estoque/Produtos → ${item.produto?.nome ?? item.nome}`,
          itemPedidoId: item.id,
        });
      }
    }

    const params = await this.paramsFiscais(empresaId);
    if (!parametrosFiscaisCompletos(params)) {
      pendencias.push({
        codigo: 'P3_PARAMETROS',
        campo: 'parametrosFiscais',
        mensagem:
          'Regime, CFOP, CSOSN/CST e natureza nao definidos (P3). Emissao real bloqueada; mock estrutural permitido sem token Focus.',
        onde: 'ECOL-02 / contador (P3)',
      });
    }

    if (!this.focus.configurado()) {
      pendencias.push({
        codigo: 'CERTIFICADO_TOKEN',
        campo: 'FOCUS_NFE_TOKEN',
        mensagem: 'Token Focus / certificado nao configurado — apenas mock local',
        onde: 'Ambiente servidor (segredo; ECOL-02/P3)',
      });
    }

    return pendencias;
  }

  private montarPayload(entrada: {
    params: ReturnType<typeof lerParametrosFiscais>;
    cnpjEmitente: string;
    ie?: string;
    enderecoEmit: Record<string, string>;
    nomeEmitente: string;
    contatoNome: string;
    docDest: string;
    emailDest?: string;
    enderecoDest: Record<string, string | null>;
    itens: Array<{
      numero: number;
      codigo: string;
      descricao: string;
      ncm: string;
      cest?: string;
      origem?: string;
      quantidade: number;
      valorUnitario: number;
      valorTotal: number;
      unidade: string;
    }>;
    valorTotal: number;
  }): Record<string, unknown> {
    const destKey = entrada.docDest.length === 11 ? 'cpf_destinatario' : 'cnpj_destinatario';
    const agora = new Date().toISOString();
    const cfop = entrada.params.cfopPadrao; // null se P3 aberto — não inventar
    const csosn = entrada.params.csosnPadrao;
    const cst = entrada.params.cstPadrao;
    const informacoesAdicionais = entrada.params.informacoesComplementaresNfe
      ? [entrada.params.informacoesComplementaresNfe, entrada.params.tratamentoSt]
          .filter((t): t is string => Boolean(t))
          .join('\n')
          .slice(0, 2000)
      : null;
    return {
      ...(entrada.params.naturezaOperacao
        ? { natureza_operacao: entrada.params.naturezaOperacao }
        : {}),
      data_emissao: agora,
      data_entrada_saida: agora,
      tipo_documento: 1,
      finalidade_emissao: 1,
      local_destino: 1,
      consumidor_final: 1,
      presencial: 9,
      cnpj_emitente: entrada.cnpjEmitente,
      ...(entrada.ie ? { inscricao_estadual_emitente: entrada.ie } : {}),
      logradouro_emitente: entrada.enderecoEmit.logradouro,
      numero_emitente: entrada.enderecoEmit.numero,
      bairro_emitente: entrada.enderecoEmit.bairro,
      municipio_emitente: entrada.enderecoEmit.municipio,
      uf_emitente: (entrada.enderecoEmit.uf || '').toUpperCase(),
      cep_emitente: digitosDoc(entrada.enderecoEmit.cep),
      nome_destinatario: entrada.contatoNome,
      [destKey]: entrada.docDest,
      ...(entrada.emailDest ? { email_destinatario: entrada.emailDest } : {}),
      logradouro_destinatario: entrada.enderecoDest.logradouro,
      numero_destinatario: entrada.enderecoDest.numero,
      bairro_destinatario: entrada.enderecoDest.bairro,
      municipio_destinatario: entrada.enderecoDest.municipio,
      uf_destinatario: (entrada.enderecoDest.uf || '').toUpperCase(),
      cep_destinatario: digitosDoc(entrada.enderecoDest.cep),
      ...(entrada.enderecoDest.ie
        ? { inscricao_estadual_destinatario: entrada.enderecoDest.ie }
        : {}),
      items: entrada.itens.map((item) => ({
        numero_item: item.numero,
        codigo_produto: String(item.codigo).slice(0, 60),
        descricao: item.descricao.slice(0, 120),
        ...(cfop ? { cfop } : {}),
        codigo_ncm: item.ncm,
        ...(item.cest ? { codigo_cest: digitosDoc(item.cest) } : {}),
        unidade_comercial: item.unidade.slice(0, 6).toUpperCase(),
        quantidade_comercial: item.quantidade,
        valor_unitario_comercial: Number(item.valorUnitario.toFixed(4)),
        valor_bruto: Number(item.valorTotal.toFixed(2)),
        unidade_tributavel: item.unidade.slice(0, 6).toUpperCase(),
        quantidade_tributavel: item.quantidade,
        valor_unitario_tributavel: Number(item.valorUnitario.toFixed(4)),
        ...(item.origem != null && item.origem !== ''
          ? { icms_origem: Number(item.origem) }
          : {}),
        ...(csosn
          ? { icms_situacao_tributaria: csosn }
          : cst
            ? { icms_situacao_tributaria: cst }
            : {}),
      })),
      valor_produtos: Number(entrada.valorTotal.toFixed(2)),
      valor_total: Number(entrada.valorTotal.toFixed(2)),
      modalidade_frete: 9,
      _ecolume: true,
      // Texto do contador (P3). Só envia se informações complementares existirem;
      // tratamentoSt entra como texto adicional (sem inventar códigos tributários).
      ...(informacoesAdicionais
        ? { informacoes_adicionais_contribuinte: informacoesAdicionais }
        : {}),
      _parametrosInformados: parametrosFiscaisCompletos(entrada.params),
      _envioEmailViaFocus: this.focus.configurado(),
    };
  }

  private async aplicarResposta(
    id: string,
    empresaId: string,
    body: Record<string, unknown>,
    mock: boolean,
    usuarioId?: string | null,
  ) {
    const statusRaw = String(body.status ?? '').toLowerCase();
    let status: StatusNotaFiscal = StatusNotaFiscal.PROCESSANDO;
    if (['autorizado', 'autorizada'].includes(statusRaw)) {
      status = StatusNotaFiscal.AUTORIZADA;
    } else if (
      ['erro_autorizacao', 'rejeitado', 'rejeitada', 'denegado', 'cancelado', 'cancelada'].includes(
        statusRaw,
      )
    ) {
      status = statusRaw.includes('cancel')
        ? StatusNotaFiscal.CANCELADA
        : StatusNotaFiscal.REJEITADA;
    }

    const mensagemErro =
      status === StatusNotaFiscal.REJEITADA || status === StatusNotaFiscal.CANCELADA
        ? String(body.mensagem_sefaz ?? body.mensagem ?? body.status_sefaz ?? '') ||
          (mock ? 'Rejeicao/cancelamento simulado' : null)
        : mock
          ? String(body.mensagem ?? 'Emissao simulada (sem Focus token / P3)')
          : null;

    let arquivoXmlId: string | undefined;
    let arquivoPdfId: string | undefined;
    if (!mock && status === StatusNotaFiscal.AUTORIZADA) {
      const xmlPath = body.caminho_xml_nota_fiscal
        ? String(body.caminho_xml_nota_fiscal)
        : '';
      const pdfPath = body.caminho_danfe ? String(body.caminho_danfe) : '';
      if (xmlPath) {
        const buf = await this.focus.baixarArquivo(xmlPath);
        if (buf) {
          const arq = await this.arquivos.enviar(empresaId, null, {
            nome: `nfe-${id}.xml`,
            tipoMime: 'application/xml',
            conteudo: buf,
            entidade: 'NOTA_FISCAL',
            entidadeId: id,
          });
          arquivoXmlId = arq.id;
        }
      }
      if (pdfPath) {
        const buf = await this.focus.baixarArquivo(pdfPath);
        if (buf) {
          const arq = await this.arquivos.enviar(empresaId, null, {
            nome: `danfe-${id}.pdf`,
            tipoMime: 'application/pdf',
            conteudo: buf,
            entidade: 'NOTA_FISCAL',
            entidadeId: id,
          });
          arquivoPdfId = arq.id;
        }
      }
    }

    const anterior = await this.prisma.notaFiscal.findFirst({
      where: { id, empresaId },
      select: { status: true, pedidoId: true },
    });

    const nota = await this.prisma.$transaction(async (tx) => {
      const atualizada = await tx.notaFiscal.update({
        where: { id },
        data: {
          status,
          chaveAcesso: body.chave_nfe ? String(body.chave_nfe) : undefined,
          numero: body.numero != null ? String(body.numero) : undefined,
          serie: body.serie != null ? String(body.serie) : undefined,
          protocolo: body.protocolo ? String(body.protocolo) : undefined,
          mensagemErro,
          idExternoFocus: body.id ? String(body.id) : undefined,
          respostaFocus: mock ? ({ ...body, _mock: true } as object) : (body as object),
          autorizadoEm: status === StatusNotaFiscal.AUTORIZADA ? new Date() : null,
          ...(arquivoXmlId ? { arquivoXmlId } : {}),
          ...(arquivoPdfId ? { arquivoPdfId } : {}),
        },
        include: { itens: true },
      });

      const fato =
        status === StatusNotaFiscal.AUTORIZADA && anterior?.status !== StatusNotaFiscal.AUTORIZADA
          ? TipoAuditoria.EMISSAO_NF
          : status === StatusNotaFiscal.CANCELADA && anterior?.status !== StatusNotaFiscal.CANCELADA
            ? TipoAuditoria.CANCELAMENTO_NF
            : null;
      if (fato) {
        await this.auditoria.registrar(tx, {
          empresaId,
          usuarioId,
          tipo: fato,
          entidade: 'nota_fiscal',
          entidadeId: id,
          anterior: { status: anterior?.status ?? null },
          posterior: { status, numero: atualizada.numero, serie: atualizada.serie },
        });
      }
      return atualizada;
    });

    if (anterior?.pedidoId) {
      await this.sincronizarChecklistNf(empresaId, anterior.pedidoId, usuarioId ?? null);
    }
    return nota;
  }

  /** Cobertura 100% autorizada → checklist NF; reabre se cancelar. */
  async sincronizarChecklistNf(
    empresaId: string,
    pedidoId: string,
    usuarioId: string | null,
  ) {
    const pedido = await this.prisma.pedido.findFirst({
      where: { id: pedidoId, empresaId },
      include: { itens: true, checklist: true },
    });
    if (!pedido) return;

    const disponivel = await this.quantidadesDisponiveis(empresaId, pedidoId);
    // Cobertura integral = nada disponível considerando só AUTORIZADA
    const autorizados = await this.prisma.itemNotaFiscal.groupBy({
      by: ['itemPedidoId'],
      where: {
        empresaId,
        itemPedidoId: { not: null },
        nota: { pedidoId, status: StatusNotaFiscal.AUTORIZADA },
      },
      _sum: { quantidade: true },
    });
    let coberturaTotal = true;
    for (const item of pedido.itens) {
      const fat = autorizados.find((a) => a.itemPedidoId === item.id);
      const q = fat?._sum.quantidade ? Number(fat._sum.quantidade) : 0;
      if (q + 1e-9 < item.quantidade) {
        coberturaTotal = false;
        break;
      }
    }
    void disponivel;

    const nfItem = pedido.checklist.find((c) => c.tipo === TipoChecklistPedido.NF_EMITIDA);
    if (!nfItem || !nfItem.aplicavel) return;

    await this.prisma.$transaction(async (tx) => {
      if (coberturaTotal && !nfItem.concluido) {
        await tx.checklistItemPedido.update({
          where: { id: nfItem.id },
          data: { concluido: true, concluidoEm: new Date(), usuarioId },
        });
      } else if (!coberturaTotal && nfItem.concluido) {
        await tx.checklistItemPedido.update({
          where: { id: nfItem.id },
          data: { concluido: false, concluidoEm: null, usuarioId },
        });
      }

      const checklist = await tx.checklistItemPedido.findMany({ where: { pedidoId } });
      const aplicaveis = checklist.filter((c) => c.aplicavel);
      const completo = aplicaveis.length > 0 && aplicaveis.every((c) => c.concluido);
      const ped = await tx.pedido.findFirstOrThrow({ where: { id: pedidoId } });
      if (completo && ped.status !== StatusPedido.FINALIZADO) {
        await tx.pedido.update({
          where: { id: pedidoId },
          data: { status: StatusPedido.FINALIZADO, finalizadoEm: new Date() },
        });
        await tx.historicoFasePedido.create({
          data: {
            empresaId,
            pedidoId,
            faseAnterior: ped.faseKanban,
            faseNova: ChaveEtapaSistema.PEDIDO_FINALIZADO,
            origem: 'CHECKLIST',
            usuarioId,
            motivo: 'Checklist 100% (NF autorizada)',
          },
        });
      } else if (!completo && ped.status === StatusPedido.FINALIZADO) {
        await tx.pedido.update({
          where: { id: pedidoId },
          data: { status: StatusPedido.CONFIRMADO, finalizadoEm: null },
        });
        await tx.historicoFasePedido.create({
          data: {
            empresaId,
            pedidoId,
            faseAnterior: ChaveEtapaSistema.PEDIDO_FINALIZADO,
            faseNova: ped.faseKanban || FaseKanbanPedido.ENTREGUE,
            origem: 'CHECKLIST',
            usuarioId,
            motivo: 'Checklist reaberto (NF)',
          },
        });
      }
    });
  }
}
