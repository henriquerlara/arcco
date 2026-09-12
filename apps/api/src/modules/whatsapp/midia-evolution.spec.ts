import { TipoMensagem } from '@arcco/contratos';
import { extrairMidia, extrairTextoEvolution, textoOuNomeArquivo } from './midia-evolution';

describe('midia-evolution', () => {
  it('ignora mensagem só de texto', () => {
    expect(extrairMidia({ conversation: 'oi' })).toBeNull();
    expect(extrairTextoEvolution({ conversation: 'oi' })).toBe('oi');
  });

  it('detecta PDF sem caption', () => {
    const message = {
      documentMessage: {
        fileName: 'lista-materiais.pdf',
        mimetype: 'application/pdf',
      },
    };
    expect(extrairMidia(message)).toEqual({
      tipo: TipoMensagem.DOCUMENTO,
      nome: 'lista-materiais.pdf',
      mime: 'application/pdf',
      caption: undefined,
    });
    expect(textoOuNomeArquivo(message)).toBe('lista-materiais.pdf');
  });

  it('usa caption da imagem quando existe', () => {
    const message = {
      imageMessage: { mimetype: 'image/jpeg', caption: 'fachada da obra' },
    };
    expect(extrairMidia(message)?.tipo).toBe(TipoMensagem.IMAGEM);
    expect(textoOuNomeArquivo(message)).toBe('fachada da obra');
  });

  it('desembrulha documentWithCaption', () => {
    const message = {
      documentWithCaptionMessage: {
        message: {
          documentMessage: { fileName: 'orcamento.pdf', mimetype: 'application/pdf' },
        },
      },
    };
    expect(extrairMidia(message)?.nome).toBe('orcamento.pdf');
    expect(textoOuNomeArquivo(message)).toBe('orcamento.pdf');
  });
});
