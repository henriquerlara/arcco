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

const cores: Record<string, string> = {
  GANHA: '#39785e',
  PERDIDA: '#a84945',
  ABERTA: '#0d4a51',
};

const opcao = computed<EChartsOption>(() => {
  const categorias = props.dados.map((p) => p.etapa);
  return {
    grid: { left: 8, right: 48, top: 12, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#073b42',
      borderColor: '#0d4a51',
      textStyle: { color: '#f1ede4' },
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
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#d8d2c7' } },
      axisLabel: { color: '#687473' },
    },
    yAxis: {
      type: 'category',
      data: categorias,
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#12383b', fontWeight: 500 },
    },
    series: [
      {
        type: 'bar',
        data: props.dados.map((p) => {
          const tom = cores[p.tipo ?? 'ABERTA'] ?? '#0d4a51';
          return {
            value: p.total,
            itemStyle: {
              borderRadius: [0, 6, 6, 0],
              color: tom,
            },
          };
        }),
        barWidth: 18,
        label: { show: true, position: 'right', color: '#687473' },
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
    Sem oportunidades no funil.
  </div>
</template>
