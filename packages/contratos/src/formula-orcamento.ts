/**
 * Fórmula da seção 10.4 (ECOL-13).
 * Cálculo em precisão decimal via string/inteiros; arredonda o preço unitário
 * a 2 casas só após a multiplicação completa.
 *
 * Nota: custo médio interno tem 4 casas (ECOL-05). O exemplo oficial “113,33”
 * usa base já arredondada a 2 casas → R$ 259,30. Com 113,3333 (4 casas)
 * o resultado arredondado a 2 casas pode diferir em R$ 0,01.
 */

export const BaseCustoItemOrcamento = {
  ULTIMO_PRECO: 'ULTIMO_PRECO',
  CUSTO_MEDIO: 'CUSTO_MEDIO',
  INFORMADO: 'INFORMADO',
} as const;
export type BaseCustoItemOrcamento =
  (typeof BaseCustoItemOrcamento)[keyof typeof BaseCustoItemOrcamento];

export const TipoDescontoOrcamento = {
  VALOR: 'VALOR',
  PERCENTUAL: 'PERCENTUAL',
} as const;
export type TipoDescontoOrcamento =
  (typeof TipoDescontoOrcamento)[keyof typeof TipoDescontoOrcamento];

/** Converte para inteiro em escala (ex.: 4 casas → ×10000) sem float intermediário. */
function paraEscala(valor: number | string, casas: number): bigint {
  const s = String(valor).trim().replace(',', '.');
  const neg = s.startsWith('-');
  const limpo = neg ? s.slice(1) : s;
  const [intPart, fracPart = ''] = limpo.split('.');
  const frac = (fracPart + '0'.repeat(casas)).slice(0, casas);
  const raw = BigInt(intPart || '0') * 10n ** BigInt(casas) + BigInt(frac || '0');
  return neg ? -raw : raw;
}

function deEscala(escala: bigint, casas: number): number {
  const neg = escala < 0n;
  const v = neg ? -escala : escala;
  const div = 10n ** BigInt(casas);
  const inteiro = v / div;
  const resto = v % div;
  const frac = resto.toString().padStart(casas, '0');
  const texto = `${neg ? '-' : ''}${inteiro}.${frac}`;
  return Number(texto);
}

/** Arredonda half-up para `casas` casas decimais. */
export function arredondarDecimal(valor: number | string, casas: number): number {
  const escalaOrig = Math.max(casas + 4, 8);
  const n = paraEscala(valor, escalaOrig);
  const fator = 10n ** BigInt(escalaOrig - casas);
  const meio = fator / 2n;
  const ajustado = n >= 0n ? n + meio : n - meio;
  const trunc = ajustado / fator;
  return deEscala(trunc, casas);
}

/**
 * precoUnitario = custoBase × (1 + IPI/100) × (1 + ST/100) × margem
 * Arredonda a 2 casas no final.
 * IPI/ST nulos contam como 0. Margem ou custo ausentes → null (não inventa).
 */
export function calcularPrecoUnitarioLinha(entrada: {
  custoBase: number | null | undefined;
  ipiPercentual?: number | null;
  stPercentual?: number | null;
  margem?: number | null;
}): number | null {
  if (entrada.custoBase == null || !Number.isFinite(Number(entrada.custoBase))) return null;
  if (entrada.margem == null || !Number.isFinite(Number(entrada.margem)) || Number(entrada.margem) <= 0) {
    return null;
  }
  const ipi = entrada.ipiPercentual != null && Number.isFinite(Number(entrada.ipiPercentual))
    ? Number(entrada.ipiPercentual)
    : 0;
  const st =
    entrada.stPercentual != null && Number.isFinite(Number(entrada.stPercentual))
      ? Number(entrada.stPercentual)
      : 0;

  // Escala interna 8 casas para o produto dos fatores.
  const custo = paraEscala(entrada.custoBase, 8);
  const fIpi = paraEscala(1 + ipi / 100, 8);
  const fSt = paraEscala(1 + st / 100, 8);
  const fMargem = paraEscala(entrada.margem, 8);
  // custo×ipi×st×margem / 10^(8*3) porque cada fator já traz ×10^8
  const prod = custo * fIpi * fSt * fMargem;
  const denom = 10n ** 24n; // 8*3
  const meio = denom / 2n;
  const arred8 = (prod + (prod >= 0n ? meio : -meio)) / denom;
  return arredondarDecimal(deEscala(arred8, 8), 2);
}

/**
 * margemEfetiva = precoManual / (custoBase × (1+IPI/100) × (1+ST/100))
 * Retorna null se denominador ≤ 0 ou dados ausentes.
 */
export function calcularMargemEfetiva(entrada: {
  precoUnitario: number;
  custoBase: number | null | undefined;
  ipiPercentual?: number | null;
  stPercentual?: number | null;
}): number | null {
  if (entrada.custoBase == null || !Number.isFinite(Number(entrada.custoBase))) return null;
  if (Number(entrada.custoBase) <= 0) return null;
  const ipi = entrada.ipiPercentual != null && Number.isFinite(Number(entrada.ipiPercentual))
    ? Number(entrada.ipiPercentual)
    : 0;
  const st =
    entrada.stPercentual != null && Number.isFinite(Number(entrada.stPercentual))
      ? Number(entrada.stPercentual)
      : 0;
  const custo = paraEscala(entrada.custoBase, 8);
  const fIpi = paraEscala(1 + ipi / 100, 8);
  const fSt = paraEscala(1 + st / 100, 8);
  const denom = custo * fIpi * fSt; // escala 24
  if (denom <= 0n) return null;
  const preco = paraEscala(entrada.precoUnitario, 8);
  // margem = preco / (custo×ipi×st) = preco×10^16 / denom_em_escala_24... 
  // denom tem escala 24; preco escala 8 → quociente escala 8-24 = -16 → multiplicar por 10^16 para escala 0, depois 4 casas
  const numer = preco * 10n ** 20n; // para 4 casas no resultado: +4
  const margemEscala4 = (numer + denom / 2n) / denom;
  return deEscala(margemEscala4, 4);
}

export function calcularTotalLinha(quantidade: number, precoUnitario: number, descontoLinha = 0): number {
  const q = paraEscala(quantidade, 4);
  const p = paraEscala(precoUnitario, 2);
  // q*p / 10^4 → escala 2; depois subtrai desconto
  const brutoE2 = (q * p) / 10n ** 4n;
  const desc = paraEscala(descontoLinha, 2);
  const liquido = brutoE2 - desc;
  return arredondarDecimal(deEscala(liquido < 0n ? 0n : liquido, 2), 2);
}

export function calcularDescontoOrcamento(entrada: {
  subtotal: number;
  tipo: TipoDescontoOrcamento;
  descontoValor?: number | null;
  descontoPercentual?: number | null;
}): { descontoValor: number; descontoPercentual: number | null } {
  if (entrada.tipo === TipoDescontoOrcamento.PERCENTUAL) {
    const pct = entrada.descontoPercentual ?? 0;
    if (pct < 0) {
      return { descontoValor: 0, descontoPercentual: 0 };
    }
    const valor = arredondarDecimal((entrada.subtotal * pct) / 100, 2);
    return {
      descontoValor: Math.min(valor, arredondarDecimal(entrada.subtotal, 2)),
      descontoPercentual: pct,
    };
  }
  const valor = Math.max(0, entrada.descontoValor ?? 0);
  return {
    descontoValor: Math.min(arredondarDecimal(valor, 2), arredondarDecimal(entrada.subtotal, 2)),
    descontoPercentual: null,
  };
}
