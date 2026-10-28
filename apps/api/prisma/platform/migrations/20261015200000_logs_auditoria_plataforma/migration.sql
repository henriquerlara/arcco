CREATE TABLE "logs_auditoria" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "tipo" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "anterior" JSONB,
    "posterior" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "logs_auditoria_empresaId_criadoEm_idx" ON "logs_auditoria"("empresaId", "criadoEm");
CREATE INDEX "logs_auditoria_empresaId_usuarioId_idx" ON "logs_auditoria"("empresaId", "usuarioId");
CREATE INDEX "logs_auditoria_empresaId_tipo_criadoEm_idx" ON "logs_auditoria"("empresaId", "tipo", "criadoEm");
