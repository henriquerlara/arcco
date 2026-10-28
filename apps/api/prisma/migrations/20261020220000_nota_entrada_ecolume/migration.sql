-- ECOL-07: NF-e de compra. Produtos e fornecedores existentes permanecem intactos.
CREATE TABLE "notas_entrada" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "chaveAcesso" TEXT NOT NULL,
    "numero" TEXT,
    "serie" TEXT,
    "emitidoEm" TIMESTAMP(3),
    "valorTotal" DECIMAL(18,4) NOT NULL,
    "arquivoXmlId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFERIDA',
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notas_entrada_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notas_entrada_empresaId_chaveAcesso_key" ON "notas_entrada"("empresaId", "chaveAcesso");
CREATE INDEX "notas_entrada_empresaId_criadoEm_idx" ON "notas_entrada"("empresaId", "criadoEm");
CREATE INDEX "notas_entrada_fornecedorId_idx" ON "notas_entrada"("fornecedorId");

ALTER TABLE "notas_entrada" ADD CONSTRAINT "notas_entrada_fornecedorId_fkey"
  FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "itens_nota_entrada" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "notaEntradaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "numeroItem" INTEGER NOT NULL,
    "codigoFornecedor" TEXT,
    "descricao" TEXT,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "unidade" TEXT NOT NULL DEFAULT 'UN',
    "valorUnitario" DECIMAL(18,4) NOT NULL,
    "valorTotal" DECIMAL(18,4) NOT NULL,
    "ipi" DOUBLE PRECISION,
    "ncm" TEXT,
    "cest" TEXT,
    "origemFiscal" TEXT,
    "controlaEstoque" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "itens_nota_entrada_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "itens_nota_entrada_notaEntradaId_idx" ON "itens_nota_entrada"("notaEntradaId");
CREATE INDEX "itens_nota_entrada_empresaId_produtoId_idx" ON "itens_nota_entrada"("empresaId", "produtoId");

ALTER TABLE "itens_nota_entrada" ADD CONSTRAINT "itens_nota_entrada_notaEntradaId_fkey"
  FOREIGN KEY ("notaEntradaId") REFERENCES "notas_entrada"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itens_nota_entrada" ADD CONSTRAINT "itens_nota_entrada_produtoId_fkey"
  FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
