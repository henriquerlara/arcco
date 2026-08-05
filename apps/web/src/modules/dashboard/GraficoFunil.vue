<script setup lang="ts">
import { computed } from 'vue';
import { use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';
import type { EChartsOption } from 'echarts';
import type { PontoFunil } from '@/types';
import { formatarMoeda } from '@/composables/formatadores';

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const props = defineProps<{ dados: PontoFunil[] }>();

const opcao = computed<EChartsOption>(() => {
  const categorias = props.dados.map((p) => p.etapa);
  const totais = props.dados.map((p) => p.total);
  return {
    grid: { left: 8, right: 24, top: 12, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#151513',
      borderColor: '#22211e',
      textStyle: { color: '#F4F1E9' },
      formatter: (params: unknown) => {
        const arr = params as { dataIndex: number; name: string; value: number }[];
        const item = arr[0];
        if (!item) return '';
        const ponto = props.dados[item.dataIndex];
        return `<strong>${item.name}</strong><br/>${item.value} oportunidade(s)<br/>${formatarMoeda(
          ponto?.valor ?? 0,
        )}`;
      },
    },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#DDD8CE' } },
      axisLabel: { color: '#6F6A61' },
    },
    yAxis: {
      type: 'category',
      data: categorias,
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#1A1917', fontWeight: 500 },
    },
    series: [
      {
        type: 'bar',
        data: totais,
        barWidth: 18,
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: '#E4CC8B' },
              { offset: 1, color: '#C7A454' },
            ],
          },
        },
        label: { show: true, position: 'right', color: '#6F6A61' },
      },
    ],
  };
});
</script>

<template>
  <VChart
    v-if="dados.length"
    :option="opcao"
    autoresize
    class="h-72 w-full"
  />
  <div
    v-else
    class="flex h-72 items-center justify-center text-sm text-texto-secundario"
  >
    Sem dados no período selecionado.
  </div>
</template>
