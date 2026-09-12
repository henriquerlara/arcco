<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = defineProps<{
  class?: string;
  interativo?: boolean;
}>();

const classes = computed(() =>
  cn(
    'superficie-arquitetonica rounded-md text-card-foreground',
    props.interativo && 'superficie-interativa',
    props.class,
  ),
);
</script>

<template>
  <div :class="classes"><slot /></div>
</template>
