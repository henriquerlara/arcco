-- AlterTable
-- SQLite: recreate enum via table rebuild is heavy; Prisma stores enums as TEXT.
-- Add Meta Cloud API connection fields (parallel to Evolution).

PRAGMA defer_foreign_keys=ON;

-- ProvedorWhatsApp now includes META (TEXT column already allows any value).

ALTER TABLE "conexoes_whatsapp" ADD COLUMN "modoConexao" TEXT;
ALTER TABLE "conexoes_whatsapp" ADD COLUMN "wabaId" TEXT;
ALTER TABLE "conexoes_whatsapp" ADD COLUMN "phoneNumberId" TEXT;
ALTER TABLE "conexoes_whatsapp" ADD COLUMN "isTestConnection" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "conexoes_whatsapp_phoneNumberId_idx" ON "conexoes_whatsapp"("phoneNumberId");
