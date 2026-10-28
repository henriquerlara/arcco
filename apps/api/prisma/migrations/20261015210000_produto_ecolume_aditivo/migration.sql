ALTER TABLE "produtos" ADD COLUMN "codigoInterno" TEXT;
ALTER TABLE "produtos" ADD COLUMN "nomeFiscal" TEXT;
ALTER TABLE "produtos" ADD COLUMN "descricaoComercial" TEXT;
ALTER TABLE "produtos" ADD COLUMN "codigoFornecedor" TEXT;
ALTER TABLE "produtos" ADD COLUMN "ean" TEXT;
ALTER TABLE "produtos" ADD COLUMN "cest" TEXT;
ALTER TABLE "produtos" ADD COLUMN "origemFiscal" TEXT;
ALTER TABLE "produtos" ADD COLUMN "ipi" DOUBLE PRECISION;
ALTER TABLE "produtos" ADD COLUMN "margem" DOUBLE PRECISION;
ALTER TABLE "produtos" ADD COLUMN "custoMedio" DOUBLE PRECISION;
ALTER TABLE "produtos" ADD COLUMN "ultimoPreco" DOUBLE PRECISION;
ALTER TABLE "produtos" ADD COLUMN "fatorConversao" DOUBLE PRECISION;

CREATE UNIQUE INDEX "produtos_empresaId_codigoInterno_key" ON "produtos"("empresaId", "codigoInterno");

ALTER TABLE "movimentacoes_estoque" ADD COLUMN "motivo" TEXT;
ALTER TABLE "movimentacoes_estoque" ADD COLUMN "precoUnitarioCusto" DOUBLE PRECISION;
