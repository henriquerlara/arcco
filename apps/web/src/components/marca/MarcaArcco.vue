<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = withDefaults(
  defineProps<{
    /** claro: texto claro sobre fundo escuro · escuro: texto escuro sobre fundo claro */
    tema?: 'claro' | 'escuro';
    tamanho?: 'sm' | 'md' | 'lg' | 'xl';
    subtitulo?: string;
    somenteSimbolo?: boolean;
    class?: string;
  }>(),
  { tema: 'escuro', tamanho: 'md' },
);

const dimensoes = {
  sm: { simbolo: 24, texto: 'text-lg', sub: 'text-[10px]' },
  md: { simbolo: 32, texto: 'text-2xl', sub: 'text-xs' },
  lg: { simbolo: 44, texto: 'text-3xl', sub: 'text-sm' },
  xl: { simbolo: 60, texto: 'text-5xl', sub: 'text-base' },
} as const;

const dim = computed(() => dimensoes[props.tamanho]);
const corTexto = computed(() => (props.tema === 'claro' ? 'text-marfim' : 'text-texto'));
const corSub = computed(() =>
  props.tema === 'claro' ? 'text-dourado-claro/80' : 'text-texto-secundario',
);
</script>

<template>
  <div :class="cn('flex items-center gap-3', props.class)">
    <svg
      :width="dim.simbolo"
      :height="dim.simbolo"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Símbolo ARCCO: dois arcos"
      class="shrink-0"
    >
      <defs>
        <linearGradient id="arcco-ouro" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stop-color="#E4CC8B" />
          <stop offset="0.55" stop-color="#C7A454" />
          <stop offset="1" stop-color="#AE8C3E" />
        </linearGradient>
      </defs>
      <!-- Arco externo -->
      <path
        d="M6 54V33C6 18.64 17.64 7 32 7C46.36 7 58 18.64 58 33V54"
        stroke="url(#arcco-ouro)"
        stroke-width="7"
        stroke-linecap="round"
      />
      <!-- Arco interno -->
      <path
        d="M20 54V34C20 27.37 25.37 22 32 22C38.63 22 44 27.37 44 34V54"
        stroke="url(#arcco-ouro)"
        stroke-width="7"
        stroke-linecap="round"
        stroke-opacity="0.9"
      />
    </svg>

    <div v-if="!somenteSimbolo" class="flex flex-col leading-none">
      <span
        :class="cn('fonte-marca font-semibold tracking-[0.14em]', dim.texto, corTexto)"
      >
        ARCCO
      </span>
      <span
        v-if="subtitulo"
        :class="cn('mt-1 font-sans font-medium uppercase tracking-[0.22em]', dim.sub, corSub)"
      >
        {{ subtitulo }}
      </span>
    </div>
  </div>
</template>
