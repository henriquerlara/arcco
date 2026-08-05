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
} from 'lucide-vue-next';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
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

// Funil derivado da resposta de métricas (não há endpoint dedicado).
const funil = computed<PontoFunil[]>(() =>
  (m.value?.funil ?? []).map((p) => ({
    etapa: p.nome,
    total: p.quantidade,
    valor: p.valor,
  })),
);

// Alertas construídos no cliente a partir das métricas.
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
    <CabecalhoPagina
      :titulo="`Olá, ${auth.usuario?.nome?.split(' ')[0] ?? ''}`"
      descricao="Visão geral do seu comercial."
      usar-serif
    >
      <template #acoes>
        <SeletorPeriodo v-model="periodo" />
      </template>
    </CabecalhoPagina>

    <EstadoErro
      v-if="metricasQuery.isError.value"
      :erro="metricasQuery.error.value"
      @tentar-novamente="metricasQuery.refetch()"
    />

    <template v-else>
      <!-- Métricas -->
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoMetrica
          rotulo="Novas oportunidades"
          :valor="formatarNumero(m?.oportunidades.novasNoPeriodo)"
          :icone="TrendingUp"
          :carregando="carregando"
        />
        <CartaoMetrica
          rotulo="Negócios ganhos"
          :valor="formatarNumero(m?.oportunidades.ganhasNoPeriodo)"
          :icone="Trophy"
          :ajuda="`${formatarPercentual(m?.oportunidades.taxaConversao)} de conversão`"
          :carregando="carregando"
          destaque
        />
        <CartaoMetrica
          rotulo="Valor em aberto"
          :valor="formatarMoeda(m?.oportunidades.valorPipeline)"
          :icone="Wallet"
          :carregando="carregando"
        />
        <CartaoMetrica
          rotulo="Conversas ativas"
          :valor="formatarNumero(conversasAtivas)"
          :icone="MessagesSquare"
          :carregando="carregando"
        />
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <!-- Funil -->
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

        <!-- Alertas -->
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
                    'block rounded-md border px-3 py-2.5 transition-colors',
                    corGravidade[alerta.gravidade],
                    alerta.link && 'hover:brightness-95',
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
      </div>
    </template>
  </div>
</template>
