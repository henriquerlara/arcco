<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = withDefaults(
  defineProps<{ orientacao?: 'horizontal' | 'vertical'; class?: string }>(),
  { orientacao: 'horizontal' },
);

const classes = computed(() =>
  cn(
    'shrink-0 bg-borda',
    props.orientacao === 'horizontal' ? 'h-px w-full' : 'w-px self-stretch',
    props.class,
  ),
);
</script>

<template>
  <div role="separator" :aria-orientation="orientacao" :class="classes" />
</template>
