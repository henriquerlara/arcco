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
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
} from 'radix-vue';
import { Check, ChevronsUpDown, Search } from 'lucide-vue-next';
import { servicoObras } from '@/services';

const props = defineProps<{
  modelValue?: string | null;
  placeholder?: string;
  invalido?: boolean;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', valor: string | null): void }>();

const busca = ref('');
const buscaDebounced = refDebounced(busca, 300);
const rotuloSelecionado = ref('');

const { data, isFetching } = useQuery({
  queryKey: computed(() => ['obras', 'seletor', buscaDebounced.value]),
  queryFn: () => servicoObras.listar({ busca: buscaDebounced.value || undefined, porPagina: 20 }),
  staleTime: 30_000,
});

const opcoes = computed(() => data.value?.dados ?? []);

const selecionado = computed({
  get: () => props.modelValue ?? '',
  set: (v: string) => {
    emit('update:modelValue', v || null);
    const o = opcoes.value.find((x) => x.id === v);
    if (o) rotuloSelecionado.value = o.nome;
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
  <ComboboxRoot v-model="selecionado" v-model:search-term="busca">
    <ComboboxAnchor
      class="flex h-10 w-full items-center justify-between rounded-md border bg-branco px-3 text-sm shadow-suave focus-within:ring-2 focus-within:ring-ring"
      :class="invalido ? 'border-erro' : 'border-borda'"
    >
      <span v-if="rotuloSelecionado" class="truncate text-texto">{{ rotuloSelecionado }}</span>
      <span v-else class="truncate text-texto-secundario/70">
        {{ placeholder ?? 'Buscar obra…' }}
      </span>
      <ComboboxTrigger>
        <ChevronsUpDown class="size-4 text-texto-secundario" />
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        :side-offset="4"
        class="z-50 max-h-72 w-[--radix-popper-anchor-width] overflow-hidden rounded-md border border-borda bg-branco shadow-flutuante animate-fade-in"
      >
        <div class="flex items-center gap-2 border-b border-borda px-3">
          <Search class="size-4 text-texto-secundario" />
          <ComboboxInput
            class="h-10 w-full bg-transparent text-sm outline-none placeholder:text-texto-secundario/70"
            placeholder="Digite o nome da obra"
          />
        </div>
        <ComboboxViewport class="p-1">
          <ComboboxEmpty class="px-3 py-6 text-center text-sm text-texto-secundario">
            {{ isFetching ? 'Buscando…' : 'Nenhuma obra encontrada.' }}
          </ComboboxEmpty>
          <ComboboxItem
            v-for="obra in opcoes"
            :key="obra.id"
            :value="obra.id"
            class="flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm text-texto outline-none data-[highlighted]:bg-marfim"
          >
            <span class="flex flex-col">
              <span class="font-medium">{{ obra.nome }}</span>
              <span class="text-xs text-texto-secundario">
                {{ [obra.cidade, obra.estado].filter(Boolean).join(' · ') || 'Sem localização' }}
              </span>
            </span>
            <Check v-if="selecionado === obra.id" class="size-4 text-dourado-hover" />
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
