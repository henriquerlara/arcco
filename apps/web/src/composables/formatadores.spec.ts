import { describe, expect, it } from 'vitest';
import {
  aplicarMascara,
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

  it('aplica máscaras de digitação', () => {
    expect(aplicarMascara('telefone', '11988887777')).toBe('(11) 98888-7777');
    expect(aplicarMascara('documento', '12345678901')).toBe('123.456.789-01');
    expect(aplicarMascara('cnpj', '12345678000199')).toBe('12.345.678/0001-99');
    expect(aplicarMascara('cep', '30130000')).toBe('30130-000');
    expect(aplicarMascara('uf', 'mg1')).toBe('MG');
    expect(aplicarMascara('moeda', 1250.5)).toBe('1.250,50');
    expect(aplicarMascara('ncm', '94051000')).toBe('9405.10.00');
  });

  it('formata telefone brasileiro', () => {
    expect(formatarTelefone('11988887777')).toBe('(11) 98888-7777');
    expect(formatarTelefone('553731800386')).toBe('+55 (37) 3180-0386');
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
