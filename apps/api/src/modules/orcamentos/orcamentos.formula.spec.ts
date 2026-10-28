import { describe, expect, it } from 'vitest';
import {
  BaseCustoItemOrcamento,
  calcularPrecoUnitarioLinha,
  PermissaoComercial,
  TipoDescontoOrcamento,
} from '@arcco/contratos';
import { montarItemEcolume, totaisOrcamento } from './formula-item';

describe('ECOL-13 montagem de linha', () => {
  const produto = {
    id: 'p1',
    nome: 'Nome fiscal Stella',
    unidade: 'un',
    precoVenda: 0,
    codigoInterno: 'CI-000001',
    descricaoComercial: 'Stella comercial',
    ipi: 10,
    margem: 1.6,
    custoMedio: 113.3333,
    ultimoPreco: 120,
    fornecedor: { aliquotaSt: 30 },
  };

  it('usa último preço por padrão e não sobrescreve descrição', () => {
    const r = montarItemEcolume(
      {
        produtoId: 'p1',
        nome: 'Descrição editada na linha',
        quantidade: 1,
        unidade: 'un',
      },
      produto,
      0,
      true,
    );
    expect(r.erro).toBeUndefined();
    expect(r.item.nome).toBe('Descrição editada na linha');
    expect(r.item.baseCusto).toBe(BaseCustoItemOrcamento.ULTIMO_PRECO);
    expect(Number(r.item.custoBase)).toBe(120);
    expect(r.item.precoUnitario).toBe(274.56);
    expect(r.item.precoManual).toBe(false);
  });

  it('seleciona custo médio e calcula 259,30 com base 113,33', () => {
    const r = montarItemEcolume(
      {
        produtoId: 'p1',
        nome: 'Stella',
        quantidade: 1,
        baseCusto: BaseCustoItemOrcamento.CUSTO_MEDIO,
        custoBase: 113.33,
        ipiPercentual: 10,
        stPercentual: 30,
        margem: 1.6,
      },
      produto,
      0,
      true,
    );
    expect(r.item.precoUnitario).toBe(259.3);
    expect(r.item.totalLinha).toBe(259.3);
  });

  it('preço manual grava margem efetiva sem alterar inputs de custo', () => {
    const r = montarItemEcolume(
      {
        produtoId: 'p1',
        nome: 'Stella',
        quantidade: 2,
        custoBase: 120,
        ipiPercentual: 10,
        stPercentual: 30,
        margem: 1.6,
        precoManual: true,
        precoUnitario: 300,
      },
      produto,
      0,
      true,
    );
    expect(r.item.precoManual).toBe(true);
    expect(r.item.precoUnitario).toBe(300);
    expect(Number(r.item.margemEfetiva)).toBeCloseTo(1.746, 2);
    expect(Number(r.item.margem)).toBe(1.6);
    expect(r.item.totalLinha).toBe(600);
  });

  it('sem VER_CUSTOS bloqueia preço divergente do calculado', () => {
    const r = montarItemEcolume(
      {
        produtoId: 'p1',
        nome: 'Stella',
        quantidade: 1,
        precoUnitario: 1,
      },
      produto,
      0,
      false,
    );
    expect(r.erro?.codigo).toBe('PRECO_ALTERACAO_INDISPONIVEL');
  });

  it('ECOL-02+26b: ALTERAR_PRECO aceita desconto no limite e rejeita acima', () => {
    const sugerido = 274.56;
    const noLimite = montarItemEcolume(
      {
        produtoId: 'p1',
        nome: 'Stella',
        quantidade: 1,
        precoUnitario: Number((sugerido * 0.9).toFixed(2)),
      },
      produto,
      0,
      false,
      { descontoMaximoPercentual: 10, podeAlterarPreco: true },
    );
    expect(noLimite.erro).toBeUndefined();
    expect(noLimite.item.precoManual).toBe(true);

    const acima = montarItemEcolume(
      {
        produtoId: 'p1',
        nome: 'Stella',
        quantidade: 1,
        precoUnitario: Number((sugerido * 0.85).toFixed(2)),
      },
      produto,
      0,
      false,
      { descontoMaximoPercentual: 10, podeAlterarPreco: true },
    );
    expect(acima.erro?.codigo).toBe('DESCONTO_ACIMA_DO_LIMITE');

    const semChave = montarItemEcolume(
      {
        produtoId: 'p1',
        nome: 'Stella',
        quantidade: 1,
        precoUnitario: Number((sugerido * 0.95).toFixed(2)),
      },
      produto,
      0,
      false,
      { descontoMaximoPercentual: 10, podeAlterarPreco: false },
    );
    expect(semChave.erro?.codigo).toBe('PRECO_ALTERACAO_INDISPONIVEL');
  });

  it('ECOL-02: margem padrão global quando produto sem margem', () => {
    const prodSemMargem = { ...produto, margem: null as number | null };
    const r = montarItemEcolume(
      {
        produtoId: 'p1',
        nome: 'Stella',
        quantidade: 1,
        custoBase: 120,
        ipiPercentual: 10,
        stPercentual: 30,
      },
      prodSemMargem,
      0,
      true,
      { margemPadraoGlobal: 1.6 },
    );
    expect(r.erro).toBeUndefined();
    expect(r.item.precoUnitario).toBe(274.56);
  });

  it('desconto percentual não aplica em dobro', () => {
    const t = totaisOrcamento({
      itens: [{ totalLinha: 1000 }],
      descontoTipo: TipoDescontoOrcamento.PERCENTUAL,
      descontoPercentual: 10,
      descontoValor: 999,
    });
    expect(t.subtotal).toBe(1000);
    expect(t.descontoValor).toBe(100);
    expect(t.total).toBe(900);
  });
});

describe('ECOL-13 fórmula pura', () => {
  it('bate os exemplos oficiais', () => {
    expect(
      calcularPrecoUnitarioLinha({
        custoBase: 120,
        ipiPercentual: 10,
        stPercentual: 30,
        margem: 1.6,
      }),
    ).toBe(274.56);
    expect(
      calcularPrecoUnitarioLinha({
        custoBase: 113.33,
        ipiPercentual: 10,
        stPercentual: 30,
        margem: 1.6,
      }),
    ).toBe(259.3);
  });
});
