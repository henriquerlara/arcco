<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  Plus,
  CheckCircle2,
  Circle,
  CalendarClock,
  User,
  Target,
  ChevronLeft,
  ChevronRight,
} from 'lucide-vue-next';
import {
  PersonalizacaoComercial,
  TipoAtividade,
  avancarPeriodo,
  fimMes,
  fimSemana,
  inicioMes,
  inicioSemana,
} from '@arcco/contratos';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import EstadoVazio from '@/components/compartilhados/EstadoVazio.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import Select from '@/components/ui/Select.vue';
import Card from '@/components/ui/Card.vue';
import Dialog from '@/components/ui/Dialog.vue';
import SeletorUsuario from '@/components/formularios/SeletorUsuario.vue';
import AtividadeFormulario from './AtividadeFormulario.vue';
import EntregaFormulario from './EntregaFormulario.vue';
import AgendaCalendario from './AgendaCalendario.vue';
import type { Atividade } from '@/types';
import { servicoAtividades } from '@/services';
import {
  ROTULO_TIPO_ATIVIDADE,
  ROTULO_TIPO_ATIVIDADE_ECOLUME,
  opcoesDe,
} from '@/composables/rotulos';
import { LEGENDA_TIPOS_ECOLUME } from '@/composables/agenda-cores';
import { formatarDataHora, estaAtrasada } from '@/composables/formatadores';
import { useNotificacao } from '@/composables/useNotificacao';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { cn } from '@/composables/cn';

const auth = useAutenticacaoStore();
const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);

const rota = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();

type SituacaoAgenda = 'pendentes' | 'atrasadas' | 'concluidas' | 'todas' | 'entregas';
type VistaAgenda = 'lista' | 'semana' | 'mes';

const situacao = ref<SituacaoAgenda>(
  rota.query.entregas === '1'
    ? 'entregas'
    : rota.query.atrasadas === '1' || rota.query.atrasadas === 'true'
      ? 'atrasadas'
      : 'pendentes',
);
const tipo = ref('');
const responsavelId = ref<string | null>(null);
const vista = ref<VistaAgenda>(
  ecolume.value && (rota.query.vista === 'semana' || rota.query.vista === 'mes')
    ? (rota.query.vista as VistaAgenda)
    : 'lista',
);
const ancora = ref(new Date());
const formAberto = ref(false);
const atividadeEmEdicao = ref<Atividade | null>(null);
const entregaAberto = ref(false);
const entregaPedidoId = ref<string | null>(null);
const concluirEntregaId = ref<string | null>(null);
const concluirEntregaAberto = ref(false);
const concluirFuId = ref<string | null>(null);
const concluirFuAberto = ref(false);
const resultadoFu = ref('');

const opcoesTipo = computed(() => [
  { valor: '', rotulo: 'Todos os tipos' },
  ...(ecolume.value
    ? opcoesDe(ROTULO_TIPO_ATIVIDADE_ECOLUME as Record<string, string>)
    : opcoesDe(ROTULO_TIPO_ATIVIDADE)),
]);
const opcoesSituacao = computed(() => {
  const base = [
    { valor: 'pendentes', rotulo: 'Pendentes' },
    { valor: 'atrasadas', rotulo: 'Atrasadas' },
    { valor: 'concluidas', rotulo: 'Concluídas' },
    { valor: 'todas', rotulo: 'Todas' },
  ];
  if (ecolume.value) base.splice(1, 0, { valor: 'entregas', rotulo: 'Entregas a fazer' });
  return base;
});

const opcoesVista = [
  { valor: 'lista', rotulo: 'Lista' },
  { valor: 'semana', rotulo: 'Semana' },
  { valor: 'mes', rotulo: 'Mês' },
];

watch(
  () => rota.query.atrasadas,
  (valor) => {
    if (valor === '1' || valor === 'true') situacao.value = 'atrasadas';
  },
);

watch(situacao, (valor) => {
  const querAtrasadas = valor === 'atrasadas';
  const naUrl = rota.query.atrasadas === '1' || rota.query.atrasadas === 'true';
  if (querAtrasadas === naUrl) return;
  void router.replace({
    query: querAtrasadas ? { ...rota.query, atrasadas: '1' } : { ...rota.query, atrasadas: undefined },
  });
});

