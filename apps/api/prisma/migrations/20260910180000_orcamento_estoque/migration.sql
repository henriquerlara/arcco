-- AlterTable
ALTER TABLE "empresas" ADD COLUMN "logoArquivoId" TEXT;

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "sku" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "unidade" TEXT NOT NULL DEFAULT 'un',
    "precoVenda" REAL NOT NULL DEFAULT 0,
    "estoqueAtual" REAL NOT NULL DEFAULT 0,
    "estoqueMinimo" REAL NOT NULL DEFAULT 0,
    "controlaEstoque" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "produtos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "orcamentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "oportunidadeId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "vigente" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "descontoValor" REAL NOT NULL DEFAULT 0,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "validadeEm" DATETIME,
    "arquivoId" TEXT,
    "enviadoEm" DATETIME,
    "aceitoEm" DATETIME,
    "convertidoEm" DATETIME,
    "criadoPorId" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "orcamentos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "orcamentos_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "itens_orcamento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orcamentoId" TEXT NOT NULL,
    "produtoId" TEXT,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL DEFAULT 'un',
    "quantidade" REAL NOT NULL,
    "precoUnitario" REAL NOT NULL,
    "desconto" REAL NOT NULL DEFAULT 0,
    "totalLinha" REAL NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "itens_orcamento_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "orcamentos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "itens_orcamento_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "movimentacoes_estoque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" REAL NOT NULL,
    "saldoApos" REAL NOT NULL,
    "orcamentoId" TEXT,
    "oportunidadeId" TEXT,
    "observacao" TEXT,
    "usuarioId" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "movimentacoes_estoque_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "movimentacoes_estoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "produtos_empresaId_idx" ON "produtos"("empresaId");
CREATE INDEX "produtos_empresaId_ativo_idx" ON "produtos"("empresaId", "ativo");
CREATE UNIQUE INDEX "produtos_empresaId_sku_key" ON "produtos"("empresaId", "sku");

CREATE UNIQUE INDEX "orcamentos_empresaId_numero_key" ON "orcamentos"("empresaId", "numero");
CREATE INDEX "orcamentos_empresaId_idx" ON "orcamentos"("empresaId");
CREATE INDEX "orcamentos_oportunidadeId_versao_idx" ON "orcamentos"("oportunidadeId", "versao");
CREATE INDEX "orcamentos_oportunidadeId_vigente_idx" ON "orcamentos"("oportunidadeId", "vigente");

CREATE INDEX "itens_orcamento_orcamentoId_idx" ON "itens_orcamento"("orcamentoId");
CREATE INDEX "itens_orcamento_produtoId_idx" ON "itens_orcamento"("produtoId");

CREATE INDEX "movimentacoes_estoque_empresaId_criadoEm_idx" ON "movimentacoes_estoque"("empresaId", "criadoEm");
CREATE INDEX "movimentacoes_estoque_produtoId_criadoEm_idx" ON "movimentacoes_estoque"("produtoId", "criadoEm");
CREATE INDEX "movimentacoes_estoque_orcamentoId_idx" ON "movimentacoes_estoque"("orcamentoId");
