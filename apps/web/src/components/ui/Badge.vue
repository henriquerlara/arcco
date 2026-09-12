<script lang="ts">
import { cva, type VariantProps } from 'class-variance-authority';

export const badgeVariantes = cva(
  'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors whitespace-nowrap',
  {
    variants: {
      variante: {
        neutro: 'border-borda bg-marfim text-texto-secundario',
        dourado: 'border-dourado/30 bg-dourado/12 text-[#8a6d24]',
        sucesso: 'border-sucesso/25 bg-sucesso/12 text-sucesso',
        alerta: 'border-alerta/25 bg-alerta/12 text-alerta',
        erro: 'border-erro/25 bg-erro/12 text-erro',
        info: 'border-info/25 bg-info/12 text-info',
        contorno: 'border-borda bg-transparent text-texto-secundario',
      },
    },
    defaultVariants: { variante: 'neutro' },
  },
);

export type BadgeVariantes = VariantProps<typeof badgeVariantes>;
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = withDefaults(
  defineProps<{ variante?: BadgeVariantes['variante']; class?: string }>(),
  { variante: 'neutro' },
);

const classes = computed(() => cn(badgeVariantes({ variante: props.variante }), props.class));
</script>

<template>
  <span :class="classes"><slot /></span>
</template>
