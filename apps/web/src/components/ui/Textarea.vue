<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = defineProps<{
  modelValue?: string | null;
  placeholder?: string;
  disabled?: boolean;
  invalido?: boolean;
  rows?: number;
  class?: string;
  id?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', valor: string): void;
}>();

const classes = computed(() =>
  cn(
    'flex min-h-[80px] w-full rounded-md border bg-branco px-3 py-2 text-sm text-texto transition-[border-color,background-color] placeholder:text-texto-secundario/60 focus-visible:border-carvao focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carvao/10 disabled:cursor-not-allowed disabled:bg-marfim/60 disabled:opacity-60',
    props.invalido ? 'border-erro' : 'border-borda',
    props.class,
  ),
);
</script>

<template>
  <textarea
    :id="id"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    :disabled="disabled"
    :rows="rows ?? 3"
    :class="classes"
    @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
