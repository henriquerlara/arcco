<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';
import { aplicarMascara, type TipoMascara } from '@/composables/formatadores';

const props = defineProps<{
  modelValue?: string | number | null;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  invalido?: boolean;
  class?: string;
  id?: string;
  autocomplete?: string;
  mascara?: TipoMascara;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', valor: string): void;
}>();

const classes = computed(() =>
  cn(
    'flex h-10 w-full rounded-md border bg-branco px-3 py-2 text-sm text-texto transition-[border-color,background-color] placeholder:text-texto-secundario/60 focus-visible:border-carvao focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carvao/10 disabled:cursor-not-allowed disabled:bg-marfim/60 disabled:opacity-60',
    props.invalido ? 'border-erro focus-visible:ring-erro/40' : 'border-borda',
    props.class,
  ),
);

const exibido = computed(() => {
  const bruto = props.modelValue ?? '';
  return props.mascara ? aplicarMascara(props.mascara, bruto) : bruto;
});

const modo = computed(() => {
  if (props.mascara === 'uf') return 'text';
  if (props.mascara === 'moeda') return 'decimal';
  if (props.mascara) return 'numeric';
  return undefined;
});

function aoDigitar(evento: Event) {
  const bruto = (evento.target as HTMLInputElement).value;
  emit('update:modelValue', props.mascara ? aplicarMascara(props.mascara, bruto) : bruto);
}
</script>

<template>
  <input
    :id="id"
    :type="type ?? 'text'"
    :value="exibido"
    :placeholder="placeholder"
    :disabled="disabled"
    :autocomplete="autocomplete"
    :inputmode="modo"
    :aria-invalid="invalido || undefined"
    :class="classes"
    @input="aoDigitar"
  />
</template>
