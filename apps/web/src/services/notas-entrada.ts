import { desembrulhar, http } from './http';

export type ConferenciaItem = {
  numeroItem: number;
  codigoFornecedor: string;
  descricaoFiscal: string;
  descricaoComercialSugerida: string;
  ncm: string | null;
  cest: string | null;
  origemFiscal: string | null;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  ipi: number | null;
  produtoReconhecido: { id: string; nome: string; controlaEstoque: boolean } | null;
  acaoSugerida: 'criar' | 'reconhecido';
  controlaEstoqueSugerido: boolean;
  precisaCustoReferenciaSaldo: boolean;
};

export type ConferenciaNota = {
  chaveAcesso: string;
  numero: string | null;
  serie: string | null;
  emitidoEm: string | null;
  valorTotal: number;
  emitente: { cnpj: string; nome: string };
  fornecedor: {
    id: string | null;
    nome: string;
    cnpj: string;
    aliquotaSt: number | null;
    novo: boolean;
  };
  itens: ConferenciaItem[];
};

export type ConferenciaPendente = ConferenciaNota & {
  notaId: string;
  status: string;
  decisoes: Array<{
    numeroItem: number;
    acao: 'criar' | 'vincular' | 'reconhecido';
    produtoId: string | null;
    descricaoComercial: string | null;
    controlaEstoque: boolean;
  }>;
};

export type NotaEntradaResumo = {
  id: string;
  chaveAcesso: string;
  numero: string | null;
  serie: string | null;
  emitidoEm: string | null;
  valorTotal: number;
  status: string;
  arquivoXmlId: string | null;
  fornecedor: { id: string; nome: string; nomeCurto: string | null; cnpj: string };
  qtdItens: number;
  criadoEm: string;
};

export type DecisaoItem = {
  numeroItem: number;
  acao: 'criar' | 'vincular' | 'reconhecido';
  produtoId?: string | null;
  descricaoComercial?: string | null;
  controlaEstoque?: boolean;
  custoReferenciaSaldo?: number | null;
};

export const servicoNotasEntrada = {
  async listar(): Promise<NotaEntradaResumo[]> {
    return desembrulhar<NotaEntradaResumo[]>(await http.get('/notas-entrada'));
  },
  async obter(id: string) {
    return desembrulhar(await http.get(`/notas-entrada/${id}`));
  },
  async previsualizar(xml: string): Promise<ConferenciaNota> {
    return desembrulhar<ConferenciaNota>(
      await http.post('/notas-entrada/previsualizar', { xml }),
    );
  },
  async confirmar(dados: {
    xml?: string;
    /** Nota PENDENTE salva antes; o XML vem do arquivo guardado. */
    notaEntradaId?: string;
    aliquotaStFornecedor?: number | null;
    itens: DecisaoItem[];
  }) {
    return desembrulhar(await http.post('/notas-entrada/confirmar', dados));
  },
  async salvarPendente(dados: {
    xml: string;
    aliquotaStFornecedor?: number | null;
    itens?: DecisaoItem[];
  }) {
    return desembrulhar<{ id: string; status: string }>(
      await http.post('/notas-entrada/pendente', dados),
    );
  },
  async obterConferencia(id: string): Promise<ConferenciaPendente> {
    return desembrulhar<ConferenciaPendente>(await http.get(`/notas-entrada/${id}/conferencia`));
  },
};
