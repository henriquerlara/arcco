<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = defineProps<{ class?: string }>();
const classes = computed(() => cn('flex items-center gap-2 p-5 pt-0', props.class));
</script>

<template>
  <div :class="classes"><slot /></div>
</template>
