<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { useRoute, useRouter } from 'vue-router';
import { ChevronLeft, CircleCheck, CircleX, Filter, PanelRightClose, PanelRightOpen } from 'lucide-vue-next';
import { StatusConversa, ModoAtendimento } from '@arcco/contratos';
import Select from '@/components/ui/Select.vue';
import Button from '@/components/ui/Button.vue';
import Dialog from '@/components/ui/Dialog.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import ListaConversas from './ListaConversas.vue';
import PainelConversa from './PainelConversa.vue';
import ContextoComercialConversa from './ContextoComercialConversa.vue';
import { servicoConversas, servicoFunil, servicoOportunidades } from '@/services';
import { useVisibilidade } from '@/composables/useVisibilidade';
import { useNotificacao } from '@/composables/useNotificacao';
import {
  ROTULO_STATUS_CONVERSA,
  ROTULO_MODO_ATENDIMENTO,
  opcoesDe,
} from '@/composables/rotulos';

const ETAPAS_ORCAMENTO = new Set(['QUALIFICACAO', 'NEGOCIACAO']);

const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();
const { visivel } = useVisibilidade();
const rota = useRoute();
const router = useRouter();

const statusFiltro = ref('');
const modoFiltro = ref('');
const selecionadaId = ref<string | null>(
  typeof rota.query.conversa === 'string' ? rota.query.conversa : null,
);
const enviando = ref(false);
const contextoVisivel = ref(true);
const modalDesfechoAberto = ref(false);
const informandoPerda = ref(false);
const motivoPerda = ref('');
const salvandoDesfecho = ref(false);
const desfechoConversaId = ref<string | null>(null);
const desfechoOportunidadeId = ref<string | null>(null);
const desfechoCodigo = ref('');

const funilQuery = useQuery({
  queryKey: ['etapas-funil'],
  queryFn: () => servicoFunil.listar(),
  staleTime: 60_000,
});
const etapaGanha = computed(
  () => (funilQuery.data.value ?? []).find((e) => e.ativo && e.tipo === 'GANHA'),
);
const etapaPerdida = computed(
  () => (funilQuery.data.value ?? []).find((e) => e.ativo && e.tipo === 'PERDIDA'),
);

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

const conversaNaLista = computed(
  () => conversas.value.find((c) => c.id === selecionadaId.value) ?? null,
);

const detalheQuery = useQuery({
  queryKey: computed(() => ['conversa', selecionadaId.value]),
  queryFn: () => servicoConversas.obter(selecionadaId.value as string),
  enabled: computed(() => Boolean(selecionadaId.value) && !conversaNaLista.value),
});

const conversaSelecionada = computed(
  () => conversaNaLista.value ?? detalheQuery.data.value ?? null,
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

watch(
  () => rota.query.conversa,
  (id) => {
    if (typeof id === 'string' && id && id !== selecionadaId.value) {
      selecionadaId.value = id;
    }
  },
);

function selecionar(id: string) {
  selecionadaId.value = id;
  if (rota.query.conversa === id) return;
  void router.replace({ query: { ...rota.query, conversa: id } });
}

async function invalidar() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['conversas'] }),
    queryClient.invalidateQueries({ queryKey: ['conversa-mensagens', selecionadaId.value] }),
    queryClient.invalidateQueries({ queryKey: ['conversa-contexto', selecionadaId.value] }),
    queryClient.invalidateQueries({ queryKey: ['pipeline'] }),
    queryClient.invalidateQueries({ queryKey: ['oportunidade'] }),
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

function ehAtendimentoOrcamento(conversa: {
  modo?: string;
  oportunidadeId?: string | null;
  oportunidade?: { id: string; codigo?: string; etapa?: { chaveSistema?: string | null; tipo?: string } | null } | null;
}): boolean {
  if (conversa.modo !== ModoAtendimento.HUMANO) return false;
  const oportunidade = conversa.oportunidade;
  if (!oportunidade?.id || oportunidade.id !== conversa.oportunidadeId) return false;
  const chave = oportunidade.etapa?.chaveSistema ?? '';
  return ETAPAS_ORCAMENTO.has(chave);
}

function limparDesfecho() {
  modalDesfechoAberto.value = false;
  informandoPerda.value = false;
  motivoPerda.value = '';
  desfechoConversaId.value = null;
  desfechoOportunidadeId.value = null;
  desfechoCodigo.value = '';
}

async function encerrarConversa(conversaId: string) {
  await servicoConversas.finalizar(conversaId);
  await invalidar();
}

async function finalizar() {
  if (!selecionadaId.value || salvandoDesfecho.value) return;
  try {
    const conversa = await servicoConversas.obter(selecionadaId.value);
    if (!ehAtendimentoOrcamento(conversa) || !conversa.oportunidade) {
      await encerrarConversa(conversa.id);
      return;
    }
    desfechoConversaId.value = conversa.id;
    desfechoOportunidadeId.value = conversa.oportunidade.id;
    desfechoCodigo.value = conversa.oportunidade.codigo ?? '';
    informandoPerda.value = false;
    motivoPerda.value = '';
    modalDesfechoAberto.value = true;
  } catch (e) {
    notificarErro(e);
  }
}

