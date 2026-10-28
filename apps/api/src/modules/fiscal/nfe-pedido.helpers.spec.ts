import { describe, expect, it } from 'vitest';
import {
  cartaCorrecaoNfSchema,
  digitosDoc,
  enviarEmailNfSchema,
  lerParametrosFiscais,
  parametrosFiscaisCompletos,
  type ParametrosFiscaisNfe,
} from '@arcco/contratos';

const base: ParametrosFiscaisNfe = {
  regimeTributario: null,
  cfopPadrao: null,
  csosnPadrao: null,
  cstPadrao: null,
  naturezaOperacao: null,
  tratamentoSt: null,
  informacoesComplementaresNfe: null,
};

describe('ECOL-24 parâmetros fiscais (P3)', () => {
  it('não inventa CFOP/regime quando config vazia', () => {
    const p = lerParametrosFiscais({});
    expect(p.cfopPadrao).toBeNull();
    expect(p.regimeTributario).toBeNull();
    expect(p.tratamentoSt).toBeNull();
    expect(p.informacoesComplementaresNfe).toBeNull();
    expect(parametrosFiscaisCompletos(p)).toBe(false);
  });

  it('exige CSOSN ou CST além de regime/CFOP/natureza', () => {
    expect(
      parametrosFiscaisCompletos({
        ...base,
        regimeTributario: 'simples',
        cfopPadrao: '5102',
        naturezaOperacao: 'Venda',
      }),
    ).toBe(false);
    expect(
      parametrosFiscaisCompletos({
        ...base,
        regimeTributario: 'simples',
        cfopPadrao: '5102',
        csosnPadrao: '102',
        naturezaOperacao: 'Venda de mercadoria',
      }),
    ).toBe(true);
  });

  it('ECOL-28b: lê tratamentoSt/informacoesComplementaresNfe sem exigir para completude', () => {
    const p = lerParametrosFiscais({
      tratamentoSt: '  Texto ST do contador  ',
      informacoesComplementaresNfe: 'Info complementar',
    });
    expect(p.tratamentoSt).toBe('Texto ST do contador');
    expect(p.informacoesComplementaresNfe).toBe('Info complementar');
    // Somente textos livres: P3 continua incompleta.
    expect(parametrosFiscaisCompletos(p)).toBe(false);
    expect(
      parametrosFiscaisCompletos({
        ...base,
        regimeTributario: 'simples',
        cfopPadrao: '5102',
        csosnPadrao: '102',
        naturezaOperacao: 'Venda',
      }),
    ).toBe(true);
  });

  it('ECOL-28b: schemas de CC-e e e-mail', () => {
    expect(cartaCorrecaoNfSchema.safeParse({ correcao: 'curto' }).success).toBe(false);
    expect(cartaCorrecaoNfSchema.safeParse({ correcao: 'x'.repeat(1001) }).success).toBe(false);
    expect(cartaCorrecaoNfSchema.safeParse({ correcao: 'Correcao com mais de quinze' }).success).toBe(
      true,
    );
    expect(enviarEmailNfSchema.safeParse({ emails: [] }).success).toBe(false);
    expect(enviarEmailNfSchema.safeParse({ emails: ['invalido'] }).success).toBe(false);
    expect(
      enviarEmailNfSchema.safeParse({ emails: Array.from({ length: 11 }, (_, i) => `a${i}@x.com`) })
        .success,
    ).toBe(false);
    expect(enviarEmailNfSchema.safeParse({ emails: ['ok@teste.com'] }).success).toBe(true);
  });

  it('digitosDoc remove máscara', () => {
    expect(digitosDoc('12.345.678/0001-90')).toBe('12345678000190');
    expect(digitosDoc(null)).toBe('');
  });
});
