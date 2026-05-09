# ARCCO · Landing Page

Landing page institucional da **ARCCO — Inteligência Comercial para Construção Civil**, construída com **Vue 3 + Vite + TailwindCSS**.

## Stack

- [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`)
- [Vite 6](https://vitejs.dev/)
- [TailwindCSS 3](https://tailwindcss.com/)
- [lucide-vue-next](https://lucide.dev/) (ícones)

## Pré-requisitos

- Node.js **18+** (recomendado 20.x)
- npm 10+

## Como rodar

```bash
npm install
npm run dev
```

A aplicação ficará disponível em `http://localhost:5173`.

### Build de produção

```bash
npm run build
npm run preview
```

Os arquivos otimizados são gerados em `dist/`.

## Estrutura do projeto

```
arcco/
├── index.html              # HTML root + import de fontes
├── public/
│   └── favicon.png         # Ícone das abas (cópia do logo)
├── package.json
├── vite.config.js          # Alias @ → src/
├── tailwind.config.js      # Tema (font families e spacing custom)
├── postcss.config.js
├── jsconfig.json           # Suporte a alias @ no editor
└── src/
    ├── main.js             # Bootstrap da aplicação Vue
    ├── style.css           # Diretivas Tailwind, scroll-reveal e animações globais
    ├── App.vue             # Landing page completa (single-file component)
    ├── assets/
    │   └── logo.png        # Logo oficial da ARCCO
    ├── components/
    │   └── ArccoMark.vue   # Componente do logo (com modo decorativo)
    └── composables/
        └── useScrollReveal.js  # Animações ao scroll via IntersectionObserver
```

## Personalização

### Logo

A logo oficial fica em `src/assets/logo.png`. Para trocá-la:

1. Substitua o arquivo `src/assets/logo.png` pela nova versão (mesmo nome).
2. Atualize também `public/favicon.png` se quiser mudar o ícone das abas.

### Link do WhatsApp

No `src/App.vue`, ajuste a constante `whatsappLink` para o número da empresa (formato internacional, sem `+`):

```js
const whatsappLink = 'https://wa.me/55SEUNUMEROAQUI'
```

### Cores e tipografia

A paleta dourada da ARCCO é aplicada via classes arbitrárias do Tailwind (`[#d7b35f]`, `[#f1d98c]`, etc.) diretamente no `App.vue`. As fontes oficiais (Cormorant Garamond e Inter) são carregadas em `index.html` e configuradas em `tailwind.config.js`.

## Scripts disponíveis

| Comando           | Descrição                                |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Sobe o servidor de desenvolvimento Vite. |
| `npm run build`   | Gera o build de produção em `dist/`.     |
| `npm run preview` | Pré-visualiza o build de produção local. |
