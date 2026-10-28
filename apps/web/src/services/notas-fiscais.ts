import { desembrulhar, http } from './http';
import type { NotaFiscal } from '@/types';

export interface FocusNfeStatus {
  configurado: boolean;
  ambiente: 'homologacao' | 'producao';
  modo: 'focus' | 'mock';
  mensagem: string;
  certificado?: {
    provedorFocus: boolean;
    armazenamentoLocal: boolean;
    mensagem: string;
  };
  cartaCorrecaoDisponivel?: boolean;
  emailDanfeDisponivel?: boolean;
}

/** ECOL-28b — evento fiscal da NF-e (CC-e ou e-mail). */
export type EventoNotaFiscalResumo = {
  id: string;
  tipo: 'CCE' | 'EMAIL' | string;
  status: 'AUTORIZADO' | 'REJEITADO' | 'AGENDADO' | 'ERRO' | string;
  numeroSequencia: number | null;
  texto: string | null;
  emails: string[];
  mock: boolean;
  criadoEm: string;
};

export type ResultadoCartaCorrecao = {
  cartaCorrecaoSuportada: true;
  evento: EventoNotaFiscalResumo;
  mock: boolean;
};

export type ResultadoEnvioEmailNf = {
  evento: EventoNotaFiscalResumo;
  mock: boolean;
  envioReal: boolean;
  aviso: string | null;
};

export type StatusHomologacaoFiscal = {
  ambiente: 'homologacao' | 'producao';
  tokenConfigurado: boolean;
  p3Completo: boolean;
  p3Faltando: string[];
  tratamentoStInformado: boolean;
  informacoesComplementaresInformadas: boolean;
  emissaoRealHabilitada: boolean;
  modo: 'focus' | 'mock';
  certificado: { provedorFocus: boolean; armazenamentoLocal: boolean; mensagem: string };
  cartaCorrecaoDisponivel: boolean;
  cartaCorrecaoReal: boolean;
  emailDanfeDisponivel: boolean;
  emailDanfeReal: boolean;
  mensagem: string;
};

export type PendenciaFiscalNfe = {
  codigo: string;
  campo: string;
  mensagem: string;
  onde: string;
  itemPedidoId?: string;
};

export type PreparacaoNfePedido = {
  pedidoId: string;
  numero: string;
  statusPedido: string;
  emissaoRealHabilitada: boolean;
  parametrosFiscais: {
    regimeTributario: string | null;
    cfopPadrao: string | null;
    csosnPadrao: string | null;
    cstPadrao: string | null;
    naturezaOperacao: string | null;
    tratamentoSt?: string | null;
    informacoesComplementaresNfe?: string | null;
  };
  /** ECOL-28b */
  emailDestinatarioPadrao?: string | null;
  emailDanfeReal?: boolean;
  pendencias: PendenciaFiscalNfe[];
  itens: Array<{
    itemPedidoId: string;
    nome: string;
    nomeFiscalPadrao: string;
    codigoInterno: string | null;
    produtoId: string | null;
    quantidadeVendida: number;
    quantidadeDisponivel: number;
    precoUnitario: number;
    unidade: string;
    ncm: string | null;
    cest: string | null;
    origemFiscal: string | null;
    avulso: boolean;
  }>;
  notas: NotaFiscal[];
};

