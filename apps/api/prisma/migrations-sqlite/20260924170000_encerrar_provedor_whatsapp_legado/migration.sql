-- Encerra conexões do provedor antigo sem apagar conversas, mensagens ou oportunidades.
-- SQLite guarda o enum como TEXT; depois desta atualização o schema só aceita MOCK e META.

UPDATE "conexoes_whatsapp"
SET
  "status" = 'DESCONECTADO',
  "qrCode" = NULL,
  "ultimoErro" = 'Canal encerrado. Use a WhatsApp Cloud API (Meta).',
  "provedor" = 'MOCK'
WHERE "provedor" = 'EVOLUTION';

UPDATE "conexoes_whatsapp"
SET "modoConexao" = NULL
WHERE "modoConexao" = 'evolution';
