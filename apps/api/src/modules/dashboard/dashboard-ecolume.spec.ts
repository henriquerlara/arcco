import { describe, expect, it } from 'vitest';
import {
  resolverPeriodoDashboard,
  ticketMedio,
  variacaoPercentual,
} from '@arcco/contratos';

describe('ECOL-23 helpers dashboard', () => {
  it('este mês e mês anterior com comparação equivalente', () => {
    const agora = new Date(2026, 9, 27, 15, 0, 0);
    const p = resolverPeriodoDashboard({ chave: 'mes', agora });
    expect(p.de.getDate()).toBe(1);
    expect(p.de.getMonth()).toBe(9);
    expect(p.ateAnterior.getTime()).toBeLessThan(p.de.getTime());
  });

  it('ticket e variação', () => {
    expect(ticketMedio(1642.56, 1)).toBeCloseTo(1642.56, 2);
    expect(ticketMedio(100, 0)).toBe(0);
    expect(variacaoPercentual(110, 100)).toBeCloseTo(10, 5);
    expect(variacaoPercentual(50, 0)).toBeNull();
  });

  it('virada de ano no período ano', () => {
    const p = resolverPeriodoDashboard({
      chave: 'ano',
      agora: new Date(2026, 0, 15),
    });
    expect(p.de.getFullYear()).toBe(2026);
    expect(p.de.getMonth()).toBe(0);
    expect(p.de.getDate()).toBe(1);
  });
});
