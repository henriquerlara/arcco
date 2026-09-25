-- AlterTable
ALTER TABLE "empresas" ADD COLUMN "cnpj" TEXT;
ALTER TABLE "empresas" ADD COLUMN "inscricaoEstadual" TEXT;
ALTER TABLE "empresas" ADD COLUMN "enderecoFiscal" JSONB;

-- AlterTable
ALTER TABLE "contatos" ADD COLUMN "documento" TEXT;

-- AlterTable
ALTER TABLE "produtos" ADD COLUMN "ncm" TEXT;

-- CreateTable
CREATE TABLE "notas_fiscais" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "orcamentoId" TEXT NOT NULL,
    "oportunidadeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "chaveAcesso" TEXT,
    "numero" TEXT,
    "serie" TEXT,
    "protocolo" TEXT,
    "mensagemErro" TEXT,
    "idExternoFocus" TEXT,
    "refFocus" TEXT,
    "arquivoXmlId" TEXT,
    "arquivoPdfId" TEXT,
    "payloadEnvio" JSONB,
    "respostaFocus" JSONB,
    "autorizadoEm" DATETIME,
    "criadoPorId" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notas_fiscais_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notas_fiscais_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "orcamentos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notas_fiscais_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "notas_fiscais_empresaId_idx" ON "notas_fiscais"("empresaId");
CREATE INDEX "notas_fiscais_orcamentoId_idx" ON "notas_fiscais"("orcamentoId");
CREATE INDEX "notas_fiscais_oportunidadeId_idx" ON "notas_fiscais"("oportunidadeId");
CREATE INDEX "notas_fiscais_empresaId_status_idx" ON "notas_fiscais"("empresaId", "status");
CREATE UNIQUE INDEX "notas_fiscais_empresaId_refFocus_key" ON "notas_fiscais"("empresaId", "refFocus");