function sincronizarVistaNaUrl(valor: VistaAgenda) {
  if (!ecolume.value) return;
  const atual = typeof rota.query.vista === 'string' ? rota.query.vista : 'lista';
  if (valor === atual || (valor === 'lista' && !rota.query.vista)) return;
  const proxima = { ...rota.query } as Record<string, unknown>;
  if (valor === 'lista') delete proxima.vista;
  else proxima.vista = valor;
  void router.replace({ query: proxima as typeof rota.query });
}

watch(vista, (valor) => sincronizarVistaNaUrl(valor));

watch(
  () => rota.query.vista,
  (v) => {
    if (!ecolume.value) {
      if (vista.value !== 'lista') vista.value = 'lista';
      return;
    }
    const desejada: VistaAgenda =
      v === 'semana' || v === 'mes' ? v : 'lista';
    if (vista.value !== desejada) vista.value = desejada;
  },
);

watch(ecolume, (v) => {
  if (!v) vista.value = 'lista';
});

function escolherVista(valor: VistaAgenda) {
  vista.value = valor;
  sincronizarVistaNaUrl(valor);
}

const intervaloCalendario = computed(() => {
  if (vista.value === 'semana') {
    return { de: inicioSemana(ancora.value), ate: fimSemana(ancora.value) };
  }
  if (vista.value === 'mes') {
    const dias = /* grade completa */ {
      de: inicioSemana(inicioMes(ancora.value)),
      ate: fimSemana(fimMes(ancora.value)),
    };
    return dias;
  }
  return null;
});

const rotuloPeriodo = computed(() => {
  const a = ancora.value;
  if (vista.value === 'semana') {
    const i = inicioSemana(a);
    const f = fimSemana(a);
    const fmt = (d: Date) =>
      d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `${fmt(i)} – ${fmt(f)} ${f.getFullYear()}`;
  }
  return a.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
});

const filtros = computed(() => {
  const base: Record<string, unknown> = {
    tipo: situacao.value === 'entregas' ? TipoAtividade.ENTREGA : tipo.value || undefined,
    responsavelId: responsavelId.value ?? undefined,
    atrasadas: situacao.value === 'atrasadas' ? true : undefined,
    entregasAFazer: situacao.value === 'entregas' ? true : undefined,
    concluida:
      situacao.value === 'todas' ||
      situacao.value === 'atrasadas' ||
      situacao.value === 'entregas'
        ? undefined
        : situacao.value === 'concluidas',
    porPagina: vista.value === 'lista' ? 50 : 500,
  };
  const faixa = intervaloCalendario.value;
  if (faixa) {
    base.de = faixa.de.toISOString();
    base.ate = faixa.ate.toISOString();
  }
  return base;
});

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['atividades', filtros.value]),
  queryFn: () => servicoAtividades.listar(filtros.value),
});

const linhas = computed(() => data.value?.dados ?? []);

async function invalidarAgenda() {
  await queryClient.invalidateQueries({ queryKey: ['atividades'] });
  await queryClient.invalidateQueries({ queryKey: ['resumo-agenda'] });
}

async function confirmarFollowUp() {
  if (!concluirFuId.value || resultadoFu.value.trim().length < 2) return;
  try {
    await servicoAtividades.concluirFollowUp(concluirFuId.value, resultadoFu.value.trim());
    sucesso('Follow-up concluído.');
    concluirFuAberto.value = false;
    await invalidarAgenda();
  } catch (e) {
    notificarErro(e);
  }
}

async function alternar(ativ: Atividade) {
  if (ativ.tipo === TipoAtividade.ENTREGA && !ativ.concluida) {
    concluirEntregaId.value = ativ.id;
    concluirEntregaAberto.value = true;
    return;
  }
  if (ecolume.value && ativ.tipo === TipoAtividade.FOLLOW_UP && !ativ.concluida) {
    concluirFuId.value = ativ.id;
    resultadoFu.value = '';
    concluirFuAberto.value = true;
    return;
  }
  try {
    await servicoAtividades.concluir(ativ.id, !ativ.concluida);
    await invalidarAgenda();
  } catch (e) {
    notificarErro(e);
  }
}

async function confirmarConclusaoEntrega(final: boolean) {
  if (!concluirEntregaId.value) return;
  try {
    await servicoAtividades.concluirEntrega(concluirEntregaId.value, final);
    sucesso(final ? 'Entrega final registrada.' : 'Entrega parcial registrada.');
    concluirEntregaAberto.value = false;
    await invalidarAgenda();
    await queryClient.invalidateQueries({ queryKey: ['pipeline-ecolume'] });
  } catch (e) {
    notificarErro(e);
  }
}

function editar(ativ: Atividade) {
  atividadeEmEdicao.value = ativ;
  formAberto.value = true;
}