export const servicoNotasFiscais = {
  statusIntegracao(): Promise<FocusNfeStatus> {
    return http.get('/integrations/focus-nfe/status').then(desembrulhar<FocusNfeStatus>);
  },
  listarPorOportunidade(oportunidadeId: string): Promise<NotaFiscal[]> {
    return http
      .get(`/oportunidades/${oportunidadeId}/notas-fiscais`)
      .then(desembrulhar<NotaFiscal[]>);
  },
  listarPorOrcamento(orcamentoId: string): Promise<NotaFiscal[]> {
    return http.get(`/orcamentos/${orcamentoId}/notas-fiscais`).then(desembrulhar<NotaFiscal[]>);
  },
  emitir(orcamentoId: string): Promise<NotaFiscal> {
    return http.post(`/orcamentos/${orcamentoId}/emitir-nf`).then(desembrulhar<NotaFiscal>);
  },
  sincronizar(id: string): Promise<NotaFiscal> {
    return http.post(`/notas-fiscais/${id}/sincronizar`).then(desembrulhar<NotaFiscal>);
  },

  /** ECOL-24 */
  prepararPedido(pedidoId: string): Promise<PreparacaoNfePedido> {
    return http.get(`/pedidos/${pedidoId}/nfe/preparar`).then(desembrulhar<PreparacaoNfePedido>);
  },
  listarPorPedido(pedidoId: string): Promise<NotaFiscal[]> {
    return http.get(`/pedidos/${pedidoId}/notas-fiscais`).then(desembrulhar<NotaFiscal[]>);
  },
  emitirPedido(
    pedidoId: string,
    dados: {
      itens: Array<{
        itemPedidoId: string;
        quantidade: number;
        descricao?: string;
        ncm?: string;
        cest?: string | null;
        origemFiscal?: string;
      }>;
      idempotencyKey?: string;
    },
  ): Promise<NotaFiscal> {
    return http.post(`/pedidos/${pedidoId}/emitir-nf`, dados).then(desembrulhar<NotaFiscal>);
  },
  cancelar(
    id: string,
    dados: { justificativa: string; confirmar: true },
  ): Promise<NotaFiscal & { limitacao?: string }> {
    return http
      .post(`/notas-fiscais/${id}/cancelar`, dados)
      .then(desembrulhar<NotaFiscal & { limitacao?: string }>);
  },

  /** ECOL-28b */
  cartaCorrecao(
    id: string,
    dados: { correcao: string },
  ): Promise<ResultadoCartaCorrecao> {
    return http
      .post(`/notas-fiscais/${id}/carta-correcao`, dados)
      .then(desembrulhar<ResultadoCartaCorrecao>);
  },
  enviarEmail(id: string, dados: { emails: string[] }): Promise<ResultadoEnvioEmailNf> {
    return http
      .post(`/notas-fiscais/${id}/enviar-email`, dados)
      .then(desembrulhar<ResultadoEnvioEmailNf>);
  },
  statusHomologacao(): Promise<StatusHomologacaoFiscal> {
    return http.get('/fiscal/status-homologacao').then(desembrulhar<StatusHomologacaoFiscal>);
  },

  /** ECOL-25 */
  listarEmitidas(): Promise<NotaEmitidaFiscal[]> {
    return http.get('/fiscal/notas-emitidas').then(desembrulhar<NotaEmitidaFiscal[]>);
  },
  listarPendentesEmissao(): Promise<PendentesEmissaoFiscal> {
    return http.get('/fiscal/pendentes-emissao').then(desembrulhar<PendentesEmissaoFiscal>);
  },
};

export type NotaEmitidaFiscal = {
  id: string;
  pedidoId: string | null;
  pedidoNumero: string | null;
  oportunidadeId: string;
  clienteNome: string | null;
  clienteId: string | null;
  clienteEmail?: string | null;
  eventos?: EventoNotaFiscalResumo[];
  status: string;
  numero: string | null;
  serie: string | null;
  chaveAcesso: string | null;
  mensagemErro: string | null;
  valorTotal: number;
  autorizadoEm: string | null;
  criadoEm: string;
  arquivoPdfId: string | null;
  arquivoXmlId: string | null;
  simulacao: boolean;
  itens: Array<{
    id: string;
    descricao: string;
    quantidade: number;
    precoUnitario: number;
    valorTotal: number;
    itemPedidoId: string | null;
  }>;
};

export type PendentesEmissaoFiscal = {
  emissaoRealHabilitada: boolean;
  focusConfigurado: boolean;
  parametrosFiscais: PreparacaoNfePedido['parametrosFiscais'];
  pedidos: Array<{
    pedidoId: string;
    numero: string;
    statusPedido: string;
    totalPedido: number;
    valorPendente: number;
    criadoEm: string;
    oportunidadeId: string;
    clienteNome: string | null;
    clienteId: string | null;
    itensPendentes: Array<{
      itemPedidoId: string;
      nome: string;
      quantidadeVendida: number;
      quantidadePendente: number;
      unidade: string;
      precoUnitario: number;
    }>;
    emissaoRealHabilitada: boolean;
  }>;
};
