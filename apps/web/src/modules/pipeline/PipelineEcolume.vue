<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Filter, Plus, Search } from 'lucide-vue-next';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import SeletorUsuario from '@/components/formularios/SeletorUsuario.vue';
import SeletorContato from '@/components/formularios/SeletorContato.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import Dialog from '@/components/ui/Dialog.vue';
import OportunidadeFormulario from '@/modules/oportunidades/OportunidadeFormulario.vue';
import EntregaFormulario from '@/modules/atividades/EntregaFormulario.vue';
import {
  servicoOportunidades,
  servicoPedidos,
  type CardKanbanNegocio,
  type CardKanbanPedido,
  type ColunaKanbanEcolume,
  type PipelineEcolume,
} from '@/services';
import { formatarMoeda, formatarDataCurta } from '@/composables/formatadores';

const router = useRouter();
const rota = useRoute();
const queryClient = useQueryClient();

const responsavelId = ref<string | null>(null);
const parceiroId = ref<string | null>(null);
const periodoDe = ref('');
const periodoAte = ref('');
const escopo = ref(
  rota.query.escopo === 'pre' || rota.query.escopo === 'pos' ? String(rota.query.escopo) : 'todos',
);
const finalizadosDias = ref('30');
const filtrosVisiveis = ref(false);
const destaqueColuna = ref(
  typeof rota.query.coluna === 'string' ? rota.query.coluna : '',
);

watch(
  () => rota.query.coluna,
  (v) => {
    destaqueColuna.value = typeof v === 'string' ? v : '';
    if (!destaqueColuna.value) return;
    const posKeys = [
      'PEDIDO_CONFIRMADO',
      'EM_SEPARACAO',
      'PRONTO_ENTREGA',
      'ENTREGUE',
      'PEDIDO_FINALIZADO',
    ];
    escopo.value = posKeys.includes(destaqueColuna.value) ? 'pos' : 'pre';
  },
  { immediate: true },
);
const formAberto = ref(false);
const entregaAberto = ref(false);
const entregaPedidoId = ref<string | null>(null);
const busca = ref('');
const buscando = ref(false);

const perdaAberto = ref(false);
const perdaCardId = ref<string | null>(null);
const perdaEtapaId = ref<string | null>(null);
const codigoMotivo = ref('PRECO');
const motivoTexto = ref('');
const arrastando = ref<{ tipo: 'NEGOCIO' | 'PEDIDO'; id: string } | null>(null);
const erroMovimento = ref<string | null>(null);
const etapasPre = ref<Record<string, string>>({});

const filtros = computed(() => ({
  responsavelId: responsavelId.value ?? undefined,
  parceiroId: parceiroId.value ?? undefined,
  periodoDe: periodoDe.value || undefined,
  periodoAte: periodoAte.value || undefined,
  escopo: escopo.value as 'pre' | 'pos' | 'todos',
  finalizadosDias: Number(finalizadosDias.value),
}));

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['pipeline-ecolume', filtros.value]),
  queryFn: () => servicoOportunidades.pipeline(filtros.value),
});

const board = computed(() => {
  const v = data.value;
  if (v && !Array.isArray(v) && (v as PipelineEcolume).modo === 'ecolume') {
    return v as PipelineEcolume & { etapasPre?: Record<string, string> };
  }
  return null;
});

const pre = ref<ColunaKanbanEcolume[]>([]);
const pos = ref<ColunaKanbanEcolume[]>([]);
watch(
  board,
  (v) => {
    if (!v) return;
    pre.value = v.preVenda.map((c) => ({ ...c, cards: [...c.cards] }));
    pos.value = v.posVenda.map((c) => ({ ...c, cards: [...c.cards] }));
    if (v.etapasPre) etapasPre.value = v.etapasPre;
  },
  { immediate: true },
);

const motivos = computed(() => board.value?.motivosPerda ?? []);
const totalAbertos = computed(() => board.value?.totalOrcamentosAbertos ?? 0);

const opcoesEscopo = [
  { valor: 'todos', rotulo: 'Pré e pós-venda' },
  { valor: 'pre', rotulo: 'Apenas pré-venda' },
  { valor: 'pos', rotulo: 'Apenas pós-venda' },
];
const opcoesFinalizados = [
  { valor: '30', rotulo: 'Finalizados · 30 dias' },
  { valor: '90', rotulo: 'Finalizados · 90 dias' },
  { valor: '0', rotulo: 'Todos os finalizados' },
];
const opcoesMotivo = computed(() =>
  motivos.value.map((m) => ({ valor: m.codigo, rotulo: m.rotulo })),
);

