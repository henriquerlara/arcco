<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { RouterLink } from 'vue-router';
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
} from 'lucide-vue-next';
import CartaoMetrica from '@/components/compartilhados/CartaoMetrica.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import SeletorPeriodo, { type Periodo } from '@/components/compartilhados/SeletorPeriodo.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import GraficoFunil from './GraficoFunil.vue';
import { servicoDashboard } from '@/services';
import type { AlertaDashboard, PontoFunil } from '@/types';
import { formatarMoeda, formatarPercentual, formatarNumero } from '@/composables/formatadores';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import { cn } from '@/composables/cn';

const auth = useAutenticacaoStore();
const periodo = ref<Periodo>({ chave: '30d' });

const filtros = computed(() => ({ de: periodo.value.de, ate: periodo.value.ate }));

const metricasQuery = useQuery({
  queryKey: computed(() => ['dashboard', 'metricas', filtros.value]),
  queryFn: () => servicoDashboard.metricas(filtros.value),
});

const m = computed(() => metricasQuery.data.value);
const carregando = computed(() => metricasQuery.isLoading.value);

const conversasAtivas = computed(() => {
  const c = m.value?.conversas;
  if (!c) return undefined;
  return c.aguardandoHumano + c.emAtendimento + c.botAtendendo;
});

const ajudaConversas = computed(() => {
  const c = m.value?.conversas;
  if (!c) return '';
  return `${formatarNumero(c.aguardandoHumano)} aguardando · ${formatarNumero(c.emAtendimento)} com você`;
});

const ajudaGanhos = computed(() => {
  const op = m.value?.oportunidades;
  if (!op) return '';
  const conversao = formatarPercentual((op.taxaConversao ?? 0) * 100);
  if (op.valorGanhoNoPeriodo) {
    return `${formatarMoeda(op.valorGanhoNoPeriodo)} · ${conversao} de conversão`;
  }
  return `${conversao} de conversão`;
});

const funil = computed<PontoFunil[]>(() =>
  (m.value?.funil ?? []).map((p) => ({
    etapa: p.nome,
    total: p.quantidade,
    valor: p.valor,
    tipo: p.tipo,
  })),
);

const alertas = computed<AlertaDashboard[]>(() => {
  const lista: AlertaDashboard[] = [];
  const aguardando = m.value?.conversas.aguardandoHumano ?? 0;
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
  const paradas = m.value?.oportunidades.paradas ?? 0;
  if (paradas > 0) {
    lista.push({
      id: 'oportunidades-paradas',
      tipo: 'oportunidade_parada',
      titulo: `${paradas} negócio(s) parado(s)`,
      descricao: 'Sem movimentação há mais de 7 dias.',
      link: '/app/pipeline',
      gravidade: 'info',
    });
  }
  const estoqueCriticos = m.value?.estoque?.criticos ?? 0;
  if (estoqueCriticos > 0) {
    lista.push({
      id: 'estoque-critico',
      tipo: 'estoque_critico',
      titulo: `${estoqueCriticos} produto(s) com estoque baixo`,
      descricao:
        (m.value?.estoque?.zerados ?? 0) > 0
          ? `${m.value!.estoque!.zerados} zerado(s). Reponha antes de fechar vendas.`
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
          <p class="rotulo-editorial text-dourado-claro/70">Operação · agora</p>
          <h1 class="fonte-marca mt-2 text-3xl leading-none md:text-4xl">
            Olá, {{ auth.usuario?.nome?.split(' ')[0] ?? '' }}
          </h1>
          <p class="mt-3 max-w-lg text-sm text-marfim/55">
            O que o comercial precisa resolver hoje — conversas, funil e dinheiro em jogo.
          </p>
        </div>
        <div class="flex flex-col items-start gap-3 sm:items-end">
          <SeletorPeriodo v-model="periodo" />
          <div v-if="!carregando" class="text-left sm:text-right">
            <p class="rotulo-editorial text-marfim/40">Em aberto no funil</p>
            <p class="fonte-marca mt-1 text-2xl text-dourado-claro md:text-3xl">
              {{ formatarMoeda(m?.oportunidades.valorPipeline) }}
            </p>
          </div>
          <Skeleton v-else class="h-12 w-40 bg-white/10" />
        </div>
      </div>
    </header>

    <EstadoErro
      v-if="metricasQuery.isError.value"
      :erro="metricasQuery.error.value"
      @tentar-novamente="metricasQuery.refetch()"
    />

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoMetrica
          rotulo="Novas oportunidades"
          :valor="formatarNumero(m?.oportunidades.novasNoPeriodo)"
          :icone="TrendingUp"
          :ajuda="m ? `${formatarNumero(m.contatos.novosNoPeriodo)} pessoas novas` : undefined"
          :carregando="carregando"
        />
        <CartaoMetrica
          rotulo="Negócios ganhos"
          :valor="formatarNumero(m?.oportunidades.ganhasNoPeriodo)"
          :icone="Trophy"
          :ajuda="ajudaGanhos"
          :carregando="carregando"
          destaque
        />
        <CartaoMetrica
          rotulo="Ticket médio ganho"
          :valor="formatarMoeda(m?.oportunidades.ticketMedioGanho)"
          :icone="Wallet"
          :ajuda="m ? `${formatarNumero(m.oportunidades.abertas)} negócios no funil` : undefined"
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
            <CardTitle>Oportunidades por etapa</CardTitle>
            <RouterLink
              to="/app/pipeline"
              class="flex items-center gap-1 text-sm text-dourado-hover hover:underline"
            >
              Ver pipeline <ChevronRight class="size-4" />
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
              <template v-else-if="alertas.length">
                <component
                  :is="alerta.link ? RouterLink : 'div'"
                  v-for="alerta in alertas"
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
                    {{ formatarNumero(m?.oportunidades.ganhasNoPeriodo) }}
                    <span class="ml-2 text-xs font-normal text-texto-secundario">
                      {{ formatarMoeda(m?.oportunidades.valorGanhoNoPeriodo) }}
                    </span>
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <dt class="flex items-center gap-2 text-texto-secundario">
                    <Ban class="size-3.5" />
                    Perdido
                  </dt>
                  <dd class="font-medium text-texto">
                    {{ formatarNumero(m?.oportunidades.perdidasNoPeriodo) }}
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-3 border-t border-borda pt-3">
                  <dt class="text-texto-secundario">Ticket médio ganho</dt>
                  <dd class="font-medium text-texto">
                    {{ formatarMoeda(m?.oportunidades.ticketMedioGanho) }}
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
            <span class="text-lg font-semibold text-texto">{{ formatarNumero(m?.contatos.novosNoPeriodo) }}</span>
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
            <span class="text-lg font-semibold text-texto">{{ formatarNumero(m?.oportunidades.abertas) }}</span>
          </span>
        </RouterLink>
      </div>
    </template>
  </div>
</template>
