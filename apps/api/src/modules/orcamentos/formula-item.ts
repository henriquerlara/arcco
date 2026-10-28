import { Prisma } from '@prisma/client';
import {
  BaseCustoItemOrcamento,
  TipoDescontoOrcamento,
  calcularDescontoOrcamento,
  calcularMargemEfetiva,
  calcularPrecoUnitarioLinha,
  calcularTotalLinha,
  validarPrecoDentroDoDescontoMaximo,
  type itemOrcamentoInputSchema,
} from '@arcco/contratos';
import type { z } from 'zod';

export type OpcoesMontagemEcolume = {
  descontoMaximoPercentual?: number | null;
  margemPadraoGlobal?: number | null;
  /** ECOL-26b: alterar preço dentro do limite ECOL-02 sem VER_CUSTOS. */
  podeAlterarPreco?: boolean;
};

export type ItemInput = z.infer<typeof itemOrcamentoInputSchema>;

export type ItemMontado = {
  produtoId: string | null;
  nome: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  desconto: number;
  totalLinha: number;
  ordem: number;
  codigoInterno: string | null;
  baseCusto: BaseCustoItemOrcamento | null;
  custoBase: Prisma.Decimal | null;
  ipiPercentual: Prisma.Decimal | null;
  stPercentual: Prisma.Decimal | null;
  margem: Prisma.Decimal | null;
  precoManual: boolean;
  margemEfetiva: Prisma.Decimal | null;
};

function n(valor: Prisma.Decimal | number | string | null | undefined): number | null {
  if (valor == null) return null;
  const x = Number(valor);
  return Number.isFinite(x) ? x : null;
}

function dec(valor: number | null | undefined): Prisma.Decimal | null {
  if (valor == null || !Number.isFinite(valor)) return null;
  return new Prisma.Decimal(valor);
}

type ProdutoLinha = {
  id: string;
  nome: string;
  unidade: string;
  precoVenda: number;
  codigoInterno: string | null;
  descricaoComercial: string | null;
  ipi: number | null;
  margem: number | null;
  custoMedio: Prisma.Decimal | number | null;
  ultimoPreco: Prisma.Decimal | number | null;
  fornecedor: { aliquotaSt: Prisma.Decimal | number | null } | null;
};

