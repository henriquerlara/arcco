# ARCCO — Design System

Identidade visual e sistema de componentes do frontend (`apps/web`). A base é **Tailwind CSS** com **tokens de marca** em CSS custom properties, sobre componentes no estilo shadcn-vue/radix-vue.

Fontes de verdade:

- `apps/web/src/styles/tokens.css` — tokens (cores, raio, sombra) como variáveis CSS.
- `apps/web/tailwind.config.ts` — mapeia os tokens para classes Tailwind e define fontes/sombras/animações.
- `apps/web/src/components/ui/` — componentes base reutilizáveis.
- `apps/web/src/components/marca/` — marca (logo/símbolo).

---

## Conceito

Estética sóbria e "premium" para o setor de construção/arquitetura: **neutros escuros** (preto/carvão), **claros quentes** (marfim) e um **dourado** de marca como acento. Tom elegante, com serifada para a marca e sans-serif para a interface.

---

## Paleta (tokens)

Definida em `tokens.css` (`:root`, `color-scheme: light`):

| Token CSS | Valor | Classe Tailwind | Uso |
| --- | --- | --- | --- |
| `--arcco-preto` | `#0a0a09` | `preto` | Fundos muito escuros, texto sobre dourado |
| `--arcco-carvao` | `#151513` | `carvao` | Superfícies escuras (sidebar, molduras) |
| `--arcco-carvao-claro` | `#22211e` | `carvao-claro` | Variação de carvão |
| `--arcco-dourado` | `#c7a454` | `dourado` | Cor primária / acento da marca |
| `--arcco-dourado-hover` | `#ae8c3e` | `dourado-hover` | Hover do dourado |
| `--arcco-dourado-claro` | `#e4cc8b` | `dourado-claro` | Realce claro do dourado |
| `--arcco-marfim` | `#f4f1e9` | `marfim` | Superfícies claras secundárias |
| `--arcco-superficie` | `#fbfaf7` | `superficie` | Fundo padrão da aplicação |
| `--arcco-branco` | `#ffffff` | `branco` | Cartões, popovers |
| `--arcco-texto` | `#1a1917` | `texto` | Texto principal |
| `--arcco-texto-secundario` | `#6f6a61` | `texto-secundario` | Texto secundário/legendas |
| `--arcco-borda` | `#ddd8ce` | `borda` | Bordas e divisores |
| `--arcco-sucesso` | `#3f8463` | `sucesso` | Estados positivos |
| `--arcco-alerta` | `#b9822f` | `alerta` | Avisos |
| `--arcco-erro` | `#b65353` | `erro` | Erros/destrutivo |
| `--arcco-info` | `#4c7187` | `info` | Informativo |

### Aliases semânticos (shadcn-vue)

O `tailwind.config.ts` também expõe aliases mapeados para os tokens ARCCO, usados pelos componentes base: `background`, `foreground`, `border`, `input`, `ring` (= dourado), `primary` (dourado / foreground preto), `secondary` (marfim), `muted`, `accent`, `destructive` (erro), `popover` e `card` (branco).

---

## Tipografia

Definida em `tailwind.config.ts` (`fontFamily`) e carregada via `@fontsource`:

| Família | Fonte | Uso |
| --- | --- | --- |
| `font-sans` | **Manrope** (fallback system-ui) | Interface geral (padrão) |
| `font-serif` | **Cormorant Garamond** (fallback Georgia) | Marca e títulos de destaque |

A marca usa uma classe utilitária `fonte-marca` (serifada), com `tracking` amplo para o wordmark "ARCCO". Textos auxiliares da marca usam sans em caixa alta com `tracking` largo.

---

## Tokens de forma e elevação

- **Raio (`borderRadius`):** `sm` 8px, `md` 10px, `lg` 12px (token base `--arcco-raio` 10px).
- **Sombras (`boxShadow`):**
  - `shadow-suave` — elevação sutil.
  - `shadow-cartao` — cartões (também em `--arcco-sombra-cartao`).
  - `shadow-flutuante` — elementos flutuantes (menus, diálogos).
