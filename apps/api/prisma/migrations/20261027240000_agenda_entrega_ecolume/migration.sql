-- ECOL-20: tipos ENTREGA/VISITA + campos de entrega na atividade.

DO $$ BEGIN
  ALTER TYPE "TipoAtividade" ADD VALUE IF NOT EXISTS 'ENTREGA';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "TipoAtividade" ADD VALUE IF NOT EXISTS 'VISITA';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "atividades" ADD COLUMN IF NOT EXISTS "pedidoId" TEXT;
ALTER TABLE "atividades" ADD COLUMN IF NOT EXISTS "diaInteiro" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "atividades" ADD COLUMN IF NOT EXISTS "periodoDia" TEXT;
ALTER TABLE "atividades" ADD COLUMN IF NOT EXISTS "local" TEXT;
ALTER TABLE "atividades" ADD COLUMN IF NOT EXISTS "entregaCep" TEXT;
ALTER TABLE "atividades" ADD COLUMN IF NOT EXISTS "entregaLogradouro" TEXT;
ALTER TABLE "atividades" ADD COLUMN IF NOT EXISTS "entregaNumero" TEXT;
ALTER TABLE "atividades" ADD COLUMN IF NOT EXISTS "entregaComplemento" TEXT;
ALTER TABLE "atividades" ADD COLUMN IF NOT EXISTS "entregaBairro" TEXT;
ALTER TABLE "atividades" ADD COLUMN IF NOT EXISTS "entregaCidade" TEXT;
ALTER TABLE "atividades" ADD COLUMN IF NOT EXISTS "entregaUf" TEXT;
ALTER TABLE "atividades" ADD COLUMN IF NOT EXISTS "contatoLocalNome" TEXT;
ALTER TABLE "atividades" ADD COLUMN IF NOT EXISTS "contatoLocalTelefone" TEXT;
ALTER TABLE "atividades" ADD COLUMN IF NOT EXISTS "conclusaoEntrega" TEXT;
ALTER TABLE "atividades" ADD COLUMN IF NOT EXISTS "concluidaPorId" TEXT;

CREATE INDEX IF NOT EXISTS "atividades_pedidoId_idx" ON "atividades"("pedidoId");
CREATE INDEX IF NOT EXISTS "atividades_empresaId_tipo_concluida_vencimento_idx" ON "atividades"("empresaId", "tipo", "concluida", "vencimento");

DO $$ BEGIN
  ALTER TABLE "atividades"
  ADD CONSTRAINT "atividades_pedidoId_fkey"
  FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
