-- ECOL-28b: eventos fiscais da NF-e (CC-e e envio de e-mail DANFE/XML via Focus).
CREATE TABLE IF NOT EXISTS "eventos_nota_fiscal" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "notaFiscalId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "numeroSequencia" INTEGER,
  "texto" TEXT,
  "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "protocolo" TEXT,
  "respostaFocus" JSONB,
  "mock" BOOLEAN NOT NULL DEFAULT false,
  "criadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "eventos_nota_fiscal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "eventos_nota_fiscal_empresaId_notaFiscalId_idx"
  ON "eventos_nota_fiscal"("empresaId", "notaFiscalId");

DO $$ BEGIN
  ALTER TABLE "eventos_nota_fiscal"
    ADD CONSTRAINT "eventos_nota_fiscal_notaFiscalId_fkey"
    FOREIGN KEY ("notaFiscalId") REFERENCES "notas_fiscais"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
