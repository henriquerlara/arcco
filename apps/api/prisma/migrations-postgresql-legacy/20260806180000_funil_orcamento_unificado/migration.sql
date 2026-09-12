-- Unifica Qualificação + Orçamento enviado → Orçamento (QUALIFICACAO).
-- Cards em ORCAMENTO_ENVIADO passam para NEGOCIACAO; etapa antiga é desativada.

UPDATE "etapas_funil"
SET "nome" = 'Orçamento'
WHERE "chaveSistema" = 'QUALIFICACAO';

UPDATE "oportunidades" AS o
SET "etapaId" = neg."id"
FROM "etapas_funil" AS env
JOIN "etapas_funil" AS neg
  ON neg."empresaId" = env."empresaId"
 AND neg."chaveSistema" = 'NEGOCIACAO'
 AND neg."ativo" = true
WHERE env."chaveSistema" = 'ORCAMENTO_ENVIADO'
  AND o."etapaId" = env."id";

UPDATE "etapas_funil"
SET "ativo" = false
WHERE "chaveSistema" = 'ORCAMENTO_ENVIADO';
