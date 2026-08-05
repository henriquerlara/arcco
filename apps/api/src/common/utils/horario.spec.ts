import { describe, expect, it } from 'vitest';
import type { HorarioAtendimento } from '@arcco/contratos';
import { estaEmHorarioAtendimento } from './horario';

const comercial: HorarioAtendimento = {
  segunda: [{ inicio: '08:00', fim: '18:00' }],
  terca: [{ inicio: '08:00', fim: '18:00' }],
  quarta: [{ inicio: '08:00', fim: '18:00' }],
  quinta: [{ inicio: '08:00', fim: '18:00' }],
  sexta: [{ inicio: '08:00', fim: '18:00' }],
  sabado: [],
  domingo: [],
};

// Datas em UTC; America/Sao_Paulo = UTC-3.
describe('estaEmHorarioAtendimento', () => {
  it('esta aberto numa quarta 14h local (17h UTC)', () => {
    const data = new Date('2026-07-15T17:00:00Z');
    expect(estaEmHorarioAtendimento(comercial, data)).toBe(true);
  });

  it('esta fechado numa quarta 20h local (23h UTC)', () => {
    const data = new Date('2026-07-15T23:00:00Z');
    expect(estaEmHorarioAtendimento(comercial, data)).toBe(false);
  });

  it('esta fechado no domingo', () => {
    const data = new Date('2026-07-19T15:00:00Z');
    expect(estaEmHorarioAtendimento(comercial, data)).toBe(false);
  });

  it('esta fechado antes da abertura (07h local / 10h UTC)', () => {
    const data = new Date('2026-07-15T10:00:00Z');
    expect(estaEmHorarioAtendimento(comercial, data)).toBe(false);
  });

  it('retorna false sem configuracao', () => {
    expect(estaEmHorarioAtendimento(null)).toBe(false);
  });
});
