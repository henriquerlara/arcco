/** Status da seção 7.11 (ECOLUME). Precedência: sob encomenda → a comprar → baixo → ok. */
export const StatusEstoqueEcolume = {
  SOB_ENCOMENDA: 'SOB_ENCOMENDA',
  A_COMPRAR: 'A_COMPRAR',
  BAIXO: 'BAIXO',
  OK: 'OK',
} as const;

export type StatusEstoqueEcolume =
  (typeof StatusEstoqueEcolume)[keyof typeof StatusEstoqueEcolume];

export const STATUS_ESTOQUE_ECOLUME_ROTULOS: Record<StatusEstoqueEcolume, string> = {
  SOB_ENCOMENDA: 'Sob encomenda',
  A_COMPRAR: 'A comprar',
  BAIXO: 'Baixo',
  OK: 'OK',
};

export function statusEstoqueEcolume(produto: {
  controlaEstoque: boolean;
  estoqueAtual: number;
  estoqueMinimo: number;
}): StatusEstoqueEcolume {
  if (!produto.controlaEstoque) return StatusEstoqueEcolume.SOB_ENCOMENDA;
  if (produto.estoqueAtual < 0) return StatusEstoqueEcolume.A_COMPRAR;
  if (produto.estoqueAtual <= produto.estoqueMinimo) return StatusEstoqueEcolume.BAIXO;
  return StatusEstoqueEcolume.OK;
}

/**
 * Preço sugerido (exibição): último preço × (1+IPI%) × (1+ST%) × margem.
 * Não inventa último preço nem margem. IPI/ST ausentes contam como zero.
 * Arredonda a 2 casas. Não persiste.
 */
export function calcularPrecoSugerido(entrada: {
  ultimoPreco: number | null | undefined;
  ipiPercentual?: number | null;
  aliquotaStPercentual?: number | null;
  margem?: number | null;
}): number | null {
  if (entrada.ultimoPreco == null || !Number.isFinite(entrada.ultimoPreco)) return null;
  if (entrada.margem == null || !Number.isFinite(entrada.margem) || entrada.margem <= 0) {
    return null;
  }
  const ipi = entrada.ipiPercentual != null && Number.isFinite(entrada.ipiPercentual)
    ? entrada.ipiPercentual
    : 0;
  const st =
    entrada.aliquotaStPercentual != null && Number.isFinite(entrada.aliquotaStPercentual)
      ? entrada.aliquotaStPercentual
      : 0;
  const bruto =
    entrada.ultimoPreco * (1 + ipi / 100) * (1 + st / 100) * entrada.margem;
  return Math.round(bruto * 100) / 100;
}
