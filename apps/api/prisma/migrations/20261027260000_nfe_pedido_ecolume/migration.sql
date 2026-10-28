-- ECOL-24: NF-e vinculada ao pedido + itens com snapshot e quantidade faturada.
ALTER TABLE "notas_fiscais" ADD COLUMN IF NOT EXISTS "pedidoId" TEXT;

CREATE TABLE IF NOT EXISTS "itens_nota_fiscal" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "notaFiscalId" TEXT NOT NULL,
  "itemPedidoId" TEXT,
  "produtoId" TEXT,
  "codigoInterno" TEXT,
  "descricao" TEXT NOT NULL,
  "ncm" TEXT,
  "cest" TEXT,
  "origemFiscal" TEXT,
  "unidade" TEXT NOT NULL DEFAULT 'UN',
  "quantidade" DECIMAL(18,4) NOT NULL,
  "precoUnitario" DECIMAL(18,4) NOT NULL,
  "valorTotal" DECIMAL(18,4) NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "itens_nota_fiscal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notas_fiscais_pedidoId_idx" ON "notas_fiscais"("pedidoId");
CREATE INDEX IF NOT EXISTS "itens_nota_fiscal_notaFiscalId_idx" ON "itens_nota_fiscal"("notaFiscalId");
CREATE INDEX IF NOT EXISTS "itens_nota_fiscal_itemPedidoId_idx" ON "itens_nota_fiscal"("itemPedidoId");
CREATE INDEX IF NOT EXISTS "itens_nota_fiscal_empresaId_idx" ON "itens_nota_fiscal"("empresaId");

DO $$ BEGIN
  ALTER TABLE "notas_fiscais"
    ADD CONSTRAINT "notas_fiscais_pedidoId_fkey"
    FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "itens_nota_fiscal"
    ADD CONSTRAINT "itens_nota_fiscal_notaFiscalId_fkey"
    FOREIGN KEY ("notaFiscalId") REFERENCES "notas_fiscais"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "itens_nota_fiscal"
    ADD CONSTRAINT "itens_nota_fiscal_itemPedidoId_fkey"
    FOREIGN KEY ("itemPedidoId") REFERENCES "itens_pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
