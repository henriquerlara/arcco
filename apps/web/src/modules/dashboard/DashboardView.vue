<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useRouter, RouterLink } from 'vue-router';
import {
  TrendingUp,
  Trophy,
  Wallet,
  MessagesSquare,
  AlertTriangle,
  Clock,
  ChevronRight,
  Users,
  Ban,
  ShoppingBag,
  FileText,
} from 'lucide-vue-next';
import { PersonalizacaoComercial } from '@arcco/contratos';
import CartaoMetrica from '@/components/compartilhados/CartaoMetrica.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import SeletorPeriodo, { type Periodo } from '@/components/compartilhados/SeletorPeriodo.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import GraficoFunil from './GraficoFunil.vue';
import ChecklistPosOnboarding from './ChecklistPosOnboarding.vue';
import { servicoDashboard } from '@/services';
import type { AlertaDashboard, PontoFunil } from '@/types';
import { formatarMoeda, formatarPercentual, formatarNumero } from '@/composables/formatadores';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { cn } from '@/composables/cn';

const auth = useAutenticacaoStore();
const router = useRouter();
const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);

const periodo = ref<Periodo>(
  ecolume.value
    ? { chave: 'mes', de: undefined, ate: undefined }
    : { chave: '30d' },
);

// inicializa de/ate para este mês no ecolume
if (ecolume.value && !periodo.value.de) {
  const agora = new Date();
  periodo.value = {
    chave: 'mes',
    de: new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString(),
    ate: agora.toISOString(),
  };
}

const filtros = computed(() => ({
  de: periodo.value.de,
  ate: periodo.value.ate,
  chave: ecolume.value ? periodo.value.chave : undefined,
  dias: !ecolume.value && periodo.value.chave === '30d' ? 30 : undefined,
}));

const metricasQuery = useQuery({
  queryKey: computed(() => ['dashboard', 'metricas', filtros.value]),
  queryFn: () => servicoDashboard.metricas(filtros.value),
});

const m = computed(() => metricasQuery.data.value as Record<string, unknown> | undefined);
const carregando = computed(() => metricasQuery.isLoading.value);
const modoEcolume = computed(() => m.value?.modo === 'ecolume' || ecolume.value);

const indicadores = computed(() => m.value?.indicadores as {
  faturamento?: number;
  faturamentoAnterior?: number;
  variacaoFaturamentoPercentual?: number | null;
  vendasConcluidas?: number;
  taxaConversaoNegocio?: number;
  orcamentosAbertos?: { quantidade: number; valor: number };
  ticketMedio?: number;
} | undefined);

const temFinanceiro = computed(() => Boolean(indicadores.value));

const parceiros = computed(() =>
  ((m.value?.parceiros as Array<Record<string, unknown>>) ?? []),
);

const alertasEcolume = computed(() =>
  ((m.value?.alertas as AlertaDashboard[]) ?? []),
);

const conversasAtivas = computed(() => {
  const c = m.value?.conversas as { aguardandoHumano: number; emAtendimento: number; botAtendendo: number } | undefined;
  if (!c) return undefined;
  return c.aguardandoHumano + c.emAtendimento + c.botAtendendo;
});

const ajudaConversas = computed(() => {
  const c = m.value?.conversas as { aguardandoHumano: number; emAtendimento: number } | undefined;
  if (!c) return '';
  return `${formatarNumero(c.aguardandoHumano)} aguardando · ${formatarNumero(c.emAtendimento)} com você`;
});

const oportunidades = computed(() => m.value?.oportunidades as {
  novasNoPeriodo?: number;
  ganhasNoPeriodo?: number;
  valorGanhoNoPeriodo?: number;
  taxaConversao?: number;
  ticketMedioGanho?: number;
  abertas?: number;
  valorPipeline?: number;
  perdidasNoPeriodo?: number;
  paradas?: number;
} | undefined);

const contatosNovos = computed(() => {
  const c = m.value?.contatos as { novosNoPeriodo?: number } | undefined;
  return c?.novosNoPeriodo;
});

const ajudaGanhos = computed(() => {
  const op = oportunidades.value;
  if (!op) return '';
  const conversao = formatarPercentual((op.taxaConversao ?? 0) * 100);
  if (op.valorGanhoNoPeriodo) {
    return `${formatarMoeda(op.valorGanhoNoPeriodo)} · ${conversao} de conversão`;
  }
  return `${conversao} de conversão`;
});

