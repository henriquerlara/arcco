<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = defineProps<{
  modelValue?: boolean;
  disabled?: boolean;
  id?: string;
  class?: string;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', valor: boolean): void }>();

const trilha = computed(() =>
  cn(
    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
    props.modelValue ? 'bg-dourado' : 'bg-borda',
    props.disabled && 'opacity-50 cursor-not-allowed',
    props.class,
  ),
);

const bolinha = computed(() =>
  cn(
    'inline-block size-4 transform rounded-full bg-branco shadow transition-transform',
    props.modelValue ? 'translate-x-4' : 'translate-x-0.5',
  ),
);
</script>

<template>
  <button
    :id="id"
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    :class="trilha"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span :class="bolinha" />
  </button>
</template>
