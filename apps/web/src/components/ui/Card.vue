<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = defineProps<{
  class?: string;
  interativo?: boolean;
}>();

const classes = computed(() =>
  cn(
    'rounded-lg border border-borda bg-card text-card-foreground shadow-cartao',
    props.interativo && 'transition-shadow hover:shadow-flutuante cursor-pointer',
    props.class,
  ),
);
</script>

<template>
  <div :class="classes"><slot /></div>
</template>
