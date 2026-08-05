export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface ArquivoParaSalvar {
  nomeArmazenamento: string;
  conteudo: Buffer;
  tipoMime: string;
}

export interface StorageProvider {
  readonly nome: string;
  salvar(arquivo: ArquivoParaSalvar): Promise<{ caminho: string; url?: string }>;
  obterUrl(caminho: string): Promise<string>;
  ler(caminho: string): Promise<Buffer>;
  remover(caminho: string): Promise<void>;
}
