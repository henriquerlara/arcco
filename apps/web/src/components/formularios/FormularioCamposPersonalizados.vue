<script setup lang="ts">
import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { EntidadeCampoPersonalizado } from '@arcco/contratos';
import { servicoCamposPersonalizados } from '@/services';
import CampoPersonalizado from './CampoPersonalizado.vue';

const props = defineProps<{
  entidade: EntidadeCampoPersonalizado;
  modelValue: Record<string, unknown>;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', valor: Record<string, unknown>): void;
}>();

const { data, isLoading } = useQuery({
  queryKey: computed(() => ['campos-personalizados', props.entidade]),
  queryFn: () => servicoCamposPersonalizados.listar(props.entidade),
  staleTime: 60_000,
});

const campos = computed(() => (data.value ?? []).filter((c) => c.ativo));

function atualizar(chave: string, valor: unknown) {
  emit('update:modelValue', { ...props.modelValue, [chave]: valor });
}
</script>

<template>
  <div v-if="isLoading" class="text-sm text-texto-secundario">Carregando campos…</div>
  <div v-else-if="campos.length" class="grid gap-4 sm:grid-cols-2">
    <CampoPersonalizado
      v-for="campo in campos"
      :key="campo.id"
      :campo="campo"
      :class="campo.tipo === 'TEXTO_LONGO' ? 'sm:col-span-2' : ''"
      :model-value="modelValue[campo.chave]"
      @update:model-value="(v) => atualizar(campo.chave, v)"
    />
  </div>
  <p v-else class="text-sm text-texto-secundario">
    Nenhum campo personalizado configurado para esta entidade.
  </p>
</template>