/** Monta linha ECOLUME: preserva descrição e snapshots; não altera o produto. */
export function montarItemEcolume(
  item: ItemInput,
  produto: ProdutoLinha | null,
  ordem: number,
  podeVerCustos: boolean,
  opcoes: OpcoesMontagemEcolume = {},
): { item: ItemMontado; erro?: { codigo: string; mensagem: string }; precoSugerido?: number | null } {
  const nome = item.nome;
  const unidade = item.unidade ?? produto?.unidade ?? 'un';
  const quantidade = item.quantidade;
  const desconto = item.desconto ?? 0;
  const descontoMax = opcoes.descontoMaximoPercentual ?? null;
  const margemPadrao = opcoes.margemPadraoGlobal ?? null;
  const podeAlterarPreco = opcoes.podeAlterarPreco === true;

  let baseCusto: BaseCustoItemOrcamento | null =
    (item.baseCusto as BaseCustoItemOrcamento | null | undefined) ?? null;
  let custoBase = item.custoBase ?? null;
  let ipiPercentual = item.ipiPercentual ?? null;
  let stPercentual = item.stPercentual ?? null;
  let margem = item.margem ?? null;
  let codigoInterno = item.codigoInterno ?? null;
  let precoManual = item.precoManual === true;

  if (produto) {
    codigoInterno = codigoInterno ?? produto.codigoInterno;
    if (ipiPercentual == null) ipiPercentual = produto.ipi ?? 0;
    if (stPercentual == null) {
      stPercentual = produto.fornecedor?.aliquotaSt != null ? Number(produto.fornecedor.aliquotaSt) : 0;
    }
    if (margem == null) margem = produto.margem ?? margemPadrao;

    if (baseCusto == null || custoBase == null) {
      const ultimo = n(produto.ultimoPreco);
      const medio = n(produto.custoMedio);
      if (baseCusto == null) {
        if (ultimo != null) baseCusto = BaseCustoItemOrcamento.ULTIMO_PRECO;
        else if (medio != null) baseCusto = BaseCustoItemOrcamento.CUSTO_MEDIO;
        else baseCusto = BaseCustoItemOrcamento.INFORMADO;
      }
      if (custoBase == null) {
        if (baseCusto === BaseCustoItemOrcamento.ULTIMO_PRECO) custoBase = ultimo;
        else if (baseCusto === BaseCustoItemOrcamento.CUSTO_MEDIO) custoBase = medio;
        else custoBase = null;
      }
    }
  }

  if (!podeVerCustos) {
    // Sem VER_CUSTOS: ignora overrides do cliente e usa snapshot do produto.
    if (produto) {
      const ultimo = n(produto.ultimoPreco);
      const medio = n(produto.custoMedio);
      baseCusto =
        ultimo != null
          ? BaseCustoItemOrcamento.ULTIMO_PRECO
          : medio != null
            ? BaseCustoItemOrcamento.CUSTO_MEDIO
            : BaseCustoItemOrcamento.INFORMADO;
      custoBase =
        baseCusto === BaseCustoItemOrcamento.ULTIMO_PRECO
          ? ultimo
          : baseCusto === BaseCustoItemOrcamento.CUSTO_MEDIO
            ? medio
            : null;
      ipiPercentual = produto.ipi ?? 0;
      stPercentual =
        produto.fornecedor?.aliquotaSt != null ? Number(produto.fornecedor.aliquotaSt) : 0;
      margem = produto.margem ?? margemPadrao;
    }
    precoManual = false;
  } else if (baseCusto === BaseCustoItemOrcamento.ULTIMO_PRECO && produto && item.custoBase == null) {
    custoBase = n(produto.ultimoPreco);
  } else if (baseCusto === BaseCustoItemOrcamento.CUSTO_MEDIO && produto && item.custoBase == null) {
    custoBase = n(produto.custoMedio);
  }

  if (margem == null && margemPadrao != null) margem = margemPadrao;

  const calculado = calcularPrecoUnitarioLinha({
    custoBase,
    ipiPercentual,
    stPercentual,
    margem,
  });

  let precoUnitario: number;
  if (precoManual && item.precoUnitario != null && podeVerCustos) {
    precoUnitario = item.precoUnitario;
  } else if (calculado != null) {
    precoUnitario = calculado;
    precoManual = false;
  } else if (item.precoUnitario != null) {
    if (!podeVerCustos) {
      return {
        item: null as unknown as ItemMontado,
        erro: {
          codigo: 'PRECO_ALTERACAO_INDISPONIVEL',
          mensagem:
            'Sem preco sugerido e sem VER_CUSTOS, o preco manual nao pode ser informado (item avulso)',
        },
      };
    }
    precoUnitario = item.precoUnitario;
    precoManual = true;
  } else if (produto) {
    precoUnitario = produto.precoVenda;
  } else {
    return {
      item: null as unknown as ItemMontado,
      erro: {
        codigo: 'PRECO_OBRIGATORIO',
        mensagem: 'Informe o preco unitario ou vincule um produto com custo e margem',
      },
    };
  }

  // Sem VER_CUSTOS: ALTERAR_PRECO + desconto máximo ECOL-02.
  if (!podeVerCustos && item.precoUnitario != null && calculado != null) {
    const diverge = Math.abs(item.precoUnitario - calculado) > 0.009;
    if (diverge && !podeAlterarPreco) {
      return {
        item: null as unknown as ItemMontado,
        erro: {
          codigo: 'PRECO_ALTERACAO_INDISPONIVEL',
          mensagem: 'Sem VER_CUSTOS nem ALTERAR_PRECO, o preco sugerido nao pode ser alterado',
        },
      };
    }
    if (diverge) {
      const check = validarPrecoDentroDoDescontoMaximo({
        precoSugerido: calculado,
        precoPraticado: item.precoUnitario,
        descontoMaximoPercentual: descontoMax,
      });
      if (!check.ok) {
        return { item: null as unknown as ItemMontado, erro: { codigo: check.codigo, mensagem: check.mensagem } };
      }
      precoUnitario = item.precoUnitario;
      precoManual = true;
    }
  }

  // Desconto em valor na linha: equivalente a reduzir preço efetivo.
  if (!podeVerCustos && desconto > 0 && calculado != null) {
    if (!podeAlterarPreco) {
      return {
        item: null as unknown as ItemMontado,
        erro: {
          codigo: 'DESCONTO_ALTERACAO_INDISPONIVEL',
          mensagem: 'Sem VER_CUSTOS nem ALTERAR_PRECO, o desconto de linha nao e permitido',
        },
      };
    }
    const totalCheio = quantidade * calculado;
    const totalApos = Math.max(0, totalCheio - desconto);
    const precoEfetivo = quantidade > 0 ? totalApos / quantidade : calculado;
    const checkLinha = validarPrecoDentroDoDescontoMaximo({
      precoSugerido: calculado,
      precoPraticado: precoEfetivo,
      descontoMaximoPercentual: descontoMax,
    });
    if (!checkLinha.ok) {
      return {
        item: null as unknown as ItemMontado,
        erro: { codigo: checkLinha.codigo, mensagem: checkLinha.mensagem },
      };
    }
  } else if (!podeVerCustos && desconto > 0 && calculado == null) {
    return {
      item: null as unknown as ItemMontado,
      erro: {
        codigo: 'DESCONTO_ALTERACAO_INDISPONIVEL',
        mensagem: 'Sem VER_CUSTOS, desconto em item sem preco sugerido nao e permitido',
      },
    };
  }

  const margemEfetivaNum = precoManual
    ? calcularMargemEfetiva({
        precoUnitario,
        custoBase,
        ipiPercentual,
        stPercentual,
      })
    : margem;

  const totalLinha = calcularTotalLinha(quantidade, precoUnitario, desconto);

  return {
    item: {
      produtoId: item.produtoId ?? null,
      nome,
      unidade,
      quantidade,
      precoUnitario,
      desconto,
      totalLinha,
      ordem,
      codigoInterno,
      baseCusto,
      custoBase: dec(custoBase),
      ipiPercentual: dec(ipiPercentual),
      stPercentual: dec(stPercentual),
      margem: dec(margem),
      precoManual,
      margemEfetiva: dec(margemEfetivaNum),
    },
    precoSugerido: calculado,
  };
}

