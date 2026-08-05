import { describe, expect, it } from 'vitest';
import {
  formatarMoeda,
  formatarTelefone,
  iniciais,
  estaAtrasada,
} from './formatadores';

describe('formatadores', () => {
  it('formata moeda em BRL', () => {
    expect(formatarMoeda(1234.5)).toContain('1.234,50');
    expect(formatarMoeda(null)).toContain('0,00');
  });

  it('formata telefone brasileiro', () => {
    expect(formatarTelefone('11988887777')).toBe('(11) 98888-7777');
    expect(formatarTelefone(null)).toBe('—');
  });

  it('gera iniciais a partir do nome', () => {
    expect(iniciais('Maria Silva')).toBe('MS');
    expect(iniciais('João')).toBe('J');
    expect(iniciais('')).toBe('?');
  });

  it('detecta datas atrasadas', () => {
    const ontem = new Date(Date.now() - 86_400_000).toISOString();
    const amanha = new Date(Date.now() + 86_400_000).toISOString();
    expect(estaAtrasada(ontem)).toBe(true);
    expect(estaAtrasada(amanha)).toBe(false);
    expect(estaAtrasada(null)).toBe(false);
  });
});
