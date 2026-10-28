-- ECOL-12: status aditivos e origem da duplicação. Números ORC-n-vN e ACEITO intactos.
ALTER TYPE "StatusOrcamento" ADD VALUE IF NOT EXISTS 'SUBSTITUIDO';
ALTER TYPE "StatusOrcamento" ADD VALUE IF NOT EXISTS 'RECUSADO';

ALTER TABLE "orcamentos" ADD COLUMN "orcamentoOrigemId" TEXT;

ALTER TABLE "orcamentos"
ADD CONSTRAINT "orcamentos_orcamentoOrigemId_fkey"
FOREIGN KEY ("orcamentoOrigemId") REFERENCES "orcamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "orcamentos_orcamentoOrigemId_idx" ON "orcamentos"("orcamentoOrigemId");
