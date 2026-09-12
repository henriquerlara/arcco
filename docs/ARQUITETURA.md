# ARCCO — Arquitetura

Visão técnica do sistema: estrutura do monorepo, decisões de projeto, isolamento multiempresa, autenticação, integrações e um diagrama textual do todo.

---

## Visão geral

ARCCO é um monorepo pnpm com três pacotes:

- **`apps/web`** — SPA Vue 3 (Vite). Camada de apresentação e interação.
- **`apps/api`** — API NestJS sobre Fastify, com Prisma/SQLite local. Regras de negócio, persistência e integrações.
- **`packages/contratos`** — Zod schemas, tipos e enums compartilhados entre back e front.

A comunicação web ↔ API é REST/JSON sob o prefixo `/api`, com autenticação por cookies httpOnly.

---

## Estrutura

### `apps/api` (NestJS + Fastify)

```
src/
├── main.ts                 # bootstrap: OTEL, plugins Fastify, prefixo /api
├── app.module.ts           # registra módulos e guards globais (AuthGuard, PerfilGuard, filtro de exceção)
├── config/env.ts           # carrega e valida variáveis de ambiente com Zod
├── common/
│   ├── auth/               # jwt.service, senha.service (argon2), tipos
│   ├── decorators/         # @Publico, @Perfis, @UsuarioAtual, @EmpresaAtual
│   ├── guards/             # AuthGuard, PerfilGuard
│   ├── erros/              # Erros (fábrica), FiltroExcecaoGlobal
│   ├── pipes/              # ZodValidationPipe
│   └── utils/              # telefone, distribuicao, funil, horario, rate-limit, campos-personalizados
├── database/               # PrismaModule, PrismaService
├── observabilidade/        # otel.ts
└── modules/                # um módulo por domínio
    ├── autenticacao/       # /autenticacao
    ├── empresas/           # /empresa (+ templates por segmento)
    ├── usuarios/           # /usuarios
    ├── contatos/           # /contatos
    ├── obras/              # /obras
    ├── categorias/         # /categorias
    ├── funil/              # /funil/etapas
    ├── oportunidades/      # /oportunidades
    ├── eventos/            # timeline imutável + próxima ação derivada
    ├── atividades/         # /atividades
    ├── campos-personalizados/  # /campos-personalizados
    ├── dashboard/          # /dashboard
    ├── conversas/          # /conversas
    ├── mensagens/          # /conversas/:conversaId/mensagens
    ├── chatbot/            # máquina de estados + orquestração
    ├── whatsapp/           # /whatsapp, /webhooks (Evolution/mock)
    ├── arquivos/           # /arquivos (local/R2)
    └── ia/                 # provedor de intenção (rules/openai)
```

Cada módulo segue o padrão **controller → service → prisma**, com validação de entrada via `ZodValidationPipe` usando schemas de `@arcco/contratos` (ou schemas locais quando específicos do módulo).

### `apps/web` (Vue 3 + Vite)

```
src/
├── main.ts                 # cria app, Pinia, Router, Vue Query
├── App.vue / layouts/AppShell.vue
├── router/                 # rotas + beforeEach (auth, troca de senha, onboarding)
├── stores/                 # Pinia: autenticacao, interface
├── services/               # http.ts (cliente) + um arquivo por domínio
├── modules/                # telas por domínio (dashboard, conversas, pipeline, ...)
├── components/             # ui (base), compartilhados, formularios, layout, marca
├── composables/            # cn, formatadores, rótulos, notificações, visibilidade
├── styles/                 # tokens.css (marca), main.css
└── types/                  # tipos de domínio/api
```

### `packages/contratos`

Fonte única de verdade dos contratos: enums (perfis, status, intenções), schemas Zod (auth, crm, empresa, ia) e tipos inferidos. Build dual (ESM/CJS) para ser consumido tanto pelo Vite quanto pelo NestJS.

---

## Decisões de projeto

- **Monorepo pnpm com workspaces** — compartilha `@arcco/contratos` sem publicar em registry; um único `pnpm install`.
- **Contratos compartilhados (Zod)** — os mesmos schemas validam a entrada na API e alimentam formulários/tipos no front, eliminando divergência de contrato.
- **NestJS sobre Fastify** — organização modular (DI, guards, pipes) com o desempenho do Fastify; plugins de cookie, cors, helmet e multipart registrados no bootstrap.
- **Prisma + SQLite local** — inicialização automática por migrations, arquivo persistente no dispositivo e modelos em português mapeados para tabelas `snake_case`.
- **Timeline orientada a eventos** — ações reais registram eventos imutáveis; o funil e a próxima ação são consequências do trabalho, não manutenção paralela.
- **Multi-tenant por coluna `empresaId`** — simplicidade operacional (um banco, um schema) com isolamento aplicado na camada de serviço e reforçado por índices/uniques compostos.
- **Autenticação stateless com cookies httpOnly** — access token curto + refresh token, com `versaoSessao` para invalidação.
- **Guards globais** — `AuthGuard` e `PerfilGuard` aplicados a toda a API; rotas liberadas explicitamente com `@Publico()`.
- **Chatbot como máquina de estados pura** — lógica determinística e testável (sem I/O), com efeitos colaterais executados pelo service.
- **Provedores plugáveis** — WhatsApp (`mock`/`evolution`), IA (`rules`/`openai`) e armazenamento (`local`/`r2`) selecionados por variável de ambiente, permitindo rodar tudo offline.
- **Frontend orientado a dados de servidor** — TanStack Query cuida de cache/refetch (inbox por polling), Pinia para estado de sessão/UI.

