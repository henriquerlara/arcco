import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./http', () => ({
  urlApi: (path: string) => `http://api.test${path}`,
  http: {},
  desembrulhar: <T>(v: T) => v,
}));

function stubDom() {
  const click = vi.fn();
  const anchor = {
    href: '',
    download: '',
    rel: '',
    click,
    remove: vi.fn(),
  };
  vi.stubGlobal('document', {
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      innerHTML: '',
    },
    createElement: vi.fn(() => anchor),
  });
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal('window', { setTimeout: vi.fn((fn: () => void) => fn()) });
  return { click, anchor };
}

describe('ECOL-14 compartilhar PDF', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('usa navigator.share quando disponível', async () => {
    stubDom();
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, blob: async () => blob })),
    );
    const share = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', {
      share,
      canShare: () => true,
    });

    const { servicoArquivos } = await import('./arquivos');
    const modo = await servicoArquivos.compartilhar('arq-1', 'ORC-0001.pdf', 'Orçamento ORC-0001');
    expect(modo).toBe('share');
    expect(share).toHaveBeenCalledOnce();
  });

  it('faz fallback para download quando share indisponível', async () => {
    const { click } = stubDom();
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, blob: async () => blob })),
    );
    vi.stubGlobal('navigator', {});

    const { servicoArquivos } = await import('./arquivos');
    const modo = await servicoArquivos.compartilhar('arq-1', 'ORC-0001.pdf', 'Orçamento ORC-0001');
    expect(modo).toBe('download');
    expect(click).toHaveBeenCalled();
  });
});
