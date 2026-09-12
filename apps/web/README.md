# @arcco/web

Frontend do MVP da **ARCCO** — inteligência comercial para empresas que atendem obras.

Stack: **Vue 3 + Vite + TypeScript (strict)**, Tailwind CSS, Pinia, Vue Router,
TanStack Query, radix-vue (primitivos estilo shadcn) e vue-echarts.
Interface em Português (Brasil), com identidade visual de sidebar escura e área
principal clara e quente.

## Requisitos

- Node.js 20+
- pnpm 9+
- API da ARCCO rodando (por padrão em `http://localhost:3000`)

## Configuração

```bash
cp .env.example .env
# ajuste VITE_API_URL se necessário
pnpm install
```

Variáveis de ambiente (`.env`):

| Variável        | Descrição                          | Padrão                  |
| --------------- | ---------------------------------- | ----------------------- |
| `VITE_API_URL`  | URL base da API (cookies incluídos)| `http://localhost:3000` |
| `VITE_APP_NAME` | Nome exibido do app                | `ARCCO`                 |

## Scripts

```bash
pnpm dev         # ambiente de desenvolvimento (porta 5173)
pnpm build       # type-check (vue-tsc) + build de produção
pnpm preview     # pré-visualização do build
pnpm typecheck   # apenas verificação de tipos
pnpm test        # testes unitários (vitest)
pnpm test:e2e    # testes end-to-end (playwright)
```

## Arquitetura

```
src/
  components/
    ui/            # primitivos estilo shadcn (Button, Input, Dialog, ...)
    layout/        # BarraLateral, CabecalhoPagina
    marca/         # MarcaArcco (SVG dos dois arcos)
    formularios/   # seletores e campos personalizados
    compartilhados/# CartaoMetrica, TabelaDados, EstadoVazio, ...
  composables/     # cn, formatadores, rótulos, notificações, visibilidade
  layouts/         # AppShell (casca autenticada)
  modules/         # telas por domínio (dashboard, pipeline, conversas, ...)
  router/          # rotas + guardas baseadas no store de autenticação
  services/        # cliente HTTP (fetch + credentials) e serviços por domínio
  stores/          # Pinia — apenas sessão e estado da interface
  styles/          # tokens.css (variáveis da marca) + main.css
  types/           # tipos de domínio e de API
```

### Princípios

- **Pinia** guarda apenas sessão de autenticação e estado de UI (sidebar). Nunca
  dados do servidor.
- **TanStack Query** cuida de todo dado remoto (cache, polling, revalidação).
- **HTTP** via `fetch` com `credentials: 'include'` (cookies de sessão) e tratamento
  padronizado de erros no formato `{ codigo, mensagem, detalhes }`.
- **Conversas** fazem polling adaptativo (lista 5s, mensagens/contexto 3s), pausado
  quando a aba está oculta (`document.visibilityState`).

## Identidade visual

Os tokens da marca ficam em [`src/styles/tokens.css`](src/styles/tokens.css) e são
mapeados no Tailwind. O símbolo (dois arcos) vive em
[`src/components/marca/MarcaArcco.vue`](src/components/marca/MarcaArcco.vue) e em
`public/marca/`. Veja `public/marca/.gitkeep` para instruções de substituição do logo.
