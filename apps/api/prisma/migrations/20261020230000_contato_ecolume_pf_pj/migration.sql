-- ECOL-09a: campos aditivos PF/PJ. Contatos existentes ficam com natureza nula.
CREATE TYPE "NaturezaPessoa" AS ENUM ('PF', 'PJ');

ALTER TABLE "contatos" ADD COLUMN "natureza" "NaturezaPessoa",
ADD COLUMN "nomeFantasia" TEXT,
ADD COLUMN "inscricaoEstadual" TEXT,
ADD COLUMN "ieIsento" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "cep" TEXT,
ADD COLUMN "logradouro" TEXT,
ADD COLUMN "numero" TEXT,
ADD COLUMN "complemento" TEXT,
ADD COLUMN "bairro" TEXT,
ADD COLUMN "cidade" TEXT,
ADD COLUMN "uf" TEXT,
ADD COLUMN "telefonesExtras" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "pessoasEmpresa" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "ehParceiro" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "contatos_empresaId_documento_idx" ON "contatos"("empresaId", "documento");
CREATE INDEX "contatos_empresaId_natureza_idx" ON "contatos"("empresaId", "natureza");
CREATE INDEX "contatos_empresaId_cidade_idx" ON "contatos"("empresaId", "cidade");
CREATE INDEX "contatos_empresaId_ehParceiro_idx" ON "contatos"("empresaId", "ehParceiro");
