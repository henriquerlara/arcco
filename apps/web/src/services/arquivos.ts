import { desembrulhar, http, urlApi } from './http';

export interface Arquivo {
  id: string;
  nome: string;
  tipoMime: string;
  tamanho: number;
  entidade?: string | null;
  entidadeId?: string | null;
  enviadoPorId?: string | null;
  criadoEm: string;
}

export const servicoArquivos = {
  async listar(entidade?: string, entidadeId?: string): Promise<Arquivo[]> {
    return desembrulhar<Arquivo[]>(await http.get('/arquivos', { entidade, entidadeId }));
  },
  async enviar(arquivo: File, entidade?: string, entidadeId?: string): Promise<Arquivo> {
    const form = new FormData();
    if (entidade) form.append('entidade', entidade);
    if (entidadeId) form.append('entidadeId', entidadeId);
    form.append('arquivo', arquivo);
    return desembrulhar<Arquivo>(await http.post('/arquivos/upload', form));
  },
  async blob(id: string): Promise<Blob> {
    const resposta = await fetch(urlApi(`/arquivos/${id}/conteudo`), {
      credentials: 'include',
    });
    if (!resposta.ok) {
      throw new Error('Não foi possível abrir o arquivo.');
    }
    return resposta.blob();
  },
  async abrir(id: string): Promise<void> {
    const popup = window.open('about:blank', '_blank');
    const blob = await this.blob(id);
    const url = URL.createObjectURL(blob);
    if (popup) {
      popup.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener');
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  async baixar(id: string, nomeArquivo: string): Promise<void> {
    const blob = await this.blob(id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  async compartilhar(id: string, nomeArquivo: string, titulo: string): Promise<'share' | 'download'> {
    const blob = await this.blob(id);
    const arquivo = new File([blob], nomeArquivo, { type: blob.type || 'application/pdf' });
    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data: ShareData) => boolean;
    };
    if (typeof nav.share === 'function') {
      const data: ShareData = { files: [arquivo], title: titulo, text: titulo };
      if (!nav.canShare || nav.canShare(data)) {
        try {
          await nav.share(data);
          return 'share';
        } catch (e) {
          if ((e as Error)?.name === 'AbortError') return 'share';
        }
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'download';
  },
};