---

## Multiempresa (multi-tenant)

- **Modelo:** toda tabela de negócio tem `empresaId` e relação `onDelete: Cascade` com `Empresa`. Apagar a empresa remove todos os seus dados.
- **Isolamento:** o `empresaId` do usuário autenticado é resolvido pelo `AuthGuard` e injetado via `@EmpresaAtual()`. Os serviços **sempre** filtram por `empresaId`, e os índices/uniques são compostos com ele (ex.: `@@unique([empresaId, telefoneNormalizado])`, `@@unique([empresaId, codigo])`).
- **Configuração por empresa:** o campo JSON `Empresa.configuracoes` guarda horário de atendimento, configurações do chatbot e `onboardingConcluido`.
- **Bootstrap por segmento:** ao criar a empresa, um template (`templates-segmento.ts`) semeia funil, categorias e campos personalizados adequados ao segmento (iluminação, concreto, etc.).
- **Teste de isolamento:** há teste dedicado (`modules/contatos/multi-tenant.spec.ts`) garantindo que uma empresa não acessa dados de outra.

---

## Autenticação e autorização

- **Senhas:** hash com **argon2id** (`common/auth/senha.service.ts`).
- **Tokens:** JWT assinados com `jose`, usando `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`. Access token curto (`15m`) e refresh (`7d`), configuráveis.
- **Cookies httpOnly:** os tokens são entregues em cookies (não expostos ao JS do browser). O CORS libera `FRONTEND_URL` com `credentials: true`.
- **Sessão:** `Usuario.versaoSessao` permite invalidar sessões (logout global / troca de senha). `deveTrocarSenha` força a troca de senha temporária antes de navegar.
- **Rotas de auth (`/api/autenticacao`):** `cadastrar`, `entrar`, `renovar`, `sair`, `eu`, `trocar-senha`.
- **Guards globais:** `AuthGuard` exige sessão válida (exceto rotas `@Publico()`); `PerfilGuard` aplica restrição por perfil via `@Perfis(...)` (ex.: só `PROPRIETARIO`/`GESTOR` criam conexões WhatsApp).
- **Fluxo no front:** `router/index.ts` resolve a sessão (`carregarSessao`) e redireciona para `entrar`, `trocar-senha` ou `onboarding` conforme o estado.

---

## Integrações

- **WhatsApp (Evolution API):** provider selecionado por `WHATSAPP_PROVIDER`. `EvolutionWhatsAppProvider` fala HTTP com a Evolution (enviar texto, conectar/QR, status, logout). Entrada por webhook `POST /api/webhooks/evolution` validando `x-webhook-secret`. Em `mock`, nada é enviado de verdade. Ver [`EVOLUTION_API.md`](EVOLUTION_API.md).
- **IA (OpenAI):** provider por `AI_PROVIDER`. `rules` usa regex/palavras-chave (offline, determinístico); `openai` usa o SDK e o modelo `OPENAI_MODEL`. Apenas classificação de intenção. Ver [`CHATBOT.md`](CHATBOT.md).
- **Armazenamento (Cloudflare R2):** por `STORAGE_PROVIDER`. `local` grava em `LOCAL_STORAGE_PATH` e serve pela API; `r2` usa AWS SDK S3 + presigner contra o endpoint R2.
- **Observabilidade (OpenTelemetry):** iniciada em `main.ts` antes do bootstrap; exporta via OTLP quando `OTEL_EXPORTER_OTLP_ENDPOINT` está definido.

---

## Diagrama textual

```
                          ┌───────────────────────────┐
        Cliente final     │        WhatsApp            │
        (WhatsApp)  ─────▶ │  (Evolution API / mock)   │
                          └────────────┬──────────────┘
                                       │ webhook  POST /api/webhooks/evolution
                                       ▼
┌──────────────┐   REST /api    ┌───────────────────────────────────────────┐
│  apps/web    │ ─────────────▶ │                apps/api (NestJS/Fastify)   │
│  Vue 3 SPA   │ ◀───────────── │                                             │
│  responsivo  │  cookies JWT   │  Guards: AuthGuard + PerfilGuard             │
└──────┬───────┘                │  Módulos: auth, crm, conversas, chatbot...   │
       │                        │                                             │
       │ importa                │   ┌────────────┐   ┌────────────┐            │
       ▼                        │   │  Chatbot   │──▶│    IA      │ rules/openai│
┌──────────────┐                │   │ (máq.est.) │   └────────────┘            │
│ @arcco/      │  também         │   └─────┬──────┘   ┌────────────┐            │
│ contratos    │  importado ────┼─────────┘          │  Arquivos  │ local/R2   │
│ (Zod/tipos)  │  pela API      │                     └────────────┘            │
└──────────────┘                │            Prisma ORM                        │
                                └───────────────────┬─────────────────────────┘
                                                    │
                                                    ▼
                                         ┌────────────────────┐
                                         │  SQLite local       │
                                         │  arcco.db           │
                                         └────────────────────┘

                          OpenTelemetry  ──▶  coletor OTLP (opcional)
```

Fluxo resumido: o cliente fala pelo WhatsApp → webhook chega na API → chatbot faz a triagem e cria oportunidades → ações geram eventos e atualizam o processo → tudo é persistido no SQLite local, isolado por `empresaId`.

Para o modelo de dados detalhado, veja [`BANCO_DE_DADOS.md`](BANCO_DE_DADOS.md).
