-- CreateTable
CREATE TABLE "concessoes_permissao" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "conjuntoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concessoes_permissao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "concessoes_permissao_empresaId_usuarioId_idx" ON "concessoes_permissao"("empresaId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "concessoes_permissao_usuarioId_chave_key" ON "concessoes_permissao"("usuarioId", "chave");

-- AddForeignKey
ALTER TABLE "concessoes_permissao" ADD CONSTRAINT "concessoes_permissao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concessoes_permissao" ADD CONSTRAINT "concessoes_permissao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
