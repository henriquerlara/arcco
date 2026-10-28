import { describe, expect, it } from 'vitest';
import {
  lerParametrosComerciais,
  parametrosComerciaisPadrao,
  percentualDescontoSobreSugerido,
  validarDescontoEfetivoOrcamento,
  validarPrecoDentroDoDescontoMaximo,
} from './parametros-comerciais.js';

describe('ECOL-02 parametros comerciais', () => {
  it('defaults corretos (desconto max null, RT 10, prazos 7, base TOTAL_PEDIDO)', () => {
    const p = parametrosComerciaisPadrao();
    expect(p.diasOrcamentoSemMovimentacao).toBe(7);
    expect(p.diasChecklistPendente).toBe(7);
    expect(p.rtPadraoParceiro).toBe(10);
    expect(p.baseRtComissao).toBe('TOTAL_PEDIDO');
    expect(p.descontoMaximoPercentual).toBeNull();
    expect(p.margemPadraoGlobal).toBeNull();
    expect(p.validadeOrcamentoDias).toBeNull();
    expect(p.fiscal.regimeTributario).toBeNull();
    expect(p.motivosPerda.length).toBeGreaterThanOrEqual(6);
  });

  it('lê valores gravados sem inventar desconto max', () => {
    const p = lerParametrosComerciais({
      diasOrcamentoSemMovimentacao: 5,
      rtPadraoParceiro: 12.5,
      descontoMaximoPercentual: 8,
      margemPadraoGlobal: 1.6,
      validadeOrcamentoDias: 15,
      motivosPerda: [{ codigo: 'X', rotulo: 'Custom', exigeDescricao: false }],
    });
    expect(p.diasOrcamentoSemMovimentacao).toBe(5);
    expect(p.rtPadraoParceiro).toBe(12.5);
    expect(p.descontoMaximoPercentual).toBe(8);
    expect(p.margemPadraoGlobal).toBe(1.6);
    expect(p.validadeOrcamentoDias).toBe(15);
    expect(p.motivosPerda).toEqual([{ codigo: 'X', rotulo: 'Custom', exigeDescricao: false }]);
    expect(p.baseRtComissao).toBe('TOTAL_PEDIDO');
  });

  it('ignora baseRtComissao inventada (P1)', () => {
    const p = lerParametrosComerciais({ baseRtComissao: 'LIQUIDO' });
    expect(p.baseRtComissao).toBe('TOTAL_PEDIDO');
  });
});

describe('ECOL-02 desconto sobre sugerido', () => {
  it('percentualDescontoSobreSugerido', () => {
    expect(percentualDescontoSobreSugerido(100, 90)).toBeCloseTo(10, 5);
    expect(percentualDescontoSobreSugerido(100, 100)).toBe(0);
    expect(percentualDescontoSobreSugerido(100, 110)).toBe(0);
  });

  it('abaixo, exatamente no limite e acima', () => {
    expect(
      validarPrecoDentroDoDescontoMaximo({
        precoSugerido: 100,
        precoPraticado: 95,
        descontoMaximoPercentual: 10,
      }).ok,
    ).toBe(true);
    expect(
      validarPrecoDentroDoDescontoMaximo({
        precoSugerido: 100,
        precoPraticado: 90,
        descontoMaximoPercentual: 10,
      }).ok,
    ).toBe(true);
    const acima = validarPrecoDentroDoDescontoMaximo({
      precoSugerido: 100,
      precoPraticado: 89,
      descontoMaximoPercentual: 10,
    });
    expect(acima.ok).toBe(false);
    if (!acima.ok) expect(acima.codigo).toBe('DESCONTO_ACIMA_DO_LIMITE');
  });

  it('sem limite bloqueia alteração', () => {
    const r = validarPrecoDentroDoDescontoMaximo({
      precoSugerido: 100,
      precoPraticado: 99,
      descontoMaximoPercentual: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe('PRECO_ALTERACAO_INDISPONIVEL');
  });

  it('item avulso sem sugerido bloqueia sem VER_CUSTOS', () => {
    const r = validarPrecoDentroDoDescontoMaximo({
      precoSugerido: null,
      precoPraticado: 50,
      descontoMaximoPercentual: 20,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe('PRECO_ALTERACAO_INDISPONIVEL');
  });

  it('combinação linhas+geral acima do máximo', () => {
    const r = validarDescontoEfetivoOrcamento({
      descontoMaximoPercentual: 10,
      totalSugerido: 1000,
      totalFinal: 850,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe('DESCONTO_ACIMA_DO_LIMITE');
  });

  it('combinação no limite passa', () => {
    expect(
      validarDescontoEfetivoOrcamento({
        descontoMaximoPercentual: 10,
        totalSugerido: 1000,
        totalFinal: 900,
      }).ok,
    ).toBe(true);
  });
});
