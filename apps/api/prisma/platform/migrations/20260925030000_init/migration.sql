-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('PROPRIETARIO', 'GESTOR', 'VENDEDOR', 'ATENDENTE');

-- CreateEnum
CREATE TYPE "SegmentoEmpresa" AS ENUM ('ILUMINACAO', 'PISOS_REVESTIMENTOS', 'ESQUADRIAS', 'CONCRETO', 'MATERIAIS_CONSTRUCAO', 'SERVICOS_OBRAS', 'OUTRO');

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "segmento" "SegmentoEmpresa" NOT NULL DEFAULT 'OUTRO',
    "telefone" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "logoArquivoId" TEXT,
    "cnpj" TEXT,
    "inscricaoEstadual" TEXT,
    "enderecoFiscal" JSONB,
    "configuracoes" JSONB NOT NULL DEFAULT '{}',
    "databaseHost" TEXT NOT NULL DEFAULT 'localhost',
    "databasePort" INTEGER NOT NULL DEFAULT 5432,
    "databaseName" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL DEFAULT 'VENDEDOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "deveTrocarSenha" BOOLEAN NOT NULL DEFAULT false,
    "versaoSessao" INTEGER NOT NULL DEFAULT 0,
    "ultimoAcessoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_empresaId_idx" ON "usuarios"("empresaId");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
