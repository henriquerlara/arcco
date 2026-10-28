import { describe, expect, it } from 'vitest';
import { LIMITE_XML_BYTES, parsearNfeXml, sanitizarXmlNfe } from './nfe-xml.parser';
import { CHAVE_A, montarNfeXml } from './fixtures/nfe-sintetica';

describe('parser NF-e ECOL-07', () => {
  it('parseia XML valido', () => {
    const xml = montarNfeXml({
      chave: CHAVE_A,
      vNF: 200,
      itens: [
        {
          nItem: 1,
          cProd: 'SKU-1',
          xProd: 'Spot LED',
          qCom: 2,
          vUnCom: 100,
          pIPI: 5,
          CEST: '1234567',
          orig: '1',
        },
      ],
    });
    const nfe = parsearNfeXml(xml);
    expect(nfe.chaveAcesso).toBe(CHAVE_A);
    expect(nfe.itens).toHaveLength(1);
    expect(nfe.itens[0]!.codigoProduto).toBe('SKU-1');
    expect(nfe.itens[0]!.ipi).toBe(5);
    expect(nfe.itens[0]!.origemFiscal).toBe('1');
    expect(nfe.valorTotal).toBe(200);
  });

  it('recusa DOCTYPE/ENTITY e XML enorme', () => {
    expect(() =>
      sanitizarXmlNfe(montarNfeXml({ chave: CHAVE_A, itens: [{ nItem: 1, cProd: 'A', xProd: 'A', qCom: 1, vUnCom: 1 }], comDoctype: true })),
    ).toThrow();
    expect(() => sanitizarXmlNfe(Buffer.alloc(LIMITE_XML_BYTES + 1, 97))).toThrow();
  });

  it('recusa documento sem NF-e ou chave invalida', () => {
    expect(() => parsearNfeXml('<root><foo/></root>')).toThrow();
    expect(() =>
      parsearNfeXml(
        montarNfeXml({
          chave: '123',
          itens: [{ nItem: 1, cProd: 'A', xProd: 'A', qCom: 1, vUnCom: 1 }],
        }).replace(CHAVE_A, '123'),
      ),
    ).toThrow();
  });
});
