-- ECOL-11: campos aditivos de Negócio. Códigos OP- e obras legadas intactos.
CREATE TYPE "OrigemNegocio" AS ENUM ('CLIENTE_DIRETO', 'VIA_PARCEIRO');

ALTER TABLE "oportunidades"
ADD COLUMN "origemNegocio" "OrigemNegocio",
ADD COLUMN "parceiroId" TEXT,
ADD COLUMN "rtNegocio" DECIMAL(7,4),
ADD COLUMN "obraCep" TEXT,
ADD COLUMN "obraLogradouro" TEXT,
ADD COLUMN "obraNumero" TEXT,
ADD COLUMN "obraComplemento" TEXT,
ADD COLUMN "obraBairro" TEXT,
ADD COLUMN "obraCidade" TEXT,
ADD COLUMN "obraUf" TEXT;

ALTER TABLE "oportunidades"
ADD CONSTRAINT "oportunidades_parceiroId_fkey"
FOREIGN KEY ("parceiroId") REFERENCES "contatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "oportunidades_parceiroId_idx" ON "oportunidades"("parceiroId");
CREATE INDEX "oportunidades_empresaId_origemNegocio_idx" ON "oportunidades"("empresaId", "origemNegocio");
