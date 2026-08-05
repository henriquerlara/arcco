<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = defineProps<{
  for?: string;
  obrigatorio?: boolean;
  class?: string;
}>();

const classes = computed(() =>
  cn('text-sm font-medium text-texto leading-none', props.class),
);
</script>

<template>
  <label :for="props.for" :class="classes">
    <slot />
    <span v-if="obrigatorio" class="ml-0.5 text-erro" aria-hidden="true">*</span>
  </label>
</template>