const funil = computed<PontoFunil[]>(() => {
  const raw = (m.value?.funil as Array<Record<string, unknown>>) ?? [];
  return raw.map((p) => ({
    etapa: String(p.nome ?? p.etapa ?? ''),
    total: Number(p.quantidade ?? p.total ?? 0),
    valor: p.valor != null ? Number(p.valor) : undefined,
    tipo: p.tipo as PontoFunil['tipo'],
    tipoCard: p.tipoCard as PontoFunil['tipoCard'],
    chave: p.chave as string | undefined,
    link: p.link as string | undefined,
  }));
});

const alertasLegado = computed<AlertaDashboard[]>(() => {
  const lista: AlertaDashboard[] = [];
  const conv = m.value?.conversas as { aguardandoHumano?: number } | undefined;
  const aguardando = conv?.aguardandoHumano ?? 0;
  if (aguardando > 0) {
    lista.push({
      id: 'conversas-aguardando',
      tipo: 'conversa_aguardando',
      titulo: `${aguardando} conversa(s) aguardando atendimento`,
      descricao: 'Clientes esperando por um atendente humano.',
      link: '/app/conversas',
      gravidade: 'alerta',
    });
  }
  const ativ = m.value?.atividades as { atrasadas?: number; pendentes?: number } | undefined;
  const atrasadas = ativ?.atrasadas ?? 0;
  if (atrasadas > 0) {
    lista.push({
      id: 'atividades-atrasadas',
      tipo: 'atividade_atrasada',
      titulo: `${atrasadas} atividade(s) atrasada(s)`,
      descricao: 'Follow-ups e tarefas com vencimento passado.',
      link: '/app/agenda?atrasadas=1',
      gravidade: 'alerta',
    });
  } else if ((ativ?.pendentes ?? 0) > 0) {
    lista.push({
      id: 'atividades-pendentes',
      tipo: 'info',
      titulo: `${ativ!.pendentes} atividade(s) pendente(s)`,
      descricao: 'Abra a agenda para priorizar o dia.',
      link: '/app/agenda',
      gravidade: 'info',
    });
  }
  const paradas = oportunidades.value?.paradas ?? 0;
  if (paradas > 0) {
    lista.push({
      id: 'oportunidades-paradas',
      tipo: 'oportunidade_parada',
      titulo: `${paradas} negócio(s) parado(s)`,
      descricao: 'Sem movimentação há mais de 7 dias. Follow-ups na agenda.',
      link: '/app/agenda',
      gravidade: 'info',
    });
  }
  const estoque = m.value?.estoque as { criticos?: number; zerados?: number } | undefined;
  if ((estoque?.criticos ?? 0) > 0) {
    lista.push({
      id: 'estoque-critico',
      tipo: 'estoque_critico',
      titulo: `${estoque!.criticos} produto(s) com estoque baixo`,
      descricao:
        (estoque?.zerados ?? 0) > 0
          ? `${estoque!.zerados} zerado(s). Reponha antes de fechar vendas.`
          : 'Itens no mínimo ou abaixo. Confira o estoque.',
      link: '/app/estoque?criticos=1',
      gravidade: 'alerta',
    });
  }
  return lista;
});

const corGravidade: Record<string, string> = {
  info: 'border-info/25 bg-info/8 text-info',
  alerta: 'border-alerta/25 bg-alerta/8 text-alerta',
  erro: 'border-erro/25 bg-erro/8 text-erro',
};

function ajudaVariacao() {
  const v = indicadores.value?.variacaoFaturamentoPercentual;
  if (v == null) return 'Sem base no período anterior';
  const sinal = v > 0 ? '+' : '';
  return `${sinal}${formatarPercentual(v)} vs período anterior`;
}

function aoClicarFunil(ponto: PontoFunil) {
  if (ponto.link) {
    void router.push(ponto.link);
    return;
  }
  if (ponto.chave) {
    void router.push({ path: '/app/pipeline', query: { coluna: ponto.chave } });
  }
}
</script>

