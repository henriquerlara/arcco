<script lang="ts">
import { cva, type VariantProps } from 'class-variance-authority';

export const botaoVariantes = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-superficie disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variante: {
        primario:
          'bg-dourado text-preto hover:bg-dourado-hover shadow-suave font-semibold',
        secundario:
          'bg-branco text-texto border border-borda hover:bg-marfim shadow-suave',
        contorno: 'border border-borda bg-transparent text-texto hover:bg-marfim',
        fantasma: 'bg-transparent text-texto hover:bg-marfim',
        perigo: 'bg-erro text-branco hover:brightness-95 shadow-suave',
        link: 'text-dourado-hover underline-offset-4 hover:underline',
        escuro: 'bg-carvao-claro text-marfim hover:bg-carvao border border-white/5',
      },
      tamanho: {
        sm: 'h-8 px-3 text-xs rounded-sm',
        md: 'h-10 px-4',
        lg: 'h-11 px-6 text-base',
        icone: 'h-10 w-10',
        'icone-sm': 'h-8 w-8 rounded-sm',
      },
    },
    defaultVariants: {
      variante: 'primario',
      tamanho: 'md',
    },
  },
);

export type BotaoVariantes = VariantProps<typeof botaoVariantes>;
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = withDefaults(
  defineProps<{
    variante?: BotaoVariantes['variante'];
    tamanho?: BotaoVariantes['tamanho'];
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    carregando?: boolean;
    as?: string;
    class?: string;
  }>(),
  {
    variante: 'primario',
    tamanho: 'md',
    type: 'button',
    disabled: false,
    carregando: false,
    as: 'button',
  },
);

const classes = computed(() =>
  cn(botaoVariantes({ variante: props.variante, tamanho: props.tamanho }), props.class),
);
</script>

<template>
  <component
    :is="as"
    :class="classes"
    :type="as === 'button' ? type : undefined"
    :disabled="as === 'button' ? disabled || carregando : undefined"
    :aria-busy="carregando || undefined"
  >
    <svg
      v-if="carregando"
      class="size-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path
        class="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
      />
    </svg>
    <slot />
  </component>
</template>
