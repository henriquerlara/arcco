-- ECOL-26b — perfis reutilizáveis de permissão (template por empresa)
CREATE TABLE IF NOT EXISTS "conjuntos_permissao" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "chaves" TEXT[] NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conjuntos_permissao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "conjuntos_permissao_empresaId_nome_key" ON "conjuntos_permissao"("empresaId", "nome");
CREATE INDEX IF NOT EXISTS "conjuntos_permissao_empresaId_idx" ON "conjuntos_permissao"("empresaId");

ALTER TABLE "conjuntos_permissao"
  DROP CONSTRAINT IF EXISTS "conjuntos_permissao_empresaId_fkey";
ALTER TABLE "conjuntos_permissao"
  ADD CONSTRAINT "conjuntos_permissao_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
