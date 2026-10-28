import { describe, expect, it } from 'vitest';
import {
  apresentarCusto,
  calcularCustoAposEntrada,
  custoInterno,
  precisaCustoReferenciaSaldo,
} from './custo-medio';

describe('ECOL-05 custo médio', () => {
  it('reproduz a tabela 7.7.2', () => {
    const primeira = calcularCustoAposEntrada({
      saldoAnterior: 0,
      custoMedioAnterior: null,
      quantidadeEntrada: 10,
      precoUnitario: 100,
    });
    expect(primeira).toEqual({ custoMedio: 100, ultimoPreco: 100 });
    expect(apresentarCusto(primeira.custoMedio)).toBe(100);

    const segunda = calcularCustoAposEntrada({
      saldoAnterior: 10,
      custoMedioAnterior: primeira.custoMedio,
      quantidadeEntrada: 20,
      precoUnitario: 120,
    });
    expect(segunda.custoMedio).toBe(113.3333);
    expect(segunda.ultimoPreco).toBe(120);
    expect(apresentarCusto(segunda.custoMedio)).toBe(113.33);

    const aposBaixa = { custoMedio: segunda.custoMedio, ultimoPreco: segunda.ultimoPreco };
    expect(aposBaixa).toEqual({ custoMedio: 113.3333, ultimoPreco: 120 });

    const depoisDoZero = calcularCustoAposEntrada({
      saldoAnterior: 0,
      custoMedioAnterior: aposBaixa.custoMedio,
      quantidadeEntrada: 5,
      precoUnitario: 125,
    });
    expect(depoisDoZero).toEqual({ custoMedio: 125, ultimoPreco: 125 });
  });

  it('com saldo negativo usa o preço da entrada', () => {
    expect(
      calcularCustoAposEntrada({
        saldoAnterior: -2,
        custoMedioAnterior: 80,
        quantidadeEntrada: 5,
        precoUnitario: 90,
      }),
    ).toEqual({ custoMedio: 90, ultimoPreco: 90 });
  });

  it('com saldo positivo e média nula pondera o custo de referência', () => {
    expect(precisaCustoReferenciaSaldo(40, null)).toBe(true);
    expect(precisaCustoReferenciaSaldo(0, null)).toBe(false);
    expect(precisaCustoReferenciaSaldo(40, 100)).toBe(false);

    const resultado = calcularCustoAposEntrada({
      saldoAnterior: 40,
      custoMedioAnterior: null,
      quantidadeEntrada: 10,
      precoUnitario: 120,
      custoReferenciaSaldo: 100,
    });
    // (40*100 + 10*120) / 50 = 104
    expect(resultado).toEqual({ custoMedio: 104, ultimoPreco: 120 });
  });

  it('grava quatro casas sem arredondar os fatores antes da divisão', () => {
    const resultado = calcularCustoAposEntrada({
      saldoAnterior: 10,
      custoMedioAnterior: 100,
      quantidadeEntrada: 20,
      precoUnitario: 120,
    });
    expect(custoInterno(resultado.custoMedio)).toBe(113.3333);
    expect(String(resultado.custoMedio)).toBe('113.3333');
  });
});
