-- ECOL-10a: dados de parceria no Contato. Campos preservados ao desmarcar ehParceiro.
CREATE TYPE "TipoParceiro" AS ENUM ('ARQUITETO_DESIGNER', 'INSTALADOR_ELETRICISTA', 'CONSTRUTORA');

ALTER TABLE "contatos"
ADD COLUMN "tipoParceiro" "TipoParceiro",
ADD COLUMN "rtPadrao" DECIMAL(7,4),
ADD COLUMN "chavePix" TEXT,
ADD COLUMN "banco" TEXT,
ADD COLUMN "agencia" TEXT,
ADD COLUMN "conta" TEXT,
ADD COLUMN "titularNome" TEXT,
ADD COLUMN "titularDocumento" TEXT,
ADD COLUMN "observacoesParceria" TEXT;
