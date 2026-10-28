import { Prisma } from '@prisma/client';

/**
 * Seção 7.7: custo médio interno com 4 casas; exibição com 2.
 * Persistência em DECIMAL(18,4). Cálculo e arredondamento com Prisma.Decimal.
 */
const CASAS_INTERNAS = 4;
const CASAS_EXIBICAO = 2;

export type EntradaCusto = {
  saldoAnterior: number;
  custoMedioAnterior: number | null;
  quantidadeEntrada: number;
  precoUnitario: number;
  /** Obrigatório quando saldo > 0 e média nula (decisão ECOL-05 opção 3). */
  custoReferenciaSaldo?: number | null;
};

export type ResultadoCustoEntrada = {
  custoMedio: number;
  ultimoPreco: number;
};

/** Arredonda para persistência (4 casas). */
export function custoInterno(valor: Prisma.Decimal | number | string): number {
  return Number(new Prisma.Decimal(valor).toDecimalPlaces(CASAS_INTERNAS));
}

/** Apresentação (2 casas). Não altera o valor gravado. */
export function apresentarCusto(valor: number): number {
  return Number(new Prisma.Decimal(valor).toDecimalPlaces(CASAS_EXIBICAO));
}

/** Saldo positivo sem média conhecida exige custo de referência explícito. */
export function precisaCustoReferenciaSaldo(
  saldoAnterior: number,
  custoMedioAnterior: number | null,
): boolean {
  return new Prisma.Decimal(saldoAnterior).gt(0) && custoMedioAnterior == null;
}

/**
 * Regra da seção 7.7 + decisão opção 3:
 * - saldoAnterior <= 0: média = preço da entrada
 * - média conhecida: média ponderada com essa média
 * - saldo > 0 e média nula: pondera com custoReferenciaSaldo (já validado pelo chamador)
 * Último preço acompanha o preço unitário da entrada.
 */
export function calcularCustoAposEntrada(entrada: EntradaCusto): ResultadoCustoEntrada {
  const preco = new Prisma.Decimal(entrada.precoUnitario);
  const ultimoPreco = custoInterno(preco);
  const saldo = new Prisma.Decimal(entrada.saldoAnterior);
  const quantidade = new Prisma.Decimal(entrada.quantidadeEntrada);

  if (saldo.lte(0)) {
    return { custoMedio: ultimoPreco, ultimoPreco };
  }

  const baseSaldo =
    entrada.custoMedioAnterior != null
      ? new Prisma.Decimal(entrada.custoMedioAnterior)
      : new Prisma.Decimal(entrada.custoReferenciaSaldo!);

  const novo = saldo.mul(baseSaldo).plus(quantidade.mul(preco)).div(saldo.plus(quantidade));
  return { custoMedio: custoInterno(novo), ultimoPreco };
}
