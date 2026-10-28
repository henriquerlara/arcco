/**
 * ECOL-23 — períodos da Visão geral e decisões de métrica documentadas.
 *
 * Cancelados: faturamento, contagem de vendas e ticket usam o mesmo conjunto
 * (pedidos do período com status ≠ CANCELADO). Assim ticket = faturamento / vendas
 * permanece coerente quando o PDF não detalha cancelados na contagem (§15.3).
 *
 * Conversão: negócios *criados* no período com ≥1 pedido não cancelado /
 * negócios criados no período (não por ORC/revisões).
 */

export const DIAS_ALERTA_DASHBOARD_PADRAO = 7;
export const CONFIG_DIAS_CHECKLIST_PENDENTE = 'diasChecklistPendente';

export type ChavePeriodoDashboard =
  | 'mes'
  | 'mes_anterior'
  | '30d'
  | 'ano'
  | 'personalizado';

export function inicioDoDiaLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function fimDoDiaLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Resolve janela atual e a janela anterior equivalente para comparação %. */
export function resolverPeriodoDashboard(entrada: {
  chave?: string | null;
  de?: Date | string | null;
  ate?: Date | string | null;
  agora?: Date;
}): {
  chave: ChavePeriodoDashboard;
  de: Date;
  ate: Date;
  deAnterior: Date;
  ateAnterior: Date;
} {
  const agora = entrada.agora ?? new Date();
  const chave = (entrada.chave as ChavePeriodoDashboard) || 'mes';

  let de: Date;
  let ate: Date;

  if (chave === 'personalizado' && entrada.de && entrada.ate) {
    de = inicioDoDiaLocal(new Date(entrada.de));
    ate = fimDoDiaLocal(new Date(entrada.ate));
  } else if (chave === 'mes_anterior') {
    de = new Date(agora.getFullYear(), agora.getMonth() - 1, 1, 0, 0, 0, 0);
    ate = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999);
  } else if (chave === '30d') {
    ate = fimDoDiaLocal(agora);
    de = inicioDoDiaLocal(new Date(ate.getTime() - 29 * 86_400_000));
  } else if (chave === 'ano') {
    de = new Date(agora.getFullYear(), 0, 1, 0, 0, 0, 0);
    ate = fimDoDiaLocal(agora);
  } else {
    // mes (padrão)
    de = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
    ate = fimDoDiaLocal(agora);
  }

  const duracao = ate.getTime() - de.getTime();
  const ateAnterior = new Date(de.getTime() - 1);
  const deAnterior = new Date(ateAnterior.getTime() - duracao);

  return { chave, de, ate, deAnterior, ateAnterior };
}

export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior === 0) return atual === 0 ? 0 : null;
  return ((atual - anterior) / anterior) * 100;
}

export function ticketMedio(faturamento: number, vendas: number): number {
  if (vendas <= 0) return 0;
  return faturamento / vendas;
}

export function lerDiasChecklistPendente(
  configuracoes: unknown,
  padrao = DIAS_ALERTA_DASHBOARD_PADRAO,
): number {
  const raw = (configuracoes ?? {}) as Record<string, unknown>;
  const n = Number(raw[CONFIG_DIAS_CHECKLIST_PENDENTE]);
  if (Number.isFinite(n) && n >= 1 && n <= 90) return Math.trunc(n);
  return padrao;
}

export function decimalParaNumero(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  if (typeof v === 'object' && v !== null && 'toNumber' in v) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v) || 0;
}