<template>
  <div class="space-y-6">
    <header class="relative overflow-hidden border border-borda/80 bg-carvao px-6 py-7 text-marfim sm:px-8 sm:py-8">
      <div
        class="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-dourado/15 blur-3xl"
        aria-hidden="true"
      />
      <div class="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div class="min-w-0">
          <p class="rotulo-editorial text-dourado-claro/70">
            {{ modoEcolume ? 'Visão geral' : 'Operação · agora' }}
          </p>
          <h1 class="fonte-marca mt-2 text-3xl leading-none md:text-4xl">
            Olá, {{ auth.usuario?.nome?.split(' ')[0] ?? '' }}
          </h1>
          <p class="mt-3 max-w-lg text-sm text-marfim/55">
            <template v-if="modoEcolume">
              Indicadores do período, funil e o que precisa da sua atenção.
            </template>
            <template v-else>
              O que o comercial precisa resolver hoje — conversas, funil e dinheiro em jogo.
            </template>
          </p>
        </div>
        <div class="flex flex-col items-start gap-3 sm:items-end">
          <SeletorPeriodo
            v-model="periodo"
            :variante="modoEcolume ? 'ecolume' : 'legado'"
          />
          <div v-if="!carregando && modoEcolume && temFinanceiro" class="text-left sm:text-right">
            <p class="rotulo-editorial text-marfim/40">Orçamentos em aberto</p>
            <p class="fonte-marca mt-1 text-2xl text-dourado-claro md:text-3xl">
              {{ formatarMoeda(indicadores?.orcamentosAbertos?.valor) }}
            </p>
            <p class="text-xs text-marfim/45">
              {{ formatarNumero(indicadores?.orcamentosAbertos?.quantidade) }} ORC
            </p>
          </div>
          <div v-else-if="!carregando && !modoEcolume" class="text-left sm:text-right">
            <p class="rotulo-editorial text-marfim/40">Em aberto no funil</p>
            <p class="fonte-marca mt-1 text-2xl text-dourado-claro md:text-3xl">
              {{ formatarMoeda(oportunidades?.valorPipeline) }}
            </p>
          </div>
          <Skeleton v-else-if="carregando" class="h-12 w-40 bg-white/10" />
        </div>
      </div>
    </header>

    <ChecklistPosOnboarding v-if="!modoEcolume" />

    <EstadoErro
      v-if="metricasQuery.isError.value"
      :erro="metricasQuery.error.value"
      @tentar-novamente="metricasQuery.refetch()"
    />

    <!-- ——— ECOLUME ——— -->
    <template v-else-if="modoEcolume">
      <div v-if="temFinanceiro" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="dashboard-indicadores">
        <CartaoMetrica
          rotulo="Faturamento"
          :valor="formatarMoeda(indicadores?.faturamento)"
          :icone="Wallet"
          :ajuda="ajudaVariacao()"
          :carregando="carregando"
          destaque
        />
        <CartaoMetrica
          rotulo="Vendas concluídas"
          :valor="formatarNumero(indicadores?.vendasConcluidas)"
          :icone="Trophy"
          :ajuda="
            indicadores
              ? `${formatarPercentual((indicadores.taxaConversaoNegocio ?? 0) * 100)} conversão por negócio`
              : undefined
          "
          :carregando="carregando"
        />
        <CartaoMetrica
          rotulo="Orçamentos em aberto"
          :valor="formatarNumero(indicadores?.orcamentosAbertos?.quantidade)"
          :icone="FileText"
          :ajuda="indicadores ? formatarMoeda(indicadores.orcamentosAbertos?.valor) : undefined"
          :carregando="carregando"
        />
        <CartaoMetrica
          rotulo="Ticket médio"
          :valor="formatarMoeda(indicadores?.ticketMedio)"
          :icone="TrendingUp"
          :carregando="carregando"
        />
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <Card v-if="temFinanceiro" class="lg:col-span-2">
          <CardHeader class="flex-row items-center justify-between">
            <CardTitle>Negócios por etapa</CardTitle>
            <RouterLink
              to="/app/pipeline"
              class="flex items-center gap-1 text-sm text-dourado-hover hover:underline"
            >
              Ver Kanban <ChevronRight class="size-4" />
            </RouterLink>
          </CardHeader>
          <CardContent>
            <Skeleton v-if="carregando" class="h-72 w-full" />
            <GraficoFunil v-else :dados="funil" @selecionar="aoClicarFunil" />
          </CardContent>
        </Card>

        <Card :class="temFinanceiro ? '' : 'lg:col-span-3'">
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <AlertTriangle class="size-4 text-alerta" />
              Precisa da sua atenção
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-2.5">
            <template v-if="carregando">
              <Skeleton v-for="n in 3" :key="n" class="h-16 w-full" />
            </template>
            <template v-else-if="alertasEcolume.length">
              <RouterLink
                v-for="alerta in alertasEcolume"
                :key="alerta.id"
                :to="alerta.link ?? '/app/agenda'"
                :class="
                  cn(
                    'block rounded-md border px-3 py-2.5 transition-[border-color,background-color] hover:border-dourado/70',
                    corGravidade[alerta.gravidade],
                  )
                "
                data-testid="dashboard-alerta"
              >
                <p class="flex items-center gap-1.5 text-sm font-medium">
                  <Clock class="size-3.5" />
                  {{ alerta.titulo }}
                </p>
              </RouterLink>
            </template>
            <p v-else class="py-6 text-center text-sm text-texto-secundario">
              Nada pendente. Bom trabalho!
            </p>
            <RouterLink
              to="/app/agenda"
              class="mt-2 flex items-center gap-1 text-sm text-dourado-hover hover:underline"
            >
              Abrir agenda <ChevronRight class="size-4" />
            </RouterLink>
          </CardContent>
        </Card>
      </div>

      <Card v-if="temFinanceiro && parceiros.length" data-testid="dashboard-parceiros">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <ShoppingBag class="size-4" />
            Vendas por parceiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="text-xs text-texto-secundario">
                <tr>
                  <th class="pb-2 font-medium">Parceiro</th>
                  <th class="pb-2 font-medium">Tipo</th>
                  <th class="pb-2 text-right font-medium">Pedidos</th>
                  <th class="pb-2 text-right font-medium">Vendido</th>
                  <th v-if="parceiros[0]?.comissaoGerada != null" class="pb-2 text-right font-medium">
                    Comissão
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in parceiros"
                  :key="String(p.parceiroId)"
                  class="border-t border-borda"
                >
                  <td class="py-2 font-medium text-texto">{{ p.nome }}</td>
                  <td class="py-2 text-texto-secundario">{{ p.tipoParceiro ?? '—' }}</td>
                  <td class="py-2 text-right">{{ formatarNumero(p.quantidadePedidos as number) }}</td>
                  <td class="py-2 text-right">{{ formatarMoeda(p.valorVendido as number) }}</td>
                  <td v-if="p.comissaoGerada != null" class="py-2 text-right">
                    {{ formatarMoeda(p.comissaoGerada as number) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </template>

    <!-- ——— LEGADO ——— -->
    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoMetrica
          rotulo="Novos negócios"
          :valor="formatarNumero(oportunidades?.novasNoPeriodo)"
          :icone="TrendingUp"
          :ajuda="m ? `${formatarNumero(contatosNovos)} pessoas novas` : undefined"
          :carregando="carregando"
        />
        <CartaoMetrica
          rotulo="Negócios ganhos"
          :valor="formatarNumero(oportunidades?.ganhasNoPeriodo)"
          :icone="Trophy"
          :ajuda="ajudaGanhos"
          :carregando="carregando"
          destaque
        />
        <CartaoMetrica
          rotulo="Ticket médio ganho"
          :valor="formatarMoeda(oportunidades?.ticketMedioGanho)"
          :icone="Wallet"
          :ajuda="oportunidades ? `${formatarNumero(oportunidades.abertas)} negócios no funil` : undefined"
          :carregando="carregando"
        />
        <CartaoMetrica
          rotulo="Conversas ativas"
          :valor="formatarNumero(conversasAtivas)"
          :icone="MessagesSquare"
          :ajuda="ajudaConversas"
          :carregando="carregando"
        />
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <Card class="lg:col-span-2">
          <CardHeader class="flex-row items-center justify-between">
            <CardTitle>Negócios por etapa</CardTitle>
            <RouterLink
              to="/app/pipeline"
              class="flex items-center gap-1 text-sm text-dourado-hover hover:underline"
            >
              Ver negócios <ChevronRight class="size-4" />
            </RouterLink>
          </CardHeader>
          <CardContent>
            <Skeleton v-if="carregando" class="h-72 w-full" />
            <GraficoFunil v-else :dados="funil" />
          </CardContent>
        </Card>

        <div class="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <AlertTriangle class="size-4 text-alerta" />
                Precisa da sua atenção
              </CardTitle>
            </CardHeader>
            <CardContent class="space-y-2.5">
              <template v-if="carregando">
                <Skeleton v-for="n in 3" :key="n" class="h-16 w-full" />
              </template>
              <template v-else-if="alertasLegado.length">
                <component
                  :is="alerta.link ? RouterLink : 'div'"
                  v-for="alerta in alertasLegado"
                  :key="alerta.id"
                  :to="alerta.link ?? undefined"
                  :class="
                    cn(
                      'block rounded-md border px-3 py-2.5 transition-[border-color,background-color]',
                      corGravidade[alerta.gravidade],
                      alerta.link && 'hover:border-dourado/70',
                    )
                  "
                >
                  <p class="flex items-center gap-1.5 text-sm font-medium">
                    <Clock class="size-3.5" />
                    {{ alerta.titulo }}
                  </p>
                  <p class="mt-0.5 text-xs opacity-80">{{ alerta.descricao }}</p>
                </component>
              </template>
              <p v-else class="py-6 text-center text-sm text-texto-secundario">
                Nada pendente. Bom trabalho!
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resultado no período</CardTitle>
            </CardHeader>
            <CardContent>
              <dl v-if="carregando" class="space-y-3">
                <Skeleton v-for="n in 3" :key="n" class="h-10 w-full" />
              </dl>
              <dl v-else class="space-y-3 text-sm">
                <div class="flex items-center justify-between gap-3">
                  <dt class="flex items-center gap-2 text-texto-secundario">
                    <Trophy class="size-3.5 text-dourado-hover" />
                    Fechado
                  </dt>
                  <dd class="text-right font-medium text-texto">
                    {{ formatarNumero(oportunidades?.ganhasNoPeriodo) }}
                    <span class="ml-2 text-xs font-normal text-texto-secundario">
                      {{ formatarMoeda(oportunidades?.valorGanhoNoPeriodo) }}
                    </span>
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <dt class="flex items-center gap-2 text-texto-secundario">
                    <Ban class="size-3.5" />
                    Perdido
                  </dt>
                  <dd class="font-medium text-texto">
                    {{ formatarNumero(oportunidades?.perdidasNoPeriodo) }}
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-3 border-t border-borda pt-3">
                  <dt class="text-texto-secundario">Ticket médio ganho</dt>
                  <dd class="font-medium text-texto">
                    {{ formatarMoeda(oportunidades?.ticketMedioGanho) }}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <RouterLink
          to="/app/contatos"
          class="superficie-interativa flex items-center gap-3 rounded-md border border-borda bg-branco p-4"
        >
          <span class="grid size-10 place-items-center rounded-md bg-marfim text-dourado-hover">
            <Users class="size-5" />
          </span>
          <span>
            <span class="block text-xs text-texto-secundario">Pessoas novas</span>
            <span class="text-lg font-semibold text-texto">{{ formatarNumero(contatosNovos) }}</span>
          </span>
        </RouterLink>
        <RouterLink
          to="/app/conversas"
          class="superficie-interativa flex items-center gap-3 rounded-md border border-borda bg-branco p-4"
        >
          <span class="grid size-10 place-items-center rounded-md bg-marfim text-dourado-hover">
            <MessagesSquare class="size-5" />
          </span>
          <span>
            <span class="block text-xs text-texto-secundario">Conversas ativas</span>
            <span class="text-lg font-semibold text-texto">{{ formatarNumero(conversasAtivas) }}</span>
          </span>
        </RouterLink>
        <RouterLink
          to="/app/pipeline"
          class="superficie-interativa flex items-center gap-3 rounded-md border border-borda bg-branco p-4"
        >
          <span class="grid size-10 place-items-center rounded-md bg-marfim text-dourado-hover">
            <Wallet class="size-5" />
          </span>
          <span>
            <span class="block text-xs text-texto-secundario">Negócios abertos</span>
            <span class="text-lg font-semibold text-texto">{{ formatarNumero(oportunidades?.abertas) }}</span>
          </span>
        </RouterLink>
      </div>
    </template>
  </div>
</template>
