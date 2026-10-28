<script setup lang="ts">
import { computed } from 'vue';
import {
  chaveDataLocal,
  diasDaSemana,
  diasGradeMes,
  rotuloHorarioAgenda,
} from '@arcco/contratos';
import type { Atividade } from '@/types';
import { corTipoAtividade } from '@/composables/agenda-cores';
import { cn } from '@/composables/cn';

const props = defineProps<{
  modo: 'semana' | 'mes';
  ancora: Date;
  atividades: Atividade[];
}>();

const emit = defineEmits<{
  selecionar: [ativ: Atividade];
}>();

const hojeChave = chaveDataLocal(new Date());

const porDia = computed(() => {
  const mapa = new Map<string, Atividade[]>();
  for (const a of props.atividades) {
    const k = chaveDataLocal(new Date(a.vencimento));
    const lista = mapa.get(k) ?? [];
    lista.push(a);
    mapa.set(k, lista);
  }
  for (const [, lista] of mapa) {
    lista.sort((x, y) => {
      const px = x.diaInteiro || x.periodoDia ? 0 : 1;
      const py = y.diaInteiro || y.periodoDia ? 0 : 1;
      if (px !== py) return px - py;
      return new Date(x.vencimento).getTime() - new Date(y.vencimento).getTime();
    });
  }
  return mapa;
});

const diasSemana = computed(() => diasDaSemana(props.ancora));
const gradeMes = computed(() => diasGradeMes(props.ancora));
const mesAncora = computed(() => props.ancora.getMonth());

const NOMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function eventosDoDia(d: Date) {
  return porDia.value.get(chaveDataLocal(d)) ?? [];
}

function rotulo(a: Atividade) {
  return rotuloHorarioAgenda({
    vencimento: a.vencimento,
    diaInteiro: a.diaInteiro,
    periodoDia: a.periodoDia,
  });
}
</script>

<template>
  <div class="space-y-2">
    <!-- Semana -->
    <div v-if="modo === 'semana'" class="overflow-x-auto rounded-md border border-borda bg-branco">
      <div class="grid min-w-[640px] grid-cols-7 divide-x divide-borda">
        <div
          v-for="(dia, i) in diasSemana"
          :key="chaveDataLocal(dia)"
          class="min-h-[220px] bg-branco"
        >
          <div
            :class="
              cn(
                'border-b border-borda px-2 py-1.5 text-center text-xs font-semibold',
                chaveDataLocal(dia) === hojeChave ? 'bg-marfim text-dourado-hover' : 'text-texto-secundario',
              )
            "
          >
            {{ NOMES[i] }}
            <span class="ml-1 text-texto">{{ dia.getDate() }}</span>
          </div>
          <ul class="space-y-1 p-1.5">
            <li v-for="ativ in eventosDoDia(dia)" :key="ativ.id">
              <button
                type="button"
                class="w-full rounded px-1.5 py-1 text-left text-[11px] leading-snug text-branco hover:opacity-90"
                :style="{ backgroundColor: corTipoAtividade(ativ.tipo) }"
                :class="ativ.concluida ? 'opacity-55 line-through' : ''"
                :title="ativ.titulo"
                @click="emit('selecionar', ativ)"
              >
                <span class="block font-medium truncate">{{ ativ.titulo }}</span>
                <span class="block opacity-90">{{ rotulo(ativ) }}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Mês -->
    <div v-else class="overflow-x-auto rounded-md border border-borda bg-branco">
      <div class="grid min-w-[640px] grid-cols-7 border-b border-borda bg-marfim/60">
        <div
          v-for="n in NOMES"
          :key="n"
          class="px-1 py-1.5 text-center text-[11px] font-semibold text-texto-secundario"
        >
          {{ n }}
        </div>
      </div>
      <div class="grid min-w-[640px] grid-cols-7 auto-rows-[minmax(88px,1fr)]">
        <div
          v-for="dia in gradeMes"
          :key="chaveDataLocal(dia)"
          :class="
            cn(
              'border-b border-r border-borda p-1',
              dia.getMonth() !== mesAncora ? 'bg-marfim/40 text-texto-secundario' : 'bg-branco',
              chaveDataLocal(dia) === hojeChave && 'ring-1 ring-inset ring-dourado/50',
            )
          "
        >
          <div class="mb-0.5 text-right text-[11px] font-medium">{{ dia.getDate() }}</div>
          <ul class="max-h-28 space-y-0.5 overflow-y-auto">
            <li v-for="ativ in eventosDoDia(dia)" :key="ativ.id">
              <button
                type="button"
                class="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] text-branco"
                :style="{ backgroundColor: corTipoAtividade(ativ.tipo) }"
                :class="ativ.concluida ? 'opacity-55 line-through' : ''"
                :title="`${rotulo(ativ)} · ${ativ.titulo}`"
                @click="emit('selecionar', ativ)"
              >
                <span class="truncate">{{ ativ.titulo }}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
