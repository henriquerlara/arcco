-- ECOL-13: snapshot financeiro da linha + desconto % no cabeçalho. Legado intacto.
CREATE TYPE "BaseCustoItemOrcamento" AS ENUM ('ULTIMO_PRECO', 'CUSTO_MEDIO', 'INFORMADO');
CREATE TYPE "TipoDescontoOrcamento" AS ENUM ('VALOR', 'PERCENTUAL');

ALTER TABLE "orcamentos" ADD COLUMN "descontoTipo" "TipoDescontoOrcamento" NOT NULL DEFAULT 'VALOR';
ALTER TABLE "orcamentos" ADD COLUMN "descontoPercentual" DOUBLE PRECISION;

ALTER TABLE "itens_orcamento" ADD COLUMN "codigoInterno" TEXT;
ALTER TABLE "itens_orcamento" ADD COLUMN "baseCusto" "BaseCustoItemOrcamento";
ALTER TABLE "itens_orcamento" ADD COLUMN "custoBase" DECIMAL(18,4);
ALTER TABLE "itens_orcamento" ADD COLUMN "ipiPercentual" DECIMAL(7,4);
ALTER TABLE "itens_orcamento" ADD COLUMN "stPercentual" DECIMAL(7,4);
ALTER TABLE "itens_orcamento" ADD COLUMN "margem" DECIMAL(18,4);
ALTER TABLE "itens_orcamento" ADD COLUMN "precoManual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "itens_orcamento" ADD COLUMN "margemEfetiva" DECIMAL(18,4);
