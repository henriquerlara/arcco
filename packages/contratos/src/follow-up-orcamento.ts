/**
 * ECOL-21 — prazo padrão §16.4 para orçamento ENVIADO sem movimentação.
 * Editável via `configuracoes.diasOrcamentoSemMovimentacao` (ECOL-02).
 */
export const DIAS_ORCAMENTO_SEM_MOVIMENTACAO_PADRAO = 7;

/** Chave em Empresa.configuracoes (plataforma). */
export const CONFIG_DIAS_ORCAMENTO_SEM_MOVIMENTACAO = 'diasOrcamentoSemMovimentacao';

/** Prefixo do título do follow-up automático Ecolume (deduplicação). */
export const TITULO_FOLLOW_UP_ORC_PREFIX = 'Follow-up ORC';

/**
 * "Sem movimentação" (§13.3): referência = `orcamento.enviadoEm`,
 * com fallback para `atualizadoEm` se `enviadoEm` estiver nulo em legado.
 * Mudança de status para fora de ENVIADO remove elegibilidade.
 * Eventos do negócio não reiniciam o relógio do orçamento.
 */
export function referenciaSemMovimentacaoOrc(orc: {
  enviadoEm?: Date | string | null;
  atualizadoEm?: Date | string | null;
}): Date | null {
  const raw = orc.enviadoEm ?? orc.atualizadoEm ?? null;
  if (!raw) return null;
  return typeof raw === 'string' ? new Date(raw) : raw;
}

export function lerDiasOrcamentoSemMovimentacao(
  configuracoes: unknown,
  padrao = DIAS_ORCAMENTO_SEM_MOVIMENTACAO_PADRAO,
): number {
  const raw = (configuracoes ?? {}) as Record<string, unknown>;
  const n = Number(raw[CONFIG_DIAS_ORCAMENTO_SEM_MOVIMENTACAO]);
  if (Number.isFinite(n) && n >= 1 && n <= 90) return Math.trunc(n);
  return padrao;
}

export function tituloFollowUpOrc(codigoNegocio: string, numeroOrc?: string | null): string {
  return numeroOrc
    ? `${TITULO_FOLLOW_UP_ORC_PREFIX} ${codigoNegocio} · ${numeroOrc}`
    : `${TITULO_FOLLOW_UP_ORC_PREFIX} ${codigoNegocio}`;
}

export function ehTituloFollowUpOrcAuto(titulo: string): boolean {
  return titulo.startsWith(TITULO_FOLLOW_UP_ORC_PREFIX);
}
