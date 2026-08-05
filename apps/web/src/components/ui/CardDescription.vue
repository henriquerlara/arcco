<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = defineProps<{ class?: string }>();
const classes = computed(() => cn('text-sm text-texto-secundario', props.class));
</script>

<template>
  <p :class="classes"><slot /></p>
</template>
