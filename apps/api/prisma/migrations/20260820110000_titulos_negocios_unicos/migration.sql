-- O título identifica o pedido; o cliente permanece como relação secundária.
-- O código garante legibilidade e unicidade mesmo quando dois pedidos têm o mesmo escopo.
UPDATE "oportunidades"
SET "titulo" =
  CASE
    WHEN lower(trim("titulo")) = lower(trim((
      SELECT "nome" FROM "contatos" WHERE "contatos"."id" = "oportunidades"."contatoId"
    )))
      OR lower(trim("titulo")) LIKE 'cliente %'
      OR lower(trim("titulo")) IN ('cliente', 'cliente whatsapp')
    THEN COALESCE(
      (SELECT NULLIF(trim("nome"), '') FROM "obras" WHERE "obras"."id" = "oportunidades"."obraId"),
      CASE WHEN lower(COALESCE("origem", '')) = 'whatsapp'
        THEN 'Atendimento via WhatsApp'
        ELSE 'Nova oportunidade'
      END
    ) || ' · ' || "codigo"
    WHEN "titulo" NOT LIKE '% · ' || "codigo"
    THEN trim("titulo") || ' · ' || "codigo"
    ELSE "titulo"
  END;
