<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = defineProps<{ class?: string }>();
const classes = computed(() =>
  cn('text-base font-semibold leading-tight text-texto', props.class),
);
</script>

<template>
  <h3 :class="classes"><slot /></h3>
</template>
