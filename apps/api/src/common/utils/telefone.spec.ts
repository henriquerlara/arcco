import { describe, expect, it } from 'vitest';
import { formatarTelefone, normalizarTelefone, telefonesIguais } from './telefone';

describe('normalizarTelefone', () => {
  it('normaliza celular nacional com DDD adicionando 55', () => {
    expect(normalizarTelefone('(11) 98888-1111')).toBe('5511988881111');
  });

  it('normaliza fixo nacional', () => {
    expect(normalizarTelefone('11 3000-1000')).toBe('551130001000');
  });

  it('mantem numero que ja possui DDI 55', () => {
    expect(normalizarTelefone('5511988881111')).toBe('5511988881111');
  });

  it('remove zero de tronco a esquerda', () => {
    expect(normalizarTelefone('011988881111')).toBe('5511988881111');
  });

  it('remove caracteres nao numericos', () => {
    expect(normalizarTelefone('+55 (11) 98888-1111')).toBe('5511988881111');
  });

  it('retorna vazio para entrada vazia ou nula', () => {
    expect(normalizarTelefone('')).toBe('');
    expect(normalizarTelefone(null)).toBe('');
    expect(normalizarTelefone(undefined)).toBe('');
  });

  it('mantem numeros longos com outro DDI (mais de 13 digitos)', () => {
    expect(normalizarTelefone('+44 20 7946 0018 99')).toBe('442079460018' + '99');
  });
});

describe('telefonesIguais', () => {
  it('considera iguais numeros com formatacoes diferentes', () => {
    expect(telefonesIguais('(11) 98888-1111', '5511988881111')).toBe(true);
  });

  it('diferencia numeros distintos', () => {
    expect(telefonesIguais('(11) 98888-1111', '(11) 98888-2222')).toBe(false);
  });
});

describe('formatarTelefone', () => {
  it('formata celular normalizado', () => {
    expect(formatarTelefone('5511988881111')).toBe('+55 (11) 98888-1111');
  });
});
