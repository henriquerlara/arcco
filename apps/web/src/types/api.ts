export interface ErroApi {
  codigo: string;
  mensagem: string;
  detalhes?: Record<string, unknown> | unknown[] | null;
}

export interface Paginacao {
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
}

export interface RespostaPaginada<T> {
  dados: T[];
  paginacao: Paginacao;
}

export interface ParametrosPaginacao {
  pagina?: number;
  porPagina?: number;
  busca?: string;
}
