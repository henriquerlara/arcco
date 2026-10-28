-- ECOL-19: fase Kanban do pedido + histórico de movimentos pós-venda.

DO $$ BEGIN
  CREATE TYPE "FaseKanbanPedido" AS ENUM (
    'PEDIDO_CONFIRMADO',
    'EM_SEPARACAO',
    'PRONTO_ENTREGA',
    'ENTREGUE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "pedidos" ADD COLUMN IF NOT EXISTS "faseKanban" "FaseKanbanPedido" NOT NULL DEFAULT 'PEDIDO_CONFIRMADO';

CREATE TABLE IF NOT EXISTS "historico_fase_pedido" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "faseAnterior" TEXT,
    "faseNova" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "usuarioId" TEXT,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "historico_fase_pedido_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "historico_fase_pedido_empresaId_idx" ON "historico_fase_pedido"("empresaId");
CREATE INDEX IF NOT EXISTS "historico_fase_pedido_pedidoId_idx" ON "historico_fase_pedido"("pedidoId");

DO $$ BEGIN
  ALTER TABLE "historico_fase_pedido"
  ADD CONSTRAINT "historico_fase_pedido_pedidoId_fkey"
  FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
