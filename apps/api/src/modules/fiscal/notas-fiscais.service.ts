import { Injectable, Logger } from '@nestjs/common';
import {
  StatusNotaFiscal,
  StatusOrcamento,
  TipoEtapaFunil,
  type EnderecoFiscal,
} from '@arcco/contratos';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { carregarEnv } from '../../config/env';
import { ArquivosService } from '../arquivos/arquivos.service';
import { EmpresasService } from '../empresas/empresas.service';
import { OrcamentosService } from '../orcamentos/orcamentos.service';
import { FocusNfeClient } from './focus-nfe.client';

@Injectable()
export class NotasFiscaisService {
  private readonly logger = new Logger('NotasFiscais');

  constructor(
    private readonly prisma: PrismaService,
    private readonly focus: FocusNfeClient,
    private readonly arquivos: ArquivosService,
    private readonly empresas: EmpresasService,
    private readonly orcamentos: OrcamentosService,
  ) {}

  statusIntegracao() {
    return {
      configurado: this.focus.configurado(),
      ambiente: this.focus.ambiente(),
      modo: this.focus.configurado() ? 'focus' : 'mock',
      mensagem: this.focus.configurado()
        ? 'Token Focus NFe configurado'
        : 'Sem FOCUS_NFE_TOKEN — emissões usam mock local',
    };
  }

  listarPorOportunidade(empresaId: string, oportunidadeId: string) {
    return this.prisma.notaFiscal.findMany({
      where: { empresaId, oportunidadeId },
      orderBy: { criadoEm: 'desc' },
    });
  }

