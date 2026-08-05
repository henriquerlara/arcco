<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';

const props = defineProps<{
  modelValue?: string | number | null;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  invalido?: boolean;
  class?: string;
  id?: string;
  autocomplete?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', valor: string): void;
}>();

const classes = computed(() =>
  cn(
    'flex h-10 w-full rounded-md border bg-branco px-3 py-2 text-sm text-texto shadow-suave transition-colors placeholder:text-texto-secundario/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-dourado disabled:cursor-not-allowed disabled:opacity-60',
    props.invalido ? 'border-erro focus-visible:ring-erro/40' : 'border-borda',
    props.class,
  ),
);

function aoDigitar(evento: Event) {
  emit('update:modelValue', (evento.target as HTMLInputElement).value);
}
</script>

<template>
  <input
    :id="id"
    :type="type ?? 'text'"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    :disabled="disabled"
    :autocomplete="autocomplete"
    :aria-invalid="invalido || undefined"
    :class="classes"
    @input="aoDigitar"
  />
</template>