function asNegocio(card: CardKanbanNegocio | CardKanbanPedido): CardKanbanNegocio {
  return card as CardKanbanNegocio;
}
function asPedido(card: CardKanbanNegocio | CardKanbanPedido): CardKanbanPedido {
  return card as CardKanbanPedido;
}

function abrirNegocio(id: string, query?: Record<string, string>) {
  void router.push({ name: 'oportunidade-detalhe', params: { id }, query });
}

function abrirPedido(card: CardKanbanPedido) {
  void router.push({
    name: 'oportunidade-detalhe',
    params: { id: card.oportunidadeId },
    query: { pedidoId: card.id },
  });
}

function agendarEntrega(card: CardKanbanPedido, ev: Event) {
  ev.stopPropagation();
  entregaPedidoId.value = card.id;
  entregaAberto.value = true;
}

async function executarBusca() {
  const q = busca.value.trim();
  if (!q) return;
  buscando.value = true;
  erroMovimento.value = null;
  try {
    const r = await servicoOportunidades.buscarKanban(q);
    if (!r.oportunidadeId) {
      erroMovimento.value = 'Nenhum negócio encontrado';
      return;
    }
    const query: Record<string, string> = {};
    if (r.tipo === 'ORCAMENTO' && r.destaque?.orcamentoId) {
      query.orcamentoId = String(r.destaque.orcamentoId);
    }
    if (r.tipo === 'PEDIDO' && r.destaque?.pedidoId) {
      query.pedidoId = String(r.destaque.pedidoId);
    }
    abrirNegocio(r.oportunidadeId, query);
  } finally {
    buscando.value = false;
  }
}

function onDragStart(tipo: 'NEGOCIO' | 'PEDIDO', id: string, ev: DragEvent) {
  arrastando.value = { tipo, id };
  ev.dataTransfer?.setData('text/plain', `${tipo}:${id}`);
  if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
}

function onDragOver(ev: DragEvent) {
  ev.preventDefault();
}

async function soltarPre(chave: string) {
  const a = arrastando.value;
  arrastando.value = null;
  if (!a || a.tipo !== 'NEGOCIO') return;
  erroMovimento.value = null;
  const etapaId = etapasPre.value[chave];
  if (!etapaId) {
    erroMovimento.value = 'Etapa não encontrada';
    return;
  }
  if (chave === 'PERDIDO') {
    perdaCardId.value = a.id;
    perdaEtapaId.value = etapaId;
    perdaAberto.value = true;
    return;
  }
  try {
    await servicoOportunidades.mover(a.id, etapaId);
    await queryClient.invalidateQueries({ queryKey: ['pipeline-ecolume'] });
  } catch (e) {
    erroMovimento.value = e instanceof Error ? e.message : 'Falha ao mover';
    await refetch();
  }
}

async function soltarPos(chave: string) {
  const a = arrastando.value;
  arrastando.value = null;
  if (!a || a.tipo !== 'PEDIDO') return;
  if (chave === 'PEDIDO_FINALIZADO') {
    erroMovimento.value = 'Finalizado só pelo checklist 100%';
    return;
  }
  const fases = ['PEDIDO_CONFIRMADO', 'EM_SEPARACAO', 'PRONTO_ENTREGA', 'ENTREGUE'] as const;
  if (!(fases as readonly string[]).includes(chave)) return;
  erroMovimento.value = null;
  try {
    await servicoPedidos.moverKanban(a.id, chave as (typeof fases)[number]);
    await queryClient.invalidateQueries({ queryKey: ['pipeline-ecolume'] });
  } catch (e) {
    erroMovimento.value = e instanceof Error ? e.message : 'Falha ao mover pedido';
    await refetch();
  }
}

async function confirmarPerda() {
  if (!perdaCardId.value || !perdaEtapaId.value) return;
  const def = motivos.value.find((m) => m.codigo === codigoMotivo.value);
  try {
    await servicoOportunidades.mover(
      perdaCardId.value,
      perdaEtapaId.value,
      def?.exigeDescricao ? motivoTexto.value : undefined,
      codigoMotivo.value,
    );
    perdaAberto.value = false;
    await queryClient.invalidateQueries({ queryKey: ['pipeline-ecolume'] });
  } catch (e) {
    erroMovimento.value = e instanceof Error ? e.message : 'Falha ao marcar perdido';
  }
}
</script>

