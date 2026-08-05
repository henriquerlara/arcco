-- AlterTable
ALTER TABLE "etapas_funil" ADD COLUMN "chaveSistema" TEXT;

-- CreateEnum
CREATE TYPE "OrigemHistoricoEtapa" AS ENUM ('CRIACAO', 'MANUAL', 'CHATBOT', 'ORCAMENTO_WHATSAPP');

-- CreateTable
CREATE TABLE "historicos_etapa_oportunidade" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "oportunidadeId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "etapaNome" TEXT NOT NULL,
    "etapaAnteriorId" TEXT,
    "etapaAnteriorNome" TEXT,
    "origem" "OrigemHistoricoEtapa" NOT NULL,
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historicos_etapa_oportunidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "historicos_etapa_oportunidade_empresaId_idx" ON "historicos_etapa_oportunidade"("empresaId");

-- CreateIndex
CREATE INDEX "historicos_etapa_oportunidade_oportunidadeId_criadoEm_idx" ON "historicos_etapa_oportunidade"("oportunidadeId", "criadoEm");

-- AddForeignKey
ALTER TABLE "historicos_etapa_oportunidade" ADD CONSTRAINT "historicos_etapa_oportunidade_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historicos_etapa_oportunidade" ADD CONSTRAINT "historicos_etapa_oportunidade_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill chaveSistema for default funnel stages (by ordem)
UPDATE "etapas_funil" SET "chaveSistema" = 'NOVO_CONTATO' WHERE "ordem" = 1 AND "chaveSistema" IS NULL;
UPDATE "etapas_funil" SET "chaveSistema" = 'QUALIFICACAO' WHERE "ordem" = 2 AND "chaveSistema" IS NULL;
UPDATE "etapas_funil" SET "chaveSistema" = 'ORCAMENTO_ENVIADO' WHERE "ordem" = 3 AND "chaveSistema" IS NULL;
UPDATE "etapas_funil" SET "chaveSistema" = 'NEGOCIACAO' WHERE "ordem" = 4 AND "chaveSistema" IS NULL;
UPDATE "etapas_funil" SET "chaveSistema" = 'FECHADO' WHERE "ordem" = 5 AND "tipo" = 'GANHA' AND "chaveSistema" IS NULL;
UPDATE "etapas_funil" SET "chaveSistema" = 'PERDIDO' WHERE "ordem" = 6 AND "tipo" = 'PERDIDA' AND "chaveSistema" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "etapas_funil_empresaId_chaveSistema_key" ON "etapas_funil"("empresaId", "chaveSistema");
