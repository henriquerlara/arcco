<script setup lang="ts">
import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import Select from '@/components/ui/Select.vue';
import { servicoEquipe } from '@/services';

const props = defineProps<{
  modelValue?: string | null;
  placeholder?: string;
  incluirVazio?: boolean;
  rotuloVazio?: string;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', valor: string | null): void }>();

const { data } = useQuery({
  queryKey: ['equipe'],
  queryFn: () => servicoEquipe.listar(),
  staleTime: 60_000,
});

const opcoes = computed(() => {
  const lista = (data.value ?? []).map((u) => ({ valor: u.id, rotulo: u.nome }));
  if (props.incluirVazio) {
    return [{ valor: '', rotulo: props.rotuloVazio ?? 'Todos' }, ...lista];
  }
  return lista;
});

const valor = computed({
  get: () => props.modelValue ?? '',
  set: (v: string) => emit('update:modelValue', v === '' ? null : v),
});
</script>

<template>
  <Select
    v-model="valor"
    :opcoes="opcoes"
    :placeholder="placeholder ?? 'Selecione um responsável'"
  />
</template>