export function montarItemLegado(
  item: ItemInput,
  produto: { nome: string; unidade: string; precoVenda: number } | null,
  ordem: number,
): ItemMontado {
  let nome = item.nome;
  let unidade = item.unidade ?? 'un';
  let precoUnitario = item.precoUnitario ?? 0;
  if (produto) {
    nome = produto.nome;
    unidade = produto.unidade;
    if (item.precoUnitario === undefined || item.precoUnitario === null) {
      precoUnitario = produto.precoVenda;
    }
  }
  const desconto = item.desconto ?? 0;
  const totalLinha = Math.max(0, item.quantidade * precoUnitario - desconto);
  return {
    produtoId: item.produtoId ?? null,
    nome,
    unidade,
    quantidade: item.quantidade,
    precoUnitario,
    desconto,
    totalLinha,
    ordem,
    codigoInterno: null,
    baseCusto: null,
    custoBase: null,
    ipiPercentual: null,
    stPercentual: null,
    margem: null,
    precoManual: false,
    margemEfetiva: null,
  };
}

export function totaisOrcamento(entrada: {
  itens: Array<{ totalLinha: number }>;
  descontoTipo?: TipoDescontoOrcamento | string | null;
  descontoValor?: number | null;
  descontoPercentual?: number | null;
}) {
  const subtotal = arred2(
    entrada.itens.reduce((acc, i) => acc + i.totalLinha, 0),
  );
  const tipo =
    entrada.descontoTipo === TipoDescontoOrcamento.PERCENTUAL
      ? TipoDescontoOrcamento.PERCENTUAL
      : TipoDescontoOrcamento.VALOR;
  const desc = calcularDescontoOrcamento({
    subtotal,
    tipo,
    descontoValor: entrada.descontoValor,
    descontoPercentual: entrada.descontoPercentual,
  });
  const total = arred2(Math.max(0, subtotal - desc.descontoValor));
  return {
    subtotal,
    descontoValor: desc.descontoValor,
    descontoPercentual: desc.descontoPercentual,
    descontoTipo: tipo,
    total,
  };
}

function arred2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function serializarItemOrcamento<T extends Record<string, unknown>>(item: T): T {
  const saida = { ...item } as Record<string, unknown>;
  for (const chave of [
    'custoBase',
    'ipiPercentual',
    'stPercentual',
    'margem',
    'margemEfetiva',
  ]) {
    if (saida[chave] != null && typeof saida[chave] === 'object') {
      saida[chave] = Number(saida[chave] as Prisma.Decimal);
    }
  }
  return saida as T;
}
