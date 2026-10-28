-- ECOL-18: motivo e ator do cancelamento (sem apagar histórico).

ALTER TABLE "pedidos" ADD COLUMN IF NOT EXISTS "canceladoPorId" TEXT;
ALTER TABLE "pedidos" ADD COLUMN IF NOT EXISTS "motivoCancelamento" TEXT;
