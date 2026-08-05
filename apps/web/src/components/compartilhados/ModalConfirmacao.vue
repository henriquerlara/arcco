<script setup lang="ts">
import { computed } from 'vue';
import Dialog from '@/components/ui/Dialog.vue';
import Button from '@/components/ui/Button.vue';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    titulo: string;
    descricao?: string;
    textoConfirmar?: string;
    textoCancelar?: string;
    perigo?: boolean;
    carregando?: boolean;
  }>(),
  { textoConfirmar: 'Confirmar', textoCancelar: 'Cancelar' },
);

const emit = defineEmits<{
  (e: 'update:modelValue', valor: boolean): void;
  (e: 'confirmar'): void;
}>();

const aberto = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});
</script>

<template>
  <Dialog v-model="aberto" :titulo="titulo" :descricao="descricao" tamanho="sm">
    <slot />
    <template #rodape>
      <Button variante="secundario" :disabled="carregando" @click="aberto = false">
        {{ textoCancelar }}
      </Button>
      <Button
        :variante="perigo ? 'perigo' : 'primario'"
        :carregando="carregando"
        @click="emit('confirmar')"
      >
        {{ textoConfirmar }}
      </Button>
    </template>
  </Dialog>
</template>
