<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/composables/cn';
import { aplicarMascara, maxLengthMascara, type TipoMascara } from '@/composables/formatadores';

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
  maxlength?: number | string;
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
  return props.mascara ? aplicarMascara(props.mascara, bruto) : String(bruto);
});

const modo = computed(() => {
  if (props.mascara === 'uf') return 'text';
  if (props.mascara === 'moeda') return 'decimal';
  if (props.mascara) return 'numeric';
  return undefined;
});

const limite = computed(() => {
  if (props.maxlength != null && props.maxlength !== '') return Number(props.maxlength);
  return props.mascara ? maxLengthMascara(props.mascara) : undefined;
});

function aoDigitar(evento: Event) {
  const el = evento.target as HTMLInputElement;
  const bruto = el.value;
  if (!props.mascara) {
    emit('update:modelValue', bruto);
    return;
  }
  let proximo = aplicarMascara(props.mascara, bruto);
  // Para máscaras sem pontuação (IE/agência/conta), respeita maxlength em dígitos.
  if (props.mascara === 'ie' && limite.value != null) {
    proximo = proximo.slice(0, limite.value);
  }
  emit('update:modelValue', proximo);
  // Se a máscara rejeitou caracteres, o model pode não mudar e o Vue não
  // reescreve o DOM — força o valor filtrado na hora.
  if (el.value !== proximo) {
    el.value = proximo;
  }
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
    :maxlength="limite"
    :aria-invalid="invalido || undefined"
    :class="classes"
    @input="aoDigitar"
  />
</template>
