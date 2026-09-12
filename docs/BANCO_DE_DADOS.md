# ARCCO — Banco de dados local

A fonte de verdade é `apps/api/prisma/schema.prisma`: Prisma com **SQLite local**. O arquivo `apps/api/prisma/arcco.db` é criado automaticamente, persiste entre sessões e é ignorado pelo Git.

## Inicialização e evolução

- `pnpm dev:api` e `pnpm --filter @arcco/api start` executam `prisma migrate deploy` antes de iniciar a API.
- `pnpm db:migrate` cria/aplica migrations durante o desenvolvimento.
- `pnpm db:seed` cria as contas e os cenários de demonstração.
- A migration-base local está em `prisma/migrations/20260819170000_sqlite_local_eventos`.
- O histórico PostgreSQL anterior foi preservado em `prisma/migrations-postgresql-legacy`; ele não é executado.

Não há variável de conexão, servidor de banco, Docker ou serviço gerenciado no caminho crítico. Para backup, copie `arcco.db` com a API parada. Para restaurar, substitua esse arquivo pela cópia correspondente ao mesmo schema.

## Modelo

Todas as entidades de negócio mantêm `empresaId`, índices por tenant e relações com integridade referencial. Exclusões a partir de `Empresa` usam cascade; relações opcionais usam `SET NULL` quando apropriado.

| Grupo | Tabelas | Responsabilidade |
| --- | --- | --- |
| Conta | `empresas`, `usuarios` | Tenant, preferências e acesso |
| CRM | `contatos`, `obras`, `contatos_obras`, `categorias` | Pessoas, projetos e organização |
| Negócios | `etapas_funil`, `oportunidades` | Estado comercial canônico |
| Timeline | `historicos_etapa_oportunidade`, `eventos_oportunidade` | Compatibilidade e histórico imutável orientado a eventos |
| Trabalho | `atividades` | Próximas ações; a mais próxima sincroniza a oportunidade |
| Atendimento | `conexoes_whatsapp`, `conversas`, `mensagens` | Canal, bot e atendimento humano |
| Extensões | `arquivos`, `campos_personalizados` | Arquivos locais e dados específicos por segmento |

## Eventos e estados

`eventos_oportunidade` é a fonte da timeline. Os eventos atuais são:

- `OPORTUNIDADE_CRIADA`;
- `ETAPA_ALTERADA`;
- `ATIVIDADE_CRIADA`;
- `ATIVIDADE_CONCLUIDA`;
- `ORCAMENTO_ENVIADO`.

Eventos são imutáveis, ordenados por `criadoEm` e registram origem e usuário quando disponíveis. O histórico de etapa legado é convertido automaticamente ao abrir uma oportunidade antiga.

O funil padrão tem cinco estados claros: `Novo contato`, `Orçamento`, `Negociação`, `Fechado` e `Perdido`. Chatbot e envio de orçamento avançam o estado automaticamente; edição manual permanece como correção explícita.

## JSON e compatibilidade

Preferências, estado do bot e dados personalizados usam colunas `Json`. Opções de campos personalizados também usam JSON, pois listas escalares específicas do PostgreSQL não existem no SQLite. A camada de serviço normaliza esse valor para `string[]` antes das regras de negócio.

## Integridade e recuperação

- chaves primárias UUID;
- telefone único por empresa;
- código de oportunidade único por empresa;
- chave de etapa de sistema única por empresa;
- mensagem externa única por conversa, garantindo idempotência;
- migrations aplicadas em ordem e registradas em `_prisma_migrations`;
- erros de persistência passam pelo filtro global da API.
