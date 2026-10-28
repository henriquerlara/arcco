-- ECOL-05: precisão de quatro casas internas. Só as colunas de custo.
-- Nulos permanecem nulos. estoqueAtual e precoVenda não são alterados.
ALTER TABLE "produtos"
  ALTER COLUMN "custoMedio" TYPE DECIMAL(18,4)
  USING CASE
    WHEN "custoMedio" IS NULL THEN NULL
    ELSE ROUND("custoMedio"::numeric, 4)
  END;

ALTER TABLE "produtos"
  ALTER COLUMN "ultimoPreco" TYPE DECIMAL(18,4)
  USING CASE
    WHEN "ultimoPreco" IS NULL THEN NULL
    ELSE ROUND("ultimoPreco"::numeric, 4)
  END;

ALTER TABLE "movimentacoes_estoque"
  ALTER COLUMN "precoUnitarioCusto" TYPE DECIMAL(18,4)
  USING CASE
    WHEN "precoUnitarioCusto" IS NULL THEN NULL
    ELSE ROUND("precoUnitarioCusto"::numeric, 4)
  END;
