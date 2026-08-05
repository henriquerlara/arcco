# ARCCO — Inteligência Comercial

ARCCO é uma plataforma web multiempresa (multi-tenant) de **CRM comercial + atendimento por WhatsApp com chatbot** voltada para empresas que vendem para o setor de construção (iluminação, concreto, pisos e revestimentos, esquadrias, materiais e serviços para obras).

O objetivo do MVP é centralizar contatos, obras, oportunidades (funil de vendas), atividades e o atendimento via WhatsApp — permitindo que um chatbot faça a triagem inicial, colete informações de orçamento e transfira para um atendente humano quando necessário.

---

## Sumário

- [Visão geral](#visão-geral)
- [Stack](#stack)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Variáveis de ambiente (.env)](#variáveis-de-ambiente-env)
- [Banco de dados — Postgres local (Docker) e Neon](#banco-de-dados--postgres-local-docker-e-neon)
- [Migrations e seed](#migrations-e-seed)
- [Execução (frontend e API)](#execução-frontend-e-api)
- [Modo mock do WhatsApp](#modo-mock-do-whatsapp)
- [Integrações: Evolution, R2, OpenAI, OpenTelemetry](#integrações-evolution-r2-openai-opentelemetry)
- [Testes](#testes)
- [Build](#build)
- [Contas demonstrativas](#contas-demonstrativas)
- [Limitações do MVP](#limitações-do-mvp)
- [Deploy](#deploy)
- [Substituição da logo/marca](#substituição-da-logomarca)
- [Estrutura do monorepo](#estrutura-do-monorepo)
- [Comandos pnpm úteis](#comandos-pnpm-úteis)
- [Documentação adicional](#documentação-adicional)

---

## Visão geral

O produto é composto por três pacotes em um monorepo pnpm:

- **`apps/web`** — SPA em Vue 3 (Vite, Tailwind, Pinia, Vue Router, TanStack Query). É o painel usado por proprietários, gestores, vendedores e atendentes.
- **`apps/api`** — API em NestJS sobre Fastify, com Prisma/PostgreSQL. Expõe as rotas REST sob o prefixo `/api`, cuida de autenticação (JWT em cookies httpOnly), isolamento multiempresa, chatbot e integração com o WhatsApp.
- **`packages/contratos`** — biblioteca compartilhada de **schemas Zod, tipos e enums** consumida tanto pela API quanto pelo frontend, garantindo contratos únicos entre back e front.

Principais capacidades do MVP:

- Cadastro/login de empresa com onboarding e templates por segmento.
- CRM: contatos, obras, oportunidades, funil (pipeline kanban), atividades e campos personalizados.
- Dashboard com métricas e gráfico de funil.
- Inbox de conversas de WhatsApp com bot + atendimento humano.
- Chatbot determinístico (máquina de estados) com classificação de intenção por regras ou OpenAI.
- Upload de arquivos com armazenamento local ou Cloudflare R2.
- Observabilidade via OpenTelemetry (opcional).

---

## Stack

**Frontend (`apps/web`)**

- Vue 3 + `<script setup>` + TypeScript
- Vite 6
- Tailwind CSS 3 + tokens de marca (design system próprio, base shadcn-vue / radix-vue)
- Pinia (estado), Vue Router (rotas), TanStack Vue Query (dados do servidor)
- vee-validate + Zod (formulários), ECharts / vue-echarts (gráficos)
- vue-draggable-plus (kanban), lucide-vue-next (ícones), vue-sonner (toasts)
- Fontes: Manrope (sans) e Cormorant Garamond (serif/marca)
- Playwright (e2e), Vitest (unitário)

**Backend (`apps/api`)**

- NestJS 10 sobre `@nestjs/platform-fastify`
- Prisma 6 + PostgreSQL
- Autenticação com `jose` (JWT) e `argon2` (hash de senha)
- `@fastify/cookie`, `@fastify/cors`, `@fastify/helmet`, `@fastify/multipart`, `@fastify/static`
- Zod (validação de entrada e de env)
- OpenAI SDK (classificação de intenção opcional)
- AWS SDK S3 + presigner (Cloudflare R2)
- OpenTelemetry (SDK Node + exportadores OTLP)
- Vitest (unitário)

**Compartilhado (`packages/contratos`)**

- TypeScript + Zod (build dual ESM/CJS)

---

## Requisitos

- **Node.js 20+** (o monorepo declara `"engines": { "node": ">=20" }`)
- **pnpm 9** (`packageManager: pnpm@9.15.9`)
- **PostgreSQL 14+** — local (recomenda-se via Docker) ou um banco gerenciado (Neon)
- Opcional: Docker (para subir o PostgreSQL local), instância da Evolution API (WhatsApp real), conta OpenAI, bucket Cloudflare R2, coletor OpenTelemetry

Instalar o pnpm, se necessário:

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
```

---

## Instalação

```bash
git clone <url-do-repositorio> arcco
cd arcco
pnpm install
```

O `pnpm install` instala as dependências de todos os workspaces (`apps/*` e `packages/*`). Em seguida, gere o client do Prisma:

```bash
pnpm db:generate
```

---

## Variáveis de ambiente (.env)

A configuração fica em um único arquivo **`.env` na raiz** do repositório. Use o `.env.example` como base:

```bash
cp .env.example .env
```

> O `.env` já é ignorado pelo Git (ver `.gitignore`). O repositório já inclui um `.env` de desenvolvimento apontando para o Postgres local na porta `5434`.

Conteúdo do `.env.example` (comentado por seção):

```env
# API
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://arcco:arcco@127.0.0.1:5434/arcco?schema=public
DIRECT_URL=postgresql://arcco:arcco@127.0.0.1:5434/arcco?schema=public
JWT_ACCESS_SECRET=altere-este-segredo-access-em-producao-min-32
JWT_REFRESH_SECRET=altere-este-segredo-refresh-em-producao-min-32
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
WHATSAPP_PROVIDER=mock
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_WEBHOOK_SECRET=altere-este-segredo-webhook
API_PUBLIC_URL=http://localhost:3000
AI_PROVIDER=rules
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
STORAGE_PROVIDER=local
LOCAL_STORAGE_PATH=./storage
R2_ENDPOINT=
R2_REGION=auto
R2_BUCKET=
R2_ACCESS_KEY=
R2_SECRET_KEY=
OTEL_SERVICE_NAME=arcco-api
OTEL_EXPORTER_OTLP_ENDPOINT=

# WEB
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=ARCCO
```

Descrição das variáveis (validadas por Zod em `apps/api/src/config/env.ts`):

| Variável | Obrigatória | Padrão | Descrição |
| --- | --- | --- | --- |
| `NODE_ENV` | não | `development` | `development` \| `test` \| `production` |
| `PORT` | não | `3000` | Porta HTTP da API |
| `FRONTEND_URL` | não | `http://localhost:5173` | Origem liberada no CORS |
| `DATABASE_URL` | **sim** | — | String de conexão do PostgreSQL |
| `DIRECT_URL` | não | — | Conexão direta (usada pelo Prisma; útil no Neon com pooler) |
| `JWT_ACCESS_SECRET` | **sim** | — | Segredo do access token (mín. 16 chars; use 32+ em produção) |
| `JWT_REFRESH_SECRET` | **sim** | — | Segredo do refresh token |
| `JWT_ACCESS_EXPIRES_IN` | não | `15m` | Validade do access token |
| `JWT_REFRESH_EXPIRES_IN` | não | `7d` | Validade do refresh token |
| `WHATSAPP_PROVIDER` | não | `mock` | `mock` \| `evolution` |
| `EVOLUTION_API_URL` | não | `` | URL base da Evolution API |
| `EVOLUTION_API_KEY` | não | `` | API key da Evolution |
| `EVOLUTION_WEBHOOK_SECRET` | não | `` | Segredo validado no header `x-webhook-secret` |
| `API_PUBLIC_URL` | não | `http://localhost:3000` | URL pública da API (webhook) |
| `AI_PROVIDER` | não | `rules` | `rules` (offline) \| `openai` |
| `OPENAI_API_KEY` | não | `` | Chave da OpenAI (quando `AI_PROVIDER=openai`) |
| `OPENAI_MODEL` | não | `gpt-4o-mini` | Modelo usado na classificação de intenção |
| `STORAGE_PROVIDER` | não | `local` | `local` \| `r2` |
| `LOCAL_STORAGE_PATH` | não | `./storage` | Diretório de arquivos no modo local |
| `R2_ENDPOINT` / `R2_REGION` / `R2_BUCKET` / `R2_ACCESS_KEY` / `R2_SECRET_KEY` | não | `` / `auto` / `` / `` / `` | Credenciais do Cloudflare R2 |
| `OTEL_SERVICE_NAME` | não | `arcco-api` | Nome do serviço na telemetria |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | não | `` | Endpoint OTLP; vazio = telemetria desligada |
| `VITE_API_URL` | não (web) | `http://localhost:3000` | URL da API consumida pelo frontend |
| `VITE_APP_NAME` | não (web) | `ARCCO` | Nome exibido no app |

---

## Banco de dados — Postgres local (Docker) e Neon

### PostgreSQL local com Docker (recomendado para desenvolvimento)

O `.env` de desenvolvimento aponta para:

```
postgresql://arcco:arcco@127.0.0.1:5434/arcco?schema=public
```

Suba um container compatível (usuário `arcco`, senha `arcco`, banco `arcco`, porta host `5434`):

```bash
docker run --name arcco-postgres \
  -e POSTGRES_USER=arcco \
  -e POSTGRES_PASSWORD=arcco \
  -e POSTGRES_DB=arcco \
  -p 5434:5432 \
  -d postgres:16
```

> A porta host `5434` é usada de propósito para não conflitar com uma instância local padrão do Postgres em `5432`.

Para parar/remover:

```bash
docker stop arcco-postgres && docker rm arcco-postgres
```

### Neon (PostgreSQL gerenciado)

Para usar o [Neon](https://neon.tech):

1. Crie um projeto e um banco.
2. Copie a connection string. O Neon fornece duas URLs — a **pooled** (com `-pooler`) e a **direta**.
3. Configure no `.env`:

```env
DATABASE_URL="postgresql://<user>:<senha>@<host>-pooler.<regiao>.aws.neon.tech/<db>?sslmode=require"
DIRECT_URL="postgresql://<user>:<senha>@<host>.<regiao>.aws.neon.tech/<db>?sslmode=require"
```

`DATABASE_URL` é usada pela aplicação em runtime; `DIRECT_URL` é usada pelo Prisma para migrations (evita passar pelo pooler). Sempre inclua `sslmode=require` no Neon.

---

## Migrations e seed

Com o banco no ar e o `.env` configurado:

```bash
# Gera o Prisma Client
pnpm db:generate

# Aplica as migrations em desenvolvimento (cria/atualiza tabelas)
pnpm db:migrate

# Alternativa sem histórico de migration (sincroniza o schema diretamente)
pnpm db:push

# Popula dados de demonstração (2 empresas, usuários, funil, contatos, obras, oportunidades, conversa mock)
pnpm db:seed
```

O seed (`apps/api/prisma/seed.ts`) recria as duas empresas demonstrativas de forma idempotente (apaga e recria a empresa pelo e-mail do proprietário) e define a senha padrão `Arcco@123`. Veja [Contas demonstrativas](#contas-demonstrativas).

---

## Execução (frontend e API)

Em dois terminais (ou use um multiplexador):

```bash
# API (NestJS) — http://localhost:3000/api
pnpm dev:api

# Frontend (Vite) — http://localhost:5173
pnpm dev:web
```

- A API sobe com prefixo global `/api` (ex.: `GET http://localhost:3000/api/autenticacao/eu`).
- O frontend consome `VITE_API_URL` (padrão `http://localhost:3000`).
- O CORS da API libera `FRONTEND_URL` com `credentials: true` (cookies de sessão).

---

## Modo mock do WhatsApp

Por padrão `WHATSAPP_PROVIDER=mock`. Nesse modo **nenhuma mensagem é enviada de verdade**: o provider mock apenas registra em log e devolve ids simulados, e as conexões aparecem sempre como `CONECTADO`. Isso permite testar todo o fluxo de chatbot/atendimento sem uma conta real de WhatsApp.

Para simular uma mensagem recebida e ver o bot responder, use o endpoint de simulação (autenticado):

```
POST /api/whatsapp/simulador/mensagem
{
  "telefone": "5511999990000",
  "nome": "Cliente Teste",
  "texto": "Quero um orçamento"
}
```

Ele garante uma instância mock para a empresa e processa a mensagem pelo mesmo caminho do webhook real (`WhatsAppService.processarMensagemRecebida`). Mais detalhes em [`docs/EVOLUTION_API.md`](docs/EVOLUTION_API.md) e [`docs/CHATBOT.md`](docs/CHATBOT.md).

---

## Integrações: Evolution, R2, OpenAI, OpenTelemetry

### Evolution API (WhatsApp real)

Defina `WHATSAPP_PROVIDER=evolution` e preencha `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_WEBHOOK_SECRET`. A API se comunica com a Evolution para enviar texto (`/message/sendText/:instancia`), conectar/gerar QR (`/instance/connect/:instancia`), desconectar e consultar estado. O webhook de entrada fica em `POST /api/webhooks/evolution` e valida o header `x-webhook-secret`. Guia completo: [`docs/EVOLUTION_API.md`](docs/EVOLUTION_API.md).

### Cloudflare R2 (armazenamento de arquivos)

Com `STORAGE_PROVIDER=r2`, os uploads vão para o bucket configurado via AWS SDK S3 (`R2_ENDPOINT`, `R2_REGION=auto`, `R2_BUCKET`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`). Com `STORAGE_PROVIDER=local` (padrão) os arquivos ficam em `LOCAL_STORAGE_PATH` (`./storage`) e são servidos pela própria API.

### OpenAI (classificação de intenção)

Com `AI_PROVIDER=openai` e `OPENAI_API_KEY` definido, a classificação de intenção do chatbot usa o modelo `OPENAI_MODEL` (padrão `gpt-4o-mini`). Com `AI_PROVIDER=rules` (padrão), tudo funciona offline usando regras/expressões regulares — sem custo e determinístico.

### OpenTelemetry (observabilidade)

A telemetria é inicializada em `apps/api/src/main.ts` antes do bootstrap. Defina `OTEL_EXPORTER_OTLP_ENDPOINT` (e opcionalmente `OTEL_SERVICE_NAME`) para exportar traces/métricas via OTLP. Se o endpoint estiver vazio, a telemetria fica desativada.

---

## Testes

```bash
# Todos os pacotes que definem "test"
pnpm test

# Somente a API (Vitest)
pnpm --filter @arcco/api test

# Somente o frontend (Vitest)
pnpm --filter @arcco/web test

# End-to-end do frontend (Playwright)
pnpm test:e2e
```

Há testes unitários para utilidades e regras de negócio (normalização de telefone, distribuição/rodízio, funil, horário de atendimento, campos personalizados, multi-tenant, máquina de estados do chatbot e classificação de intenção).

---

## Build

```bash
# Build completo (contratos -> API -> web)
pnpm build

# Apenas API (compila contratos + nest build)
pnpm build:api

# Apenas frontend (vue-tsc + vite build)
pnpm build:web
```

Verificações estáticas:

```bash
pnpm typecheck
pnpm lint
pnpm format   # prettier --write
```

---

## Contas demonstrativas

Após rodar `pnpm db:seed`, as seguintes contas ficam disponíveis (senha padrão para todas):

| E-mail | Perfil | Empresa | Segmento |
| --- | --- | --- | --- |
| `proprietario.iluminacao@demo.arcco.local` | Proprietário | ARCCO Demo Iluminação | Iluminação |
| `proprietario.concreto@demo.arcco.local` | Proprietário | ARCCO Demo Concreto | Concreto |

**Senha:** `Arcco@123`

O seed também cria usuários vendedor e atendente para cada empresa (ex.: `vendedor.iluminacao@demo.arcco.local`, `atendente.concreto@demo.arcco.local`), todos com a mesma senha. As empresas já vêm com onboarding concluído, funil, categorias, campos personalizados por segmento, contatos, obras, oportunidades, atividades e uma conversa de WhatsApp (mock) de exemplo.

---

## Limitações do MVP

- **Chatbot determinístico e enxuto:** a máquina de estados cobre menu, coleta de orçamento e transferência para humano. Intenções como financeiro, entrega, pós-venda e negociação **transferem para atendente** (não há respostas ricas automatizadas).
- **Sem envio de mídia pelo bot:** o processamento trata mensagens de **texto**; anexos/mídia recebidos não são interpretados.
- **Sem tempo real (WebSocket):** o inbox usa polling via TanStack Query; não há push por socket.
- **OpenAI limitado à classificação de intenção** (não gera respostas livres).
- **Sem orçamento/pedido/financeiro/NF/estoque** — são itens de roadmap (ver [`docs/ROADMAP.md`](docs/ROADMAP.md)).
- **Perfis básicos** (PROPRIETARIO, GESTOR, VENDEDOR, ATENDENTE) com regras de acesso simples.
- **Idempotência de mensagens** via `@@unique([conversaId, idExterno])`, mas sem fila/reprocessamento robusto.

---

## Deploy

Arquitetura sugerida: **frontend na Vercel**, **API na Railway ou Render**, **banco no Neon**.

### Frontend (Vercel)

- Framework: Vite. Diretório do projeto: `apps/web`.
- Build command: `pnpm build:web` (ou `pnpm --filter @arcco/web build`).
- Output: `apps/web/dist`.
- Variáveis: `VITE_API_URL=https://<sua-api>` e `VITE_APP_NAME=ARCCO`.
- Como é uma SPA, configure fallback de rotas para `index.html`.

### API (Railway / Render)

- Node 20+. Instalação: `pnpm install`.
- Build: `pnpm build:api`. Start: `pnpm --filter @arcco/api start` (executa `node dist/main.js`).
- Rode as migrations em produção: `pnpm --filter @arcco/api exec prisma migrate deploy`.
- Variáveis: todas da seção API do `.env`, com `NODE_ENV=production`, segredos JWT fortes (32+ chars), `FRONTEND_URL` apontando para o domínio da Vercel e `API_PUBLIC_URL` para o domínio público da API.
- Se usar WhatsApp real, configure `WHATSAPP_PROVIDER=evolution` e o webhook da Evolution para `https://<sua-api>/api/webhooks/evolution`.

### Banco (Neon)

- Use `DATABASE_URL` (pooled) e `DIRECT_URL` (direta) com `sslmode=require`.
- Aplique migrations com `prisma migrate deploy` no deploy da API.

---

## Substituição da logo/marca

A identidade visual fica concentrada em dois pontos:

1. **Componente de marca:** `apps/web/src/components/marca/MarcaArcco.vue` — SVG inline dos "dois arcos" + wordmark "ARCCO". Para trocar o símbolo, edite os `<path>` do SVG (gradiente `arcco-ouro`) ou substitua por sua própria arte; ajuste `dimensoes` para os tamanhos `sm/md/lg/xl` e as props `tema`/`subtitulo`.
2. **Assets públicos:** `apps/web/public/marca/` — contém `arcco-simbolo.svg` (e o placeholder `.gitkeep`). Coloque aqui favicon/símbolo/versões estáticas da marca; arquivos em `public/` são servidos na raiz (ex.: `/marca/arcco-simbolo.svg`).

As cores da marca são tokens CSS em `apps/web/src/styles/tokens.css` e ficam disponíveis no Tailwind (`dourado`, `carvao`, `marfim`, etc.) via `apps/web/tailwind.config.ts`. Detalhes em [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

---

## Estrutura do monorepo

```
arcco/
├── apps/
│   ├── api/                      # NestJS + Fastify + Prisma
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # 14 modelos (multiempresa)
│   │   │   └── seed.ts           # dados de demonstração
│   │   └── src/
│   │       ├── main.ts           # bootstrap + OTEL + plugins Fastify
│   │       ├── app.module.ts     # módulos + guards globais
│   │       ├── config/env.ts     # validação de env (Zod)
│   │       ├── common/           # auth, guards, decorators, erros, pipes, utils
│   │       ├── database/         # PrismaModule/PrismaService
│   │       ├── observabilidade/  # otel.ts
│   │       └── modules/          # autenticacao, empresas, usuarios, contatos,
│   │                             # obras, categorias, funil, oportunidades,
│   │                             # atividades, campos-personalizados, dashboard,
│   │                             # conversas, mensagens, chatbot, whatsapp,
│   │                             # arquivos, ia
│   └── web/                      # Vue 3 + Vite + Tailwind
│       ├── public/marca/         # assets de marca
│       └── src/
│           ├── components/       # ui, compartilhados, formularios, layout, marca
│           ├── modules/          # dashboard, conversas, pipeline, contatos, obras,
│           │                     # oportunidades, atividades, autenticacao, configuracoes
│           ├── services/         # cliente HTTP e chamadas por domínio
│           ├── stores/           # Pinia (autenticacao, interface)
│           ├── router/           # rotas + guardas de navegação
│           ├── styles/           # tokens.css, main.css
│           └── composables/      # cn, formatadores, rótulos, notificações
├── packages/
│   └── contratos/                # Zod schemas + tipos + enums (ESM/CJS)
├── docs/                         # documentação (MVP, arquitetura, DB, etc.)
├── .env / .env.example
├── package.json                  # scripts do monorepo
└── pnpm-workspace.yaml
```

---

## Comandos pnpm úteis

| Comando | O que faz |
| --- | --- |
| `pnpm install` | Instala dependências de todos os workspaces |
| `pnpm dev:api` | Sobe a API em modo watch (`nest start --watch`) |
| `pnpm dev:web` | Sobe o frontend (Vite) |
| `pnpm build` | Build completo: contratos → API → web |
| `pnpm build:api` | Build da API (inclui contratos) |
| `pnpm build:web` | Build do frontend |
| `pnpm lint` | `-r` typecheck/lint por pacote |
| `pnpm typecheck` | Checagem de tipos em todos os pacotes |
| `pnpm test` | Testes unitários (todos os pacotes) |
| `pnpm test:e2e` | Testes end-to-end (Playwright) do web |
| `pnpm db:generate` | Gera o Prisma Client |
| `pnpm db:migrate` | Aplica migrations (dev) |
| `pnpm db:push` | Sincroniza schema sem migration |
| `pnpm db:seed` | Popula dados de demonstração |
| `pnpm format` | Formata com Prettier |

Para rodar um script apenas em um pacote, use o filtro do pnpm, por exemplo:

```bash
pnpm --filter @arcco/api exec prisma migrate deploy
pnpm --filter @arcco/web preview
```

---

## Documentação adicional

- [`docs/MVP.md`](docs/MVP.md) — problema, objetivo, escopo, personas e fluxo principal
- [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) — estrutura, decisões, multiempresa, autenticação e integrações
- [`docs/BANCO_DE_DADOS.md`](docs/BANCO_DE_DADOS.md) — modelo de dados (14 tabelas), relacionamentos e índices
- [`docs/EVOLUTION_API.md`](docs/EVOLUTION_API.md) — integração WhatsApp (Evolution), webhook, segurança e mock
- [`docs/CHATBOT.md`](docs/CHATBOT.md) — intenções, estados, fluxos e limites da IA
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — paleta, tipografia, tokens e componentes
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — evolução planejada (orçamento, pedidos, financeiro, NF, estoque, etc.)

---

_ARCCO — Inteligência Comercial._