  listarPorOrcamento(empresaId: string, orcamentoId: string) {
    return this.prisma.notaFiscal.findMany({
      where: { empresaId, orcamentoId },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async obter(empresaId: string, id: string) {
    const nf = await this.prisma.notaFiscal.findFirst({ where: { id, empresaId } });
    if (!nf) throw Erros.naoEncontrado('NF_NAO_ENCONTRADA', 'Nota fiscal não encontrada');
    return nf;
  }

  /**
   * Emite NF-e a partir do orçamento final em oportunidade GANHA.
   * Se ainda for rascunho/enviado (sem WhatsApp), converte automaticamente.
   */
  async emitirDeOrcamento(empresaId: string, orcamentoId: string, usuarioId?: string | null) {
    let orcamento = await this.orcamentos.buscarParaEmissao(empresaId, orcamentoId);
    if (!orcamento) {
      throw Erros.naoEncontrado('ORCAMENTO_NAO_ENCONTRADO', 'Orçamento não encontrado');
    }
    if (orcamento.oportunidade.etapa.tipo !== TipoEtapaFunil.GANHA) {
      throw Erros.invalido(
        'OPORTUNIDADE_NAO_GANHA',
        'A oportunidade precisa estar na etapa GANHA para emitir NF.',
      );
    }

    if (orcamento.status !== StatusOrcamento.CONVERTIDO) {
      const elegivel = (
        [
          StatusOrcamento.RASCUNHO,
          StatusOrcamento.ENVIADO,
          StatusOrcamento.ACEITO,
        ] as string[]
      ).includes(orcamento.status);
      if (!elegivel || orcamento.itens.length === 0) {
        throw Erros.invalido(
          'ORCAMENTO_NAO_CONVERTIDO',
          'Só é possível emitir NF do orçamento final (último montado na oportunidade ganha).',
        );
      }
      const convertidoId = await this.orcamentos.converterNoFechamento(
        empresaId,
        orcamento.oportunidadeId,
        usuarioId,
      );
      if (convertidoId !== orcamento.id) {
        throw Erros.invalido(
          'ORCAMENTO_NAO_E_O_FINAL',
          'Há outro orçamento marcado como final nesta oportunidade. Use o vigente.',
        );
      }
      orcamento = await this.orcamentos.exigirParaEmissao(empresaId, orcamentoId);
    }

    if (orcamento.status !== StatusOrcamento.CONVERTIDO) {
      throw Erros.invalido(
        'ORCAMENTO_NAO_CONVERTIDO',
        'Só é possível emitir NF de orçamento convertido (oportunidade ganha).',
      );
    }

    const jaAutorizada = await this.prisma.notaFiscal.findFirst({
      where: {
        empresaId,
        orcamentoId,
        status: StatusNotaFiscal.AUTORIZADA,
      },
    });
    const autorizadaDeVerdade =
      jaAutorizada &&
      !(jaAutorizada.respostaFocus as { _mock?: boolean } | null)?._mock;
    if (autorizadaDeVerdade) {
      throw Erros.conflito(
        'NF_JA_AUTORIZADA',
        'Já existe nota autorizada para este orçamento.',
      );
    }

    const empresa = await this.empresas.buscar(empresaId);
    if (!empresa) throw Erros.naoEncontrado('EMPRESA_NAO_ENCONTRADA', 'Empresa não encontrada');

    const cnpjEmitente = (empresa.cnpj ?? '').replace(/\D/g, '');
    if (cnpjEmitente.length !== 14) {
      throw Erros.invalido(
        'EMPRESA_SEM_CNPJ',
        'Cadastre o CNPJ da empresa em Configurações → Empresa antes de emitir.',
      );
    }

    const contato = orcamento.oportunidade.contato;
    const docDest = (contato.documento ?? '').replace(/\D/g, '');
    if (docDest.length !== 11 && docDest.length !== 14) {
      throw Erros.invalido(
        'DESTINATARIO_SEM_DOCUMENTO',
        'Cadastre CPF (11) ou CNPJ (14) no contato da oportunidade.',
      );
    }

    if (orcamento.itens.length === 0) {
      throw Erros.invalido('ORCAMENTO_SEM_ITENS', 'Orçamento sem itens para faturar.');
    }

    for (const item of orcamento.itens) {
      const ncm = (item.produto?.ncm ?? '').replace(/\D/g, '');
      if (ncm.length !== 8) {
        throw Erros.invalido(
          'ITEM_SEM_NCM',
          `Item "${item.nome}" sem NCM (8 dígitos). Cadastre NCM no produto vinculado.`,
        );
      }
    }

    const endereco = (empresa.enderecoFiscal ?? {}) as EnderecoFiscal;
    const prefix = carregarEnv().FOCUS_NFE_REF_PREFIX || 'arcco';
    const ref = `${prefix}-${orcamento.numero}-v${orcamento.versao}-${Date.now()}`;

    const payload = this.montarPayloadFocus({
      cnpjEmitente,
      ie: empresa.inscricaoEstadual ?? undefined,
      endereco,
      nomeEmitente: empresa.nomeFantasia || empresa.nome,
      contatoNome: contato.nome,
      docDest,
      emailDest: contato.email ?? undefined,
      itens: orcamento.itens.map((item, idx) => ({
        numero: idx + 1,
        codigo: item.produto?.sku || item.produtoId || `ITEM${idx + 1}`,
        descricao: item.nome,
        ncm: (item.produto?.ncm ?? '').replace(/\D/g, ''),
        quantidade: item.quantidade,
        valorUnitario: item.precoUnitario,
        valorTotal: item.totalLinha,
        unidade: item.unidade || 'UN',
      })),
      valorTotal: orcamento.total,
    });

    const nf = await this.prisma.notaFiscal.create({
      data: {
        empresaId,
        orcamentoId: orcamento.id,
        oportunidadeId: orcamento.oportunidadeId,
        status: StatusNotaFiscal.PROCESSANDO,
        refFocus: ref,
        payloadEnvio: payload as object,
        criadoPorId: usuarioId ?? null,
      },
    });

    try {
      const envio = await this.focus.emitirNfe(ref, payload);
      return this.aplicarRespostaFocus(nf.id, empresaId, envio.body, envio.mock);
    } catch (erro) {
      const msg = (erro as Error).message;
      this.logger.error(`Falha emissão ref=${ref}: ${msg}`);
      return this.prisma.notaFiscal.update({
        where: { id: nf.id },
        data: {
          status: StatusNotaFiscal.REJEITADA,
          mensagemErro: msg,
        },
      });
    }
  }

  async sincronizar(empresaId: string, id: string) {
    const nf = await this.obter(empresaId, id);
    if (!nf.refFocus) {
      throw Erros.invalido('NF_SEM_REF', 'Nota sem referência Focus');
    }
    const consulta = await this.focus.consultarNfe(nf.refFocus);
    return this.aplicarRespostaFocus(nf.id, empresaId, consulta.body, consulta.mock);
  }

  /** Webhook / atualização externa Focus (status por ref). */
  async processarWebhook(payload: Record<string, unknown>) {
    const ref = String(payload.ref ?? payload.referencia ?? '');
    if (!ref) return { ok: false, motivo: 'ref ausente' };
    const nf = await this.prisma.notaFiscal.findFirst({ where: { refFocus: ref } });
    if (!nf) return { ok: false, motivo: 'nota não encontrada' };
    await this.aplicarRespostaFocus(nf.id, nf.empresaId, payload, false);
    return { ok: true, id: nf.id };
  }

  private async aplicarRespostaFocus(
    id: string,
    empresaId: string,
    body: Record<string, unknown>,
    mock: boolean,
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
      status =
        statusRaw.includes('cancel') ? StatusNotaFiscal.CANCELADA : StatusNotaFiscal.REJEITADA;
    } else if (['processando_autorizacao', 'em_processamento'].includes(statusRaw)) {
      status = StatusNotaFiscal.PROCESSANDO;
    }

    const mensagemErro = mock
      ? String(body.mensagem ?? 'Emissão simulada (FOCUS_NFE_TOKEN ausente)')
      : status === StatusNotaFiscal.REJEITADA || status === StatusNotaFiscal.CANCELADA
        ? String(body.mensagem_sefaz ?? body.mensagem ?? body.status_sefaz ?? '') || null
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

    return this.prisma.notaFiscal.update({
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
    });
  }

  private montarPayloadFocus(entrada: {
    cnpjEmitente: string;
    ie?: string;
    endereco: EnderecoFiscal;
    nomeEmitente: string;
    contatoNome: string;
    docDest: string;
    emailDest?: string;
    itens: Array<{
      numero: number;
      codigo: string;
      descricao: string;
      ncm: string;
      quantidade: number;
      valorUnitario: number;
      valorTotal: number;
      unidade: string;
    }>;
    valorTotal: number;
  }): Record<string, unknown> {
    const destKey = entrada.docDest.length === 11 ? 'cpf_destinatario' : 'cnpj_destinatario';
    const agora = new Date().toISOString();

    return {
      natureza_operacao: 'Venda de mercadoria',
      data_emissao: agora,
      data_entrada_saida: agora,
      tipo_documento: 1,
      finalidade_emissao: 1,
      local_destino: 1,
      consumidor_final: 1,
      presencial: 9,
      cnpj_emitente: entrada.cnpjEmitente,
      ...(entrada.ie ? { inscricao_estadual_emitente: entrada.ie } : {}),
      logradouro_emitente: entrada.endereco.logradouro || 'Nao informado',
      numero_emitente: entrada.endereco.numero || 'S/N',
      ...(entrada.endereco.complemento
        ? { complemento_emitente: entrada.endereco.complemento }
        : {}),
      bairro_emitente: entrada.endereco.bairro || 'Centro',
      municipio_emitente: entrada.endereco.municipio || 'Belo Horizonte',
      uf_emitente: (entrada.endereco.uf || 'MG').toUpperCase(),
      cep_emitente: (entrada.endereco.cep || '30000000').replace(/\D/g, ''),
      nome_destinatario: entrada.contatoNome,
      [destKey]: entrada.docDest,
      ...(entrada.emailDest ? { email_destinatario: entrada.emailDest } : {}),
      // Destinatário: endereço mínimo (homologação Focus costuma exigir)
      logradouro_destinatario: 'Nao informado',
      numero_destinatario: 'S/N',
      bairro_destinatario: 'Centro',
      municipio_destinatario: entrada.endereco.municipio || 'Belo Horizonte',
      uf_destinatario: (entrada.endereco.uf || 'MG').toUpperCase(),
      cep_destinatario: (entrada.endereco.cep || '30000000').replace(/\D/g, ''),
      items: entrada.itens.map((item) => ({
        numero_item: item.numero,
        codigo_produto: String(item.codigo).slice(0, 60),
        descricao: item.descricao.slice(0, 120),
        cfop: '5102',
        codigo_ncm: item.ncm,
        unidade_comercial: item.unidade.slice(0, 6).toUpperCase(),
        quantidade_comercial: item.quantidade,
        valor_unitario_comercial: Number(item.valorUnitario.toFixed(4)),
        valor_bruto: Number(item.valorTotal.toFixed(2)),
        unidade_tributavel: item.unidade.slice(0, 6).toUpperCase(),
        quantidade_tributavel: item.quantidade,
        valor_unitario_tributavel: Number(item.valorUnitario.toFixed(4)),
        icms_origem: 0,
        icms_situacao_tributaria: '102',
      })),
      valor_produtos: Number(entrada.valorTotal.toFixed(2)),
      valor_total: Number(entrada.valorTotal.toFixed(2)),
      modalidade_frete: 9,
    };
  }
}
