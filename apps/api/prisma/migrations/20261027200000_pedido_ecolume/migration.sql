-- ECOL-16: estrutura de pedidos (PED-####). Sem conversão operacional (ECOL-17).

CREATE TYPE "StatusPedido" AS ENUM ('CONFIRMADO', 'FINALIZADO', 'CANCELADO');

CREATE TABLE "pedidos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "oportunidadeId" TEXT NOT NULL,
    "orcamentoId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "status" "StatusPedido" NOT NULL DEFAULT 'CONFIRMADO',
    "observacoes" TEXT,
    "descontoValor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descontoTipo" "TipoDescontoOrcamento" NOT NULL DEFAULT 'VALOR',
    "descontoPercentual" DOUBLE PRECISION,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "criadoPorId" TEXT,
    "canceladoEm" TIMESTAMP(3),
    "finalizadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itens_pedido" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "produtoId" TEXT,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL DEFAULT 'un',
    "quantidade" DOUBLE PRECISION NOT NULL,
    "precoUnitario" DOUBLE PRECISION NOT NULL,
    "desconto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalLinha" DOUBLE PRECISION NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "codigoInterno" TEXT,

    CONSTRAINT "itens_pedido_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pedidos_orcamentoId_key" ON "pedidos"("orcamentoId");
CREATE UNIQUE INDEX "pedidos_empresaId_numero_key" ON "pedidos"("empresaId", "numero");
CREATE INDEX "pedidos_empresaId_idx" ON "pedidos"("empresaId");
CREATE INDEX "pedidos_oportunidadeId_idx" ON "pedidos"("oportunidadeId");

CREATE INDEX "itens_pedido_pedidoId_idx" ON "itens_pedido"("pedidoId");
CREATE INDEX "itens_pedido_produtoId_idx" ON "itens_pedido"("produtoId");

ALTER TABLE "pedidos"
ADD CONSTRAINT "pedidos_oportunidadeId_fkey"
FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pedidos"
ADD CONSTRAINT "pedidos_orcamentoId_fkey"
FOREIGN KEY ("orcamentoId") REFERENCES "orcamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "itens_pedido"
ADD CONSTRAINT "itens_pedido_pedidoId_fkey"
FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "itens_pedido"
ADD CONSTRAINT "itens_pedido_produtoId_fkey"
FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
