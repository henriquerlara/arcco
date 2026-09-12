<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = withDefaults(
  defineProps<{
    /** claro: versão monocromática para fundos escuros · escuro: cores oficiais */
    tema?: 'claro' | 'escuro';
    tamanho?: 'sm' | 'md' | 'lg' | 'xl';
    subtitulo?: string;
    somenteSimbolo?: boolean;
    class?: string;
  }>(),
  { tema: 'escuro', tamanho: 'md' },
);

const tamanhos = {
  sm: { completa: 'h-8 w-20', simbolo: 'h-5 w-12', subtitulo: 'text-[7px]' },
  md: { completa: 'h-12 w-32', simbolo: 'h-7 w-16', subtitulo: 'text-[8px]' },
  lg: { completa: 'h-16 w-40', simbolo: 'h-9 w-20', subtitulo: 'text-[9px]' },
  xl: { completa: 'h-20 w-52', simbolo: 'h-12 w-28', subtitulo: 'text-[10px]' },
} as const;

const tamanhoAtual = computed(() => tamanhos[props.tamanho]);
const fonte = computed(() =>
  props.somenteSimbolo ? '/marca/logo.png' : '/marca/logoCompleta.png',
);
</script>

<template>
  <div :class="cn('inline-flex min-w-0 flex-col items-center', props.class)">
    <img
      :src="fonte"
      :alt="somenteSimbolo ? 'Símbolo ARCCO' : 'ARCCO — Inteligência Comercial'"
      :class="[
        'block shrink-0 object-contain object-center',
        somenteSimbolo ? tamanhoAtual.simbolo : tamanhoAtual.completa,
        tema === 'claro' && 'brightness-0 invert',
      ]"
    />
    <span
      v-if="subtitulo && somenteSimbolo"
      :class="[
        'mt-1 whitespace-nowrap font-semibold uppercase tracking-[0.22em]',
        tamanhoAtual.subtitulo,
        tema === 'claro' ? 'text-marfim/65' : 'text-texto-secundario',
      ]"
    >
      {{ subtitulo }}
    </span>
  </div>
</template>
