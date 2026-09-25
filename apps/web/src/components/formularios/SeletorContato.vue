<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { refDebounced } from '@vueuse/core';
import { useQuery } from '@tanstack/vue-query';
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
} from 'radix-vue';
import { Check, ChevronsUpDown, Search } from 'lucide-vue-next';
import { servicoContatos } from '@/services';
import { formatarTelefone } from '@/composables/formatadores';

const props = defineProps<{
  modelValue?: string | null;
  placeholder?: string;
  invalido?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', valor: string | null): void;
  (e: 'selecionado', contato: { id: string; nome: string }): void;
}>();

const busca = ref('');
const buscaDebounced = refDebounced(busca, 300);
const rotuloSelecionado = ref<string>('');

const { data, isFetching } = useQuery({
  queryKey: computed(() => ['contatos', 'seletor', buscaDebounced.value]),
  queryFn: () =>
    servicoContatos.listar({ busca: buscaDebounced.value || undefined, porPagina: 20 }),
  staleTime: 30_000,
});

function semAcento(valor: string) {
  return valor.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
}

const opcoes = computed(() => {
  const lista = data.value?.dados ?? [];
  const termo = semAcento(busca.value.trim());
  if (!termo) return lista;
  const digitos = termo.replace(/\D+/g, '');
  return lista.filter((contato) => {
    const nome = semAcento(contato.nome);
    const empresa = semAcento(contato.empresaNome ?? '');
    if (nome.includes(termo) || empresa.includes(termo)) return true;
    if (!digitos) return false;
    const telefone = `${contato.telefone ?? ''}`.replace(/\D+/g, '');
    return telefone.includes(digitos);
  });
});

/** A lista já vem filtrada pela API; o filtro do combobox compara o id e escondia todo resultado. */
function manterOpcoes<T>(lista: T): T {
  return lista;
}

const selecionado = computed({
  get: () => props.modelValue ?? '',
  set: (v: string) => {
    emit('update:modelValue', v || null);
    const c = opcoes.value.find((o) => o.id === v);
    if (c) {
      rotuloSelecionado.value = c.nome;
      emit('selecionado', { id: c.id, nome: c.nome });
    }
  },
});

watch(
  () => props.modelValue,
  (v) => {
    if (!v) rotuloSelecionado.value = '';
  },
);
</script>

<template>
  <ComboboxRoot
    v-model="selecionado"
    v-model:search-term="busca"
    :display-value="() => ''"
    :filter-function="manterOpcoes"
  >
    <ComboboxAnchor
      class="flex h-10 w-full rounded-md border bg-branco text-sm focus-within:ring-2 focus-within:ring-ring"
      :class="invalido ? 'border-erro' : 'border-borda'"
    >
      <ComboboxTrigger
        class="flex h-full w-full items-center justify-between gap-2 bg-transparent px-3 text-left outline-none"
      >
        <span v-if="rotuloSelecionado" class="truncate text-texto">{{ rotuloSelecionado }}</span>
        <span v-else class="truncate text-texto-secundario/70">
          {{ placeholder ?? 'Buscar pessoa…' }}
        </span>
        <ChevronsUpDown class="size-4 shrink-0 text-texto-secundario" />
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxContent
      position="popper"
      :side-offset="4"
      class="z-50 max-h-72 w-[--radix-popper-anchor-width] overflow-hidden rounded-md border border-borda bg-branco shadow-flutuante animate-fade-in"
    >
        <div class="flex items-center gap-2 border-b border-borda px-3">
          <Search class="size-4 text-texto-secundario" />
          <ComboboxInput
            class="h-10 w-full bg-transparent text-sm outline-none placeholder:text-texto-secundario/70"
            placeholder="Digite o nome ou telefone"
          />
        </div>
        <ComboboxViewport class="p-1">
          <ComboboxEmpty class="px-3 py-6 text-center text-sm text-texto-secundario">
            {{ isFetching ? 'Buscando…' : 'Nenhuma pessoa encontrada.' }}
          </ComboboxEmpty>
          <ComboboxItem
            v-for="contato in opcoes"
            :key="contato.id"
            :value="contato.id"
            class="flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm text-texto outline-none data-[highlighted]:bg-marfim"
          >
            <span class="flex flex-col">
              <span class="font-medium">{{ contato.nome }}</span>
              <span class="text-xs text-texto-secundario">
                {{ formatarTelefone(contato.telefone) }}
              </span>
            </span>
            <Check v-if="selecionado === contato.id" class="size-4 text-dourado-hover" />
          </ComboboxItem>
        </ComboboxViewport>
    </ComboboxContent>
  </ComboboxRoot>
</template>
