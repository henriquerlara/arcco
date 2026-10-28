-- ECOL-03: cadastro de fornecedor. Produtos existentes ficam com fornecedorId nulo.
CREATE TABLE "fornecedores" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeCurto" TEXT,
    "cnpj" TEXT NOT NULL,
    "aliquotaSt" DECIMAL(7,4) NOT NULL,
    "contatoNome" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fornecedores_empresaId_cnpj_key" ON "fornecedores"("empresaId", "cnpj");
CREATE INDEX "fornecedores_empresaId_ativo_idx" ON "fornecedores"("empresaId", "ativo");

ALTER TABLE "produtos" ADD COLUMN "fornecedorId" TEXT;
CREATE INDEX "produtos_fornecedorId_idx" ON "produtos"("fornecedorId");
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_fornecedorId_fkey"
  FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
