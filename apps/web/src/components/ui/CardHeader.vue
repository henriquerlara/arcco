<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = defineProps<{ class?: string }>();
const classes = computed(() => cn('flex flex-col gap-1 p-5 pb-3', props.class));
</script>

<template>
  <div :class="classes"><slot /></div>
</template>
