import { describe, expect, it } from 'vitest';
import {
  avancarPeriodo,
  chaveDataLocal,
  diasDaSemana,
  diasGradeMes,
  fimMes,
  fimSemana,
  inicioMes,
  inicioSemana,
  parseChaveDataLocal,
  rotuloHorarioAgenda,
} from '@arcco/contratos';

describe('ECOL-22 helpers calendário', () => {
  it('semana começa na segunda e fecha no domingo', () => {
    // Quarta 2026-10-28
    const ref = new Date(2026, 9, 28, 15, 0, 0);
    const ini = inicioSemana(ref);
    const fim = fimSemana(ref);
    expect(ini.getDay()).toBe(1);
    expect(chaveDataLocal(ini)).toBe('2026-10-26');
    expect(chaveDataLocal(fim)).toBe('2026-11-01');
    expect(diasDaSemana(ref)).toHaveLength(7);
  });

  it('virada de ano na navegação de mês e semana', () => {
    const dez = new Date(2026, 11, 28);
    const jan = avancarPeriodo(dez, 'mes', 1);
    expect(jan.getFullYear()).toBe(2027);
    expect(jan.getMonth()).toBe(0);

    const semana = avancarPeriodo(new Date(2026, 11, 28), 'semana', 1);
    expect(semana.getFullYear()).toBe(2027);
  });

  it('grade do mês inclui bordas de outras semanas', () => {
    const grade = diasGradeMes(new Date(2026, 9, 15));
    expect(grade[0].getDay()).toBe(1);
    expect(grade[grade.length - 1].getDay()).toBe(0);
    expect(grade.length % 7).toBe(0);
    expect(inicioMes(new Date(2026, 9, 15)).getDate()).toBe(1);
    expect(fimMes(new Date(2026, 9, 15)).getDate()).toBe(31);
  });

  it('chave local não usa UTC e rótulos não inventam horário', () => {
    const d = new Date(2026, 9, 27, 22, 30);
    expect(chaveDataLocal(d)).toBe('2026-10-27');
    expect(chaveDataLocal(parseChaveDataLocal('2026-10-27'))).toBe('2026-10-27');
    expect(rotuloHorarioAgenda({ vencimento: d, diaInteiro: true })).toBe('Dia inteiro');
    expect(rotuloHorarioAgenda({ vencimento: d, periodoDia: 'MANHA' })).toBe('Manhã');
    expect(rotuloHorarioAgenda({ vencimento: d, periodoDia: 'TARDE' })).toBe('Tarde');
    expect(rotuloHorarioAgenda({ vencimento: d })).toMatch(/\d{2}:\d{2}/);
  });
});