async function soEncerrarConversa() {
  const conversaId = desfechoConversaId.value;
  if (!conversaId) return;
  salvandoDesfecho.value = true;
  try {
    await encerrarConversa(conversaId);
    limparDesfecho();
  } catch (e) {
    notificarErro(e);
  } finally {
    salvandoDesfecho.value = false;
  }
}

async function aplicarDesfecho(etapaId: string, motivo?: string) {
  const conversaId = desfechoConversaId.value;
  const oportunidadeId = desfechoOportunidadeId.value;
  if (!conversaId || !oportunidadeId) return;
  salvandoDesfecho.value = true;
  try {
    const conferida = await servicoConversas.obter(conversaId);
    if (conferida.oportunidadeId !== oportunidadeId) {
      notificarErro(new Error('Este chat não está mais ligado a esse negócio.'));
      limparDesfecho();
      return;
    }
    await servicoOportunidades.mover(oportunidadeId, etapaId, motivo);
    await encerrarConversa(conversaId);
    const destino = (funilQuery.data.value ?? []).find((e) => e.id === etapaId);
    sucesso(`Negócio ${desfechoCodigo.value} atualizado para ${destino?.nome ?? 'a nova etapa'}.`);
    limparDesfecho();
  } catch (e) {
    notificarErro(e);
  } finally {
    salvandoDesfecho.value = false;
  }
}

async function confirmarGanho() {
  if (!etapaGanha.value) {
    notificarErro(new Error('Não há etapa ganhadora no funil.'));
    return;
  }
  await aplicarDesfecho(etapaGanha.value.id);
}

function pedirPerda() {
  if (!etapaPerdida.value) {
    notificarErro(new Error('Não há etapa de perdido no funil.'));
    return;
  }
  informandoPerda.value = true;
}

async function confirmarPerda() {
  if (!etapaPerdida.value) return;
  if (!motivoPerda.value.trim()) {
    notificarErro(new Error('Informe o motivo.'));
    return;
  }
  await aplicarDesfecho(etapaPerdida.value.id, motivoPerda.value.trim());
}

void StatusConversa;
void ModoAtendimento;
</script>

<template>
  <div class="relative flex h-full">
    <!-- Painel 1: filtros + lista -->
    <div :class="[selecionadaId ? 'hidden md:flex' : 'flex', 'w-full shrink-0 flex-col border-r border-borda bg-branco md:w-80']">
      <header class="border-b border-borda p-4">
        <p class="rotulo-editorial mb-3 text-dourado-hover">Central de inteligência</p>
        <h2 class="mb-3 flex items-center gap-2 text-lg font-semibold tracking-[-0.03em] text-texto">
          <Filter class="size-4 text-carvao" /> Conversas
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
    <div :class="[selecionadaId ? 'block' : 'hidden md:block', 'relative min-w-0 flex-1']">
      <button
        v-if="selecionadaId"
        type="button"
        class="absolute left-2 top-3 z-20 grid size-9 place-items-center rounded-md border border-borda bg-branco text-carvao transition-colors hover:bg-marfim md:hidden"
        aria-label="Voltar para conversas"
        @click="selecionadaId = null"
      >
        <ChevronLeft class="size-4" />
      </button>
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
      class="hidden w-80 shrink-0 border-l border-borda xl:block"
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
      class="absolute right-4 top-3 z-10 hidden rounded-md border border-borda bg-branco p-2 text-texto-secundario transition-colors hover:bg-marfim hover:text-texto xl:block xl:right-6"
      :title="contextoVisivel ? 'Ocultar contexto' : 'Mostrar contexto'"
      @click="contextoVisivel = !contextoVisivel"
    >
      <PanelRightClose v-if="contextoVisivel" class="size-4" />
      <PanelRightOpen v-else class="size-4" />
    </button>

    <Dialog
      v-model="modalDesfechoAberto"
      titulo="Como ficou a proposta?"
      :descricao="desfechoCodigo ? `Negócio ${desfechoCodigo} — escolha a etapa da linha do tempo.` : 'Escolha a etapa da linha do tempo deste negócio.'"
    >
      <div v-if="informandoPerda" class="space-y-1.5">
        <Label for="motivo-perda-chat">Motivo</Label>
        <Textarea
          id="motivo-perda-chat"
          v-model="motivoPerda"
          placeholder="Ex.: preço, prazo, fechou com outro..."
        />
      </div>
      <div v-else class="flex flex-wrap gap-2">
        <Button
          v-if="etapaGanha"
          variante="primario"
          :disabled="salvandoDesfecho"
          :carregando="salvandoDesfecho"
          @click="confirmarGanho"
        >
          <CircleCheck class="size-4" />
          {{ etapaGanha.nome }}
        </Button>
        <Button
          v-if="etapaPerdida"
          variante="contorno"
          :disabled="salvandoDesfecho"
          @click="pedirPerda"
        >
          <CircleX class="size-4" />
          {{ etapaPerdida.nome }}
        </Button>
      </div>
      <template #rodape>
        <Button variante="secundario" :disabled="salvandoDesfecho" @click="soEncerrarConversa">
          Só encerrar conversa
        </Button>
        <Button
          v-if="informandoPerda"
          variante="perigo"
          :carregando="salvandoDesfecho"
          @click="confirmarPerda"
        >
          {{ etapaPerdida?.nome ?? 'Registrar' }}
        </Button>
      </template>
    </Dialog>
  </div>
</template>
