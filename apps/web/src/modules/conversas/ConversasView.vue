<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Filter, PanelRightClose, PanelRightOpen } from 'lucide-vue-next';
import { StatusConversa, ModoAtendimento } from '@arcco/contratos';
import Select from '@/components/ui/Select.vue';
import ListaConversas from './ListaConversas.vue';
import PainelConversa from './PainelConversa.vue';
import ContextoComercialConversa from './ContextoComercialConversa.vue';
import { servicoConversas } from '@/services';
import { useVisibilidade } from '@/composables/useVisibilidade';
import { useNotificacao } from '@/composables/useNotificacao';
import {
  ROTULO_STATUS_CONVERSA,
  ROTULO_MODO_ATENDIMENTO,
  opcoesDe,
} from '@/composables/rotulos';

const queryClient = useQueryClient();
const { notificarErro } = useNotificacao();
const { visivel } = useVisibilidade();

const statusFiltro = ref('');
const modoFiltro = ref('');
const selecionadaId = ref<string | null>(null);
const enviando = ref(false);
const contextoVisivel = ref(true);

const opcoesStatus = [{ valor: '', rotulo: 'Todos os status' }, ...opcoesDe(ROTULO_STATUS_CONVERSA)];
const opcoesModo = [{ valor: '', rotulo: 'Todos os modos' }, ...opcoesDe(ROTULO_MODO_ATENDIMENTO)];

const filtros = computed(() => ({
  status: statusFiltro.value || undefined,
  modo: modoFiltro.value || undefined,
  porPagina: 50,
}));

// Lista de conversas — polling 5s (pausado quando aba oculta)
const listaQuery = useQuery({
  queryKey: computed(() => ['conversas', filtros.value]),
  queryFn: () => servicoConversas.listar(filtros.value),
  refetchInterval: () => (visivel.value ? 5000 : false),
});
const conversas = computed(() => listaQuery.data.value?.dados ?? []);

const conversaSelecionada = computed(
  () => conversas.value.find((c) => c.id === selecionadaId.value) ?? null,
);

// Mensagens — polling 3s
const mensagensQuery = useQuery({
  queryKey: computed(() => ['conversa-mensagens', selecionadaId.value]),
  queryFn: () => servicoConversas.mensagens(selecionadaId.value as string),
  enabled: computed(() => !!selecionadaId.value),
  refetchInterval: () => (visivel.value && selecionadaId.value ? 3000 : false),
});

// Contexto comercial — polling 3s
const contextoQuery = useQuery({
  queryKey: computed(() => ['conversa-contexto', selecionadaId.value]),
  queryFn: () => servicoConversas.contexto(selecionadaId.value as string),
  enabled: computed(() => !!selecionadaId.value),
  refetchInterval: () => (visivel.value && selecionadaId.value ? 3000 : false),
});

function selecionar(id: string) {
  selecionadaId.value = id;
}

async function invalidar() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['conversas'] }),
    queryClient.invalidateQueries({ queryKey: ['conversa-mensagens', selecionadaId.value] }),
    queryClient.invalidateQueries({ queryKey: ['conversa-contexto', selecionadaId.value] }),
  ]);
}

async function enviar(texto: string) {
  if (!selecionadaId.value) return;
  enviando.value = true;
  try {
    await servicoConversas.enviar(selecionadaId.value, texto);
    await mensagensQuery.refetch();
    await listaQuery.refetch();
  } catch (e) {
    notificarErro(e, 'Não foi possível enviar a mensagem.');
  } finally {
    enviando.value = false;
  }
}

async function assumir() {
  if (!selecionadaId.value) return;
  try {
    await servicoConversas.assumir(selecionadaId.value);
    await invalidar();
  } catch (e) {
    notificarErro(e);
  }
}

async function devolverAoBot() {
  if (!selecionadaId.value) return;
  try {
    await servicoConversas.devolverAoBot(selecionadaId.value);
    await invalidar();
  } catch (e) {
    notificarErro(e);
  }
}

async function finalizar() {
  if (!selecionadaId.value) return;
  try {
    await servicoConversas.finalizar(selecionadaId.value);
    await invalidar();
  } catch (e) {
    notificarErro(e);
  }
}

void StatusConversa;
void ModoAtendimento;
</script>

<template>
  <div class="relative flex h-full">
    <!-- Painel 1: filtros + lista -->
    <div class="flex w-80 shrink-0 flex-col border-r border-borda bg-branco">
      <header class="border-b border-borda p-3">
        <h2 class="mb-2 flex items-center gap-2 text-sm font-semibold text-texto">
          <Filter class="size-4 text-dourado-hover" /> Conversas
        </h2>
        <div class="space-y-2">
          <Select v-model="statusFiltro" :opcoes="opcoesStatus" />
          <Select v-model="modoFiltro" :opcoes="opcoesModo" />
        </div>
      </header>
      <ListaConversas
        :conversas="conversas"
        :selecionada-id="selecionadaId"
        :carregando="listaQuery.isLoading.value"
        @selecionar="selecionar"
      />
    </div>

    <!-- Painel 2: mensagens -->
    <div class="min-w-0 flex-1">
      <PainelConversa
        :conversa="conversaSelecionada"
        :mensagens="mensagensQuery.data.value ?? []"
        :carregando="mensagensQuery.isLoading.value"
        :enviando="enviando"
        @enviar="enviar"
        @assumir="assumir"
        @devolver-bot="devolverAoBot"
        @finalizar="finalizar"
      />
    </div>

    <!-- Painel 3: contexto comercial -->
    <div
      v-if="selecionadaId && contextoVisivel"
      class="w-80 shrink-0 border-l border-borda"
    >
      <ContextoComercialConversa
        :contexto="contextoQuery.data.value ?? null"
        :carregando="contextoQuery.isLoading.value"
      />
    </div>

    <!-- Alternar contexto -->
    <button
      v-if="selecionadaId"
      type="button"
      class="absolute right-4 top-3 z-10 rounded-md border border-borda bg-branco p-2 text-texto-secundario shadow-suave hover:bg-marfim md:right-6"
      :title="contextoVisivel ? 'Ocultar contexto' : 'Mostrar contexto'"
      @click="contextoVisivel = !contextoVisivel"
    >
      <PanelRightClose v-if="contextoVisivel" class="size-4" />
      <PanelRightOpen v-else class="size-4" />
    </button>
  </div>
</template>
