<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = defineProps<{ class?: string }>();
const classes = computed(() => cn('animate-pulse rounded-md bg-marfim', props.class));
</script>

<template>
  <div :class="classes" />
</template>
