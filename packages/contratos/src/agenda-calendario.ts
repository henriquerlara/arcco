/**
 * ECOL-22 — helpers de calendário (semana começa na segunda, datas locais).
 * Sem inventar horários: só interpreta `vencimento`, `diaInteiro` e `periodoDia`.
 */

export type PeriodoCalendario = 'lista' | 'semana' | 'mes';

/** Chave local YYYY-MM-DD (não UTC). */
export function chaveDataLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseChaveDataLocal(chave: string): Date {
  const partes = chave.split('-').map(Number);
  const y = partes[0] ?? 0;
  const m = partes[1] ?? 1;
  const d = partes[2] ?? 1;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Segunda-feira 00:00 local da semana que contém `ref`. */
export function inicioSemana(ref: Date): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dia = d.getDay(); // 0=dom
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function fimSemana(ref: Date): Date {
  const ini = inicioSemana(ref);
  const fim = new Date(ini);
  fim.setDate(ini.getDate() + 6);
  fim.setHours(23, 59, 59, 999);
  return fim;
}

export function inicioMes(ref: Date): Date {
  return new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
}

export function fimMes(ref: Date): Date {
  return new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Grade do mês: inclui dias da semana anterior/posterior para completar a grade. */
export function diasGradeMes(ref: Date): Date[] {
  const primeiro = inicioMes(ref);
  const inicio = inicioSemana(primeiro);
  const ultimo = fimMes(ref);
  const fimGrade = fimSemana(ultimo);
  const dias: Date[] = [];
  const cursor = new Date(inicio);
  while (cursor <= fimGrade) {
    dias.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

export function diasDaSemana(ref: Date): Date[] {
  const ini = inicioSemana(ref);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ini);
    d.setDate(ini.getDate() + i);
    return d;
  });
}

export function avancarPeriodo(ref: Date, modo: 'semana' | 'mes', delta: number): Date {
  const d = new Date(ref);
  if (modo === 'semana') d.setDate(d.getDate() + delta * 7);
  else d.setMonth(d.getMonth() + delta);
  return d;
}

/** Como exibir o horário no calendário — sem inventar clock. */
export function rotuloHorarioAgenda(ativ: {
  vencimento: Date | string;
  diaInteiro?: boolean | null;
  periodoDia?: string | null;
}): string {
  if (ativ.diaInteiro) return 'Dia inteiro';
  if (ativ.periodoDia === 'MANHA') return 'Manhã';
  if (ativ.periodoDia === 'TARDE') return 'Tarde';
  const v = typeof ativ.vencimento === 'string' ? new Date(ativ.vencimento) : ativ.vencimento;
  return v.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function ehDiaInteiroOuPeriodo(ativ: {
  diaInteiro?: boolean | null;
  periodoDia?: string | null;
}): boolean {
  return Boolean(ativ.diaInteiro || ativ.periodoDia === 'MANHA' || ativ.periodoDia === 'TARDE');
}
