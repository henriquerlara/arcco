<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { servicoProdutos } from '@/services';
import type { Produto } from '@/types';

const props = defineProps<{
  modelValue?: string | null;
  placeholder?: string;
  /** Destaca o produto sugerido pelo XML. */
  sugeridoId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', valor: string | null): void;
  (e: 'selecionado', produto: Produto | null): void;
}>();

const filtro = ref('');

const { data, isLoading } = useQuery({
  queryKey: ['produtos', 'seletor-nfe'],
  queryFn: () => servicoProdutos.listar(true),
  staleTime: 30_000,
});

const opcoes = computed(() => {
  const lista = data.value ?? [];
  const termo = filtro.value.trim().toLocaleLowerCase('pt-BR');
  if (!termo) return lista;
  return lista.filter((p) => {
    const campos = [
      p.nome,
      p.descricaoComercial,
      p.nomeFiscal,
      p.sku,
      p.codigoInterno,
      p.codigoFornecedor,
    ];
    return campos.some((c) => (c ?? '').toLocaleLowerCase('pt-BR').includes(termo));
  });
});

const selecionado = computed({
  get: () => props.modelValue ?? '',
  set: (v: string) => {
    const id = v || null;
    emit('update:modelValue', id);
    const p = (data.value ?? []).find((o) => o.id === id) ?? null;
    emit('selecionado', p);
  },
});

watch(
  () => props.modelValue,
  (v) => {
    if (!v) emit('selecionado', null);
  },
);
</script>

<template>
  <div class="space-y-1.5">
    <input
      v-model="filtro"
      type="search"
      class="h-9 w-full rounded-md border border-borda bg-fundo px-3 text-sm"
      :placeholder="placeholder ?? 'Filtrar por nome, SKU ou código'"
    />
    <select
      v-model="selecionado"
      class="h-10 w-full rounded-md border border-borda bg-fundo px-3 text-sm"
      :disabled="isLoading"
    >
      <option value="">{{ isLoading ? 'Carregando…' : 'Selecione o produto' }}</option>
      <option v-for="p in opcoes" :key="p.id" :value="p.id">
        {{ p.nome }}{{ p.sku ? ` · ${p.sku}` : '' }}{{ p.codigoFornecedor ? ` · forn. ${p.codigoFornecedor}` : ''
        }}{{ sugeridoId === p.id ? ' (sugerido)' : '' }}
      </option>
    </select>
  </div>
</template>
