-- ECOL-17: pagamentos, comissão, checklist, separação/compra e origem da baixa no pedido.

DO $$ BEGIN
  CREATE TYPE "ModeloPagamentoPedido" AS ENUM (
    'PIX_AVISTA',
    'CARTAO_CREDITO',
    'CARTAO_DEBITO',
    'SINAL_RESTANTE_ENTREGA',
    'SINAL_BOLETOS',
    'PERSONALIZADO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StatusPagamentoPedido" AS ENUM ('PREVISTO', 'RECEBIDO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StatusComissaoPedido" AS ENUM ('A_PAGAR', 'PAGA', 'CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TipoChecklistPedido" AS ENUM (
    'PAGAMENTO_RECEBIDO',
    'ITENS_COMPRADOS',
    'MATERIAL_SEPARADO',
    'NF_EMITIDA',
    'ENTREGUE',
    'COMISSAO_PAGA'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "pagamentos_pedido" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "modelo" "ModeloPagamentoPedido" NOT NULL,
    "forma" TEXT NOT NULL,
    "valor" DECIMAL(18,4) NOT NULL,
    "vencimentoEm" TIMESTAMP(3),
    "status" "StatusPagamentoPedido" NOT NULL DEFAULT 'PREVISTO',
    "recebidoEm" TIMESTAMP(3),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pagamentos_pedido_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "comissoes_pedido" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "parceiroId" TEXT NOT NULL,
    "rtPercentual" DECIMAL(7,4) NOT NULL,
    "baseCalculo" DECIMAL(18,4) NOT NULL,
    "valorComissao" DECIMAL(18,4) NOT NULL,
    "status" "StatusComissaoPedido" NOT NULL DEFAULT 'A_PAGAR',
    "pagoEm" TIMESTAMP(3),
    "formaPagamento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "comissoes_pedido_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "checklist_itens_pedido" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "tipo" "TipoChecklistPedido" NOT NULL,
    "rotulo" TEXT NOT NULL,
    "aplicavel" BOOLEAN NOT NULL DEFAULT true,
    "automatico" BOOLEAN NOT NULL DEFAULT false,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "concluidoEm" TIMESTAMP(3),
    "usuarioId" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "checklist_itens_pedido_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "itens_separacao_pedido" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "itens_separacao_pedido_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "itens_compra_pedido" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "quantidadeFalta" DOUBLE PRECISION NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "itens_compra_pedido_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "movimentacoes_estoque" ADD COLUMN IF NOT EXISTS "pedidoId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "comissoes_pedido_pedidoId_key" ON "comissoes_pedido"("pedidoId");
CREATE UNIQUE INDEX IF NOT EXISTS "checklist_itens_pedido_pedidoId_tipo_key" ON "checklist_itens_pedido"("pedidoId", "tipo");

CREATE INDEX IF NOT EXISTS "pagamentos_pedido_empresaId_idx" ON "pagamentos_pedido"("empresaId");
CREATE INDEX IF NOT EXISTS "pagamentos_pedido_pedidoId_idx" ON "pagamentos_pedido"("pedidoId");
CREATE INDEX IF NOT EXISTS "comissoes_pedido_empresaId_idx" ON "comissoes_pedido"("empresaId");
CREATE INDEX IF NOT EXISTS "comissoes_pedido_parceiroId_idx" ON "comissoes_pedido"("parceiroId");
CREATE INDEX IF NOT EXISTS "checklist_itens_pedido_empresaId_idx" ON "checklist_itens_pedido"("empresaId");
CREATE INDEX IF NOT EXISTS "checklist_itens_pedido_pedidoId_idx" ON "checklist_itens_pedido"("pedidoId");
CREATE INDEX IF NOT EXISTS "itens_separacao_pedido_pedidoId_idx" ON "itens_separacao_pedido"("pedidoId");
CREATE INDEX IF NOT EXISTS "itens_compra_pedido_pedidoId_idx" ON "itens_compra_pedido"("pedidoId");
CREATE INDEX IF NOT EXISTS "movimentacoes_estoque_pedidoId_idx" ON "movimentacoes_estoque"("pedidoId");

DO $$ BEGIN
  ALTER TABLE "pagamentos_pedido"
  ADD CONSTRAINT "pagamentos_pedido_pedidoId_fkey"
  FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "comissoes_pedido"
  ADD CONSTRAINT "comissoes_pedido_pedidoId_fkey"
  FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "checklist_itens_pedido"
  ADD CONSTRAINT "checklist_itens_pedido_pedidoId_fkey"
  FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "itens_separacao_pedido"
  ADD CONSTRAINT "itens_separacao_pedido_pedidoId_fkey"
  FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "itens_compra_pedido"
  ADD CONSTRAINT "itens_compra_pedido_pedidoId_fkey"
  FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