- **Animações:** `fade-in`, `accordion-down`, `accordion-up`.
- **Container:** centralizado, padding `1.5rem`, breakpoint `2xl` em `1400px`.

---

## Componentes

### Base — `components/ui/`

Componentes reutilizáveis (estilo shadcn-vue, com `class-variance-authority` e utilitário `cn`):

`Button`, `Input`, `Textarea`, `Label`, `Select`, `Checkbox`, `Switch`, `Badge`, `Tabs`, `Dialog` e a família de `Card` (`Card`, `CardHeader`, `CardTitle`, `CardContent`).

### Compartilhados — `components/compartilhados/`

Blocos de UI de produto: `TabelaDados`, `Paginacao`, `BadgeStatus`, `CartaoMetrica`, `EstadoVazio`, `EstadoErro`, `Skeleton`, `ModalConfirmacao`, `SeletorPeriodo`.

### Formulários — `components/formularios/`

`CampoPersonalizado` e `FormularioCamposPersonalizados` (renderizam campos dinâmicos por tipo) e seletores: `SeletorContato`, `SeletorCategoria`, `SeletorUsuario`.

### Layout — `components/layout/` e `layouts/`

`BarraLateral` (navegação), `CabecalhoPagina` e o shell `AppShell.vue`. A moldura de autenticação fica em `modules/autenticacao/MolduraAuth.vue`.

### Marca — `components/marca/`

- `MarcaArcco.vue` — logo (símbolo SVG "dois arcos" + wordmark), com props `tema` (`claro`/`escuro`), `tamanho` (`sm/md/lg/xl`), `subtitulo` e `somenteSimbolo`.

---

## Utilitários

- **`cn`** (`composables/cn.ts`) — combina classes com `clsx` + `tailwind-merge`.
- **Formatadores** (`composables/formatadores.ts`) — moeda, datas, telefone, etc.
- **Rótulos** (`composables/rotulos.ts`) — tradução de enums para exibição (perfis, status, segmentos, tipos).
- **Ícones** — `lucide-vue-next`.
- **Toasts** — `vue-sonner` via `composables/useNotificacao.ts`.

---

## Regras visuais

- **Use tokens, não valores fixos.** Sempre prefira as classes de token (`bg-superficie`, `text-texto-secundario`, `border-borda`, `text-dourado`) em vez de cores hardcoded, para manter consistência e permitir ajuste central.
- **Dourado é acento, não fundo.** O dourado (`primary`) destaca ações e a marca; evite grandes áreas preenchidas de dourado.
- **Superfícies:** fundo da app em `superficie`; cartões/painéis em `branco` com `shadow-cartao`; áreas escuras (sidebar/auth) em `carvao`/`preto` com texto `marfim`.
- **Hierarquia tipográfica:** interface em Manrope; reserve a serifada (Cormorant/`fonte-marca`) para a marca e títulos especiais.
- **Estados semânticos:** use `sucesso`/`alerta`/`erro`/`info` de forma consistente (ex.: `BadgeStatus`).
- **Espaçamento e raio:** siga a escala de `borderRadius` e o container padrão; componha componentes base em vez de recriar estilos.
- **Acessibilidade:** o símbolo da marca inclui `role="img"`/`aria-label`; mantenha rótulos e contraste ao criar novos componentes.

---

## Substituindo a marca

Para trocar logo/cores mantendo o sistema coeso:

1. **Símbolo/wordmark:** edite `apps/web/src/components/marca/MarcaArcco.vue` (paths do SVG e/ou wordmark). Ajuste `dimensoes` se mudar as proporções.
2. **Assets estáticos:** substitua os arquivos em `apps/web/public/marca/` (ex.: `arcco-simbolo.svg`, favicon). São servidos a partir da raiz (`/marca/...`).
3. **Cores:** altere os tokens em `apps/web/src/styles/tokens.css`. Como o Tailwind referencia as variáveis, a mudança propaga para toda a interface sem editar componentes.

Ver também a seção de marca no [README](../README.md#substituição-da-logomarca).