<template>
  <div class="flex h-full flex-col gap-5">
    <CabecalhoPagina
      titulo="Negócios"
      :descricao="`${formatarMoeda(totalAbertos)} em orçamentos abertos`"
    >
      <template #acoes>
        <Button variante="secundario" @click="filtrosVisiveis = !filtrosVisiveis">
          <Filter class="size-4" />
          Filtros
        </Button>
        <Button @click="formAberto = true">
          <Plus class="size-4" />
          Novo negócio
        </Button>
      </template>
    </CabecalhoPagina>

    <form class="flex flex-wrap gap-2" @submit.prevent="executarBusca">
      <Input
        v-model="busca"
        class="min-w-[220px] flex-1"
        placeholder="Cliente, NEG, ORC, PED, parceiro…"
      />
      <Button type="submit" variante="secundario" :disabled="buscando">
        <Search class="size-4" />
        Buscar
      </Button>
    </form>

    <p v-if="erroMovimento" class="text-sm text-erro">{{ erroMovimento }}</p>

    <div
      v-if="filtrosVisiveis"
      class="grid gap-3 rounded-lg border border-borda bg-branco p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div>
        <p class="mb-1 text-xs font-medium text-texto-secundario">Responsável</p>
        <SeletorUsuario v-model="responsavelId" incluir-vazio rotulo-vazio="Todos" />
      </div>
      <div>
        <p class="mb-1 text-xs font-medium text-texto-secundario">Parceiro</p>
        <SeletorContato v-model="parceiroId" somente-parceiros placeholder="Todos" />
        <button
          v-if="parceiroId"
          type="button"
          class="mt-1 text-[11px] text-texto-secundario underline"
          @click="parceiroId = null"
        >
          Limpar
        </button>
      </div>
      <div>
        <p class="mb-1 text-xs font-medium text-texto-secundario">Escopo</p>
        <Select v-model="escopo" :opcoes="opcoesEscopo" />
      </div>
      <div>
        <p class="mb-1 text-xs font-medium text-texto-secundario">Finalizados</p>
        <Select v-model="finalizadosDias" :opcoes="opcoesFinalizados" />
      </div>
      <div>
        <p class="mb-1 text-xs font-medium text-texto-secundario">De</p>
        <Input v-model="periodoDe" type="date" />
      </div>
      <div>
        <p class="mb-1 text-xs font-medium text-texto-secundario">Até</p>
        <Input v-model="periodoAte" type="date" />
      </div>
    </div>

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />

    <div v-else-if="isLoading" class="flex min-h-0 flex-1 gap-3">
      <Skeleton v-for="n in 4" :key="n" class="h-96 min-w-0 flex-1 basis-0" />
    </div>

    <template v-else>
      <section v-if="escopo !== 'pos'" class="flex min-h-0 flex-col gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-texto-secundario">Pré-venda</h2>
        <div class="flex min-h-0 gap-3 overflow-x-auto pb-1">
          <div
            v-for="coluna in pre"
            :key="coluna.chave"
            :data-coluna="coluna.chave"
            :class="[
              'flex min-w-[240px] flex-1 basis-0 flex-col overflow-hidden rounded-md border bg-marfim/45',
              destaqueColuna === coluna.chave ? 'border-dourado ring-2 ring-dourado/40' : 'border-borda/80',
            ]"
            @dragover="onDragOver"
            @drop.prevent="soltarPre(coluna.chave)"
          >
            <header class="border-b border-borda/70 bg-branco/70 px-3 py-3 backdrop-blur-sm">
              <h3 class="truncate text-sm font-semibold text-texto">{{ coluna.nome }}</h3>
              <span class="text-[10px] font-bold text-texto-secundario">{{ coluna.cards.length }}</span>
            </header>
            <div class="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-2.5">
              <article
                v-for="card in coluna.cards"
                :key="card.id"
                draggable="true"
                class="cursor-grab rounded-md border border-borda/90 bg-branco p-3 active:cursor-grabbing"
                @dragstart="onDragStart('NEGOCIO', card.id, $event)"
                @click="abrirNegocio(card.id)"
              >
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="text-xs font-medium text-texto-secundario">{{ asNegocio(card).codigo }}</p>
                    <h4 class="text-sm font-semibold text-texto">{{ asNegocio(card).titulo }}</h4>
                  </div>
                  <span class="text-[10px] text-texto-secundario">{{ asNegocio(card).diasParado }}d</span>
                </div>
                <p class="mt-1 text-xs text-texto-secundario">{{ asNegocio(card).clienteNome }}</p>
                <p v-if="asNegocio(card).parceiroNome" class="text-xs text-texto-secundario">
                  Parceiro: {{ asNegocio(card).parceiroNome }}
                </p>
                <p v-if="asNegocio(card).valorOrcamentoAberto != null" class="mt-2 text-sm font-semibold">
                  {{ formatarMoeda(asNegocio(card).valorOrcamentoAberto!) }}
                </p>
                <p class="mt-1 text-[11px] text-texto-secundario">
                  {{ asNegocio(card).quantidadeOrcamentos }} orçamento(s)
                  <span v-if="asNegocio(card).responsavel">
                    · {{ asNegocio(card).responsavel!.nome }}
                  </span>
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section v-if="escopo !== 'pre'" class="flex min-h-0 flex-col gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-texto-secundario">Pós-venda</h2>
        <div class="flex min-h-0 gap-3 overflow-x-auto pb-1">
          <div
            v-for="coluna in pos"
            :key="coluna.chave"
            :data-coluna="coluna.chave"
            :class="[
              'flex min-w-[240px] flex-1 basis-0 flex-col overflow-hidden rounded-md border bg-marfim/45',
              destaqueColuna === coluna.chave ? 'border-dourado ring-2 ring-dourado/40' : 'border-borda/80',
            ]"
            @dragover="onDragOver"
            @drop.prevent="soltarPos(coluna.chave)"
          >
            <header class="border-b border-borda/70 bg-branco/70 px-3 py-3 backdrop-blur-sm">
              <h3 class="truncate text-sm font-semibold text-texto">{{ coluna.nome }}</h3>
              <span class="text-[10px] font-bold text-texto-secundario">{{ coluna.cards.length }}</span>
            </header>
            <div class="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-2.5">
              <article
                v-for="card in coluna.cards"
                :key="card.id"
                :draggable="coluna.chave !== 'PEDIDO_FINALIZADO'"
                class="cursor-grab rounded-md border border-borda/90 bg-branco p-3 active:cursor-grabbing"
                @dragstart="onDragStart('PEDIDO', card.id, $event)"
                @click="abrirPedido(asPedido(card))"
              >
                <p class="text-xs font-medium text-texto-secundario">{{ asPedido(card).numero }}</p>
                <h4 class="text-sm font-semibold text-texto">
                  {{ asPedido(card).negocioTitulo || asPedido(card).negocioCodigo }}
                </h4>
                <p class="mt-1 text-xs text-texto-secundario">{{ asPedido(card).clienteNome }}</p>
                <p class="mt-2 text-sm font-semibold">{{ formatarMoeda(asPedido(card).valor) }}</p>
                <p
                  v-if="asPedido(card).dataEntrega"
                  class="mt-1 text-[11px] text-texto-secundario"
                >
                  Entrega: {{ formatarDataCurta(asPedido(card).dataEntrega!) }}
                  <span v-if="asPedido(card).periodoEntrega === 'MANHA'"> · manhã</span>
                  <span v-else-if="asPedido(card).periodoEntrega === 'TARDE'"> · tarde</span>
                </p>
                <div
                  v-if="asPedido(card).pendenciasChecklist.length"
                  class="mt-2 rounded-sm bg-alerta/10 px-2 py-1.5"
                >
                  <p class="text-[10px] font-semibold uppercase tracking-wide text-alerta">
                    Ainda falta
                  </p>
                  <ul class="mt-0.5 space-y-0.5 text-[11px] text-alerta">
                    <li
                      v-for="p in asPedido(card).pendenciasChecklist"
                      :key="p.tipo"
                    >
                      · {{ p.rotulo }}
                    </li>
                  </ul>
                </div>
                <p
                  v-if="asPedido(card).responsavel"
                  class="mt-1 text-[11px] text-texto-secundario"
                >
                  {{ asPedido(card).responsavel!.nome }}
                </p>
                <Button
                  v-if="coluna.chave === 'PRONTO_ENTREGA'"
                  class="mt-2 w-full"
                  variante="secundario"
                  @click="agendarEntrega(asPedido(card), $event)"
                >
                  Agendar entrega
                </Button>
              </article>
            </div>
          </div>
        </div>
      </section>
    </template>

    <OportunidadeFormulario v-model="formAberto" />
    <EntregaFormulario v-model="entregaAberto" :pedido-id="entregaPedidoId" />

    <Dialog v-model="perdaAberto" titulo="Marcar como perdido">
      <div class="space-y-3">
        <div>
          <p class="mb-1 text-xs font-medium text-texto-secundario">Motivo</p>
          <Select v-model="codigoMotivo" :opcoes="opcoesMotivo" />
        </div>
        <div v-if="motivos.find((m) => m.codigo === codigoMotivo)?.exigeDescricao">
          <p class="mb-1 text-xs font-medium text-texto-secundario">Descrição</p>
          <Input v-model="motivoTexto" placeholder="Descreva o motivo" />
        </div>
        <div class="flex justify-end gap-2">
          <Button variante="secundario" @click="perdaAberto = false">Cancelar</Button>
          <Button @click="confirmarPerda">Confirmar</Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>
