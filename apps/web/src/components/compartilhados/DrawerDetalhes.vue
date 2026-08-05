<script setup lang="ts">
import { computed } from 'vue';
import Sheet from '@/components/ui/Sheet.vue';

const props = defineProps<{
  modelValue: boolean;
  titulo?: string;
  descricao?: string;
  largura?: string;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', valor: boolean): void }>();

const aberto = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});
</script>

<template>
  <Sheet
    v-model="aberto"
    :titulo="titulo"
    :descricao="descricao"
    :largura="largura ?? 'max-w-lg'"
  >
    <template v-if="$slots.cabecalho" #cabecalho>
      <slot name="cabecalho" />
    </template>
    <slot />
    <template v-if="$slots.rodape" #rodape>
      <slot name="rodape" />
    </template>
  </Sheet>
</template>