function novaAtividade() {
  atividadeEmEdicao.value = null;
  formAberto.value = true;
}

function contatoDaAtividade(ativ: Atividade) {
  return ativ.contato ?? ativ.oportunidade?.contato ?? null;
}

function rotuloTipo(t: string) {
  if (ecolume.value && ROTULO_TIPO_ATIVIDADE_ECOLUME[t as TipoAtividade]) {
    return ROTULO_TIPO_ATIVIDADE_ECOLUME[t as TipoAtividade];
  }
  return ROTULO_TIPO_ATIVIDADE[t as TipoAtividade] ?? t;
}

function navegar(delta: number) {
  if (vista.value === 'semana' || vista.value === 'mes') {
    ancora.value = avancarPeriodo(ancora.value, vista.value, delta);
  }
}

function irHoje() {
  ancora.value = new Date();
}

async function aoSalvarFormulario() {
  await invalidarAgenda();
  await refetch();
}
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina titulo="Agenda" descricao="Tarefas, follow-ups e compromissos da equipe.">
      <template #acoes>
        <Button @click="novaAtividade"><Plus class="size-4" /> Nova atividade</Button>
      </template>
    </CabecalhoPagina>

    <div class="grid gap-3 sm:grid-cols-3" :class="ecolume ? 'lg:grid-cols-4' : ''">
      <Select v-model="situacao" :opcoes="opcoesSituacao" />
      <Select v-model="tipo" :opcoes="opcoesTipo" />
      <SeletorUsuario v-model="responsavelId" incluir-vazio rotulo-vazio="Todos os responsáveis" />
      <div
        v-if="ecolume"
        class="flex rounded-md border border-borda bg-branco p-0.5"
        role="tablist"
        aria-label="Visualização da agenda"
        data-testid="agenda-vista"
      >
        <button
          v-for="op in opcoesVista"
          :key="op.valor"
          type="button"
          role="tab"
          :aria-selected="vista === op.valor"
          :data-vista="op.valor"
          :class="
            cn(
              'flex-1 rounded px-2 py-1.5 text-xs font-medium',
              vista === op.valor
                ? 'bg-carvao text-branco'
                : 'text-texto-secundario hover:bg-marfim',
            )
          "
          @click="escolherVista(op.valor as VistaAgenda)"
        >
          {{ op.rotulo }}
        </button>
      </div>
    </div>

    <div
      v-if="ecolume && vista !== 'lista'"
      class="flex flex-wrap items-center justify-between gap-2"
      data-testid="agenda-nav-periodo"
    >
      <div class="flex items-center gap-1">
        <Button variante="secundario" class="!px-2" aria-label="Anterior" @click="navegar(-1)">
          <ChevronLeft class="size-4" />
        </Button>
        <Button variante="secundario" class="!px-2" aria-label="Próximo" @click="navegar(1)">
          <ChevronRight class="size-4" />
        </Button>
        <Button variante="secundario" data-testid="agenda-hoje" @click="irHoje">Hoje</Button>
      </div>
      <p class="text-sm font-medium capitalize text-texto">{{ rotuloPeriodo }}</p>
      <ul class="flex flex-wrap gap-2 text-[11px] text-texto-secundario">
        <li v-for="item in LEGENDA_TIPOS_ECOLUME" :key="item.tipo" class="flex items-center gap-1">
          <span class="inline-block size-2.5 rounded-sm" :style="{ backgroundColor: item.cor }" />
          {{ item.rotulo }}
        </li>
      </ul>
    </div>

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />

    <div v-else-if="isLoading" class="space-y-2">
      <Skeleton v-for="n in 5" :key="n" class="h-16 w-full" />
    </div>

    <template v-else-if="ecolume && vista !== 'lista'">
      <EstadoVazio
        v-if="linhas.length === 0"
        titulo="Nada neste período"
        descricao="Nenhuma atividade com os filtros atuais neste intervalo."
        :icone="CalendarClock"
      />
      <AgendaCalendario
        v-else
        :modo="vista"
        :ancora="ancora"
        :atividades="linhas"
        @selecionar="editar"
      />
    </template>

    <EstadoVazio
      v-else-if="linhas.length === 0"
      titulo="Nenhuma atividade"
      descricao="Você está em dia! Crie uma atividade para acompanhar próximos passos."
      :icone="CalendarClock"
    >
      <template #acao>
        <Button @click="novaAtividade"><Plus class="size-4" /> Nova atividade</Button>
      </template>
    </EstadoVazio>

    <div v-else class="space-y-2">
      <Card
        v-for="ativ in linhas"
        :key="ativ.id"
        class="flex items-center gap-4 p-4"
      >
        <button class="shrink-0" @click="alternar(ativ)">
          <CheckCircle2 v-if="ativ.concluida" class="size-6 text-sucesso" />
          <Circle v-else class="size-6 text-texto-secundario hover:text-dourado" />
        </button>

        <button class="min-w-0 flex-1 text-left" @click="editar(ativ)">
          <div class="flex items-center gap-2">
            <p
              :class="
                cn(
                  'truncate text-sm font-medium',
                  ativ.concluida ? 'text-texto-secundario line-through' : 'text-texto',
                )
              "
            >
              {{ ativ.titulo }}
            </p>
            <Badge variante="neutro">{{ rotuloTipo(ativ.tipo) }}</Badge>
          </div>
          <div class="mt-1 flex flex-wrap items-center gap-3 text-xs text-texto-secundario">
            <span
              class="flex items-center gap-1"
              :class="!ativ.concluida && estaAtrasada(ativ.vencimento) ? 'font-medium text-erro' : ''"
            >
              <CalendarClock class="size-3.5" /> {{ formatarDataHora(ativ.vencimento) }}
            </span>
            <RouterLink
              v-if="contatoDaAtividade(ativ)"
              :to="`/app/contatos/${contatoDaAtividade(ativ)!.id}`"
              class="flex items-center gap-1 hover:text-dourado-hover"
              @click.stop
            >
              <User class="size-3.5" /> {{ contatoDaAtividade(ativ)!.nome }}
            </RouterLink>
            <span v-if="ativ.oportunidade" class="flex items-center gap-1">
              <Target class="size-3.5" /> {{ ativ.oportunidade.codigo }}
            </span>
            <span v-if="ativ.pedido" class="flex items-center gap-1">
              {{ ativ.pedido.numero }}
            </span>
            <Badge v-if="ativ.conclusaoEntrega" variante="neutro">
              {{ ativ.conclusaoEntrega === 'FINAL' ? 'Final' : 'Parcial' }}
            </Badge>
          </div>
        </button>

        <RouterLink
          v-if="ativ.oportunidadeId"
          :to="`/app/oportunidades/${ativ.oportunidadeId}`"
          class="shrink-0 rounded-md p-2 text-texto-secundario hover:bg-marfim hover:text-dourado-hover"
          title="Ver negócio"
        >
          <Target class="size-4" />
        </RouterLink>
      </Card>
    </div>

    <AtividadeFormulario v-model="formAberto" :atividade="atividadeEmEdicao" @salvo="aoSalvarFormulario" />
    <EntregaFormulario v-model="entregaAberto" :pedido-id="entregaPedidoId" @salvo="aoSalvarFormulario" />

    <Dialog v-model="concluirEntregaAberto" titulo="Concluir entrega">
      <div class="space-y-2 text-sm text-texto-secundario">
        <p>
          <span class="font-medium text-texto">Entrega final</span> — marca o pedido como
          <span class="font-medium text-texto">Entregue</span> no kanban e no checklist.
        </p>
        <p>
          <span class="font-medium text-texto">Só parcial</span> — tira o compromisso da agenda,
          mas o pedido
          <span class="font-medium text-texto">continua onde está</span> (não muda de coluna).
        </p>
      </div>
      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <Button variante="secundario" @click="concluirEntregaAberto = false">Cancelar</Button>
        <Button variante="secundario" @click="confirmarConclusaoEntrega(false)">
          Só parcial
        </Button>
        <Button @click="confirmarConclusaoEntrega(true)">Entrega final</Button>
      </div>
    </Dialog>

    <Dialog v-model="concluirFuAberto" titulo="Resultado do follow-up">
      <p class="mb-2 text-sm text-texto-secundario">
        Informe o resultado do contato — fica no histórico do negócio.
      </p>
      <textarea
        v-model="resultadoFu"
        class="min-h-[88px] w-full rounded-md border border-borda bg-branco px-3 py-2 text-sm"
        placeholder="Ex.: Cliente pediu revisão de prazo"
      />
      <div class="mt-4 flex justify-end gap-2">
        <Button variante="secundario" @click="concluirFuAberto = false">Cancelar</Button>
        <Button :disabled="resultadoFu.trim().length < 2" @click="confirmarFollowUp">
          Concluir
        </Button>
      </div>
    </Dialog>
  </div>
</template>
