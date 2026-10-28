-- ECOL-21: resultado textual na conclusão do follow-up.
ALTER TABLE "atividades" ADD COLUMN IF NOT EXISTS "resultadoConclusao" TEXT;
