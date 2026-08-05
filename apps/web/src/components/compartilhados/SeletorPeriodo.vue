<script setup lang="ts">
import { computed } from 'vue';
import { subDays, startOfMonth, startOfDay, formatISO } from 'date-fns';
import Select from '@/components/ui/Select.vue';

export interface Periodo {
  chave: string;
  de?: string;
  ate?: string;
}

const props = defineProps<{ modelValue: Periodo }>();
const emit = defineEmits<{ (e: 'update:modelValue', valor: Periodo): void }>();

const opcoes = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7d', rotulo: 'Últimos 7 dias' },
  { valor: '30d', rotulo: 'Últimos 30 dias' },
  { valor: 'mes', rotulo: 'Este mês' },
];

function calcular(chave: string): Periodo {
  const agora = new Date();
  const ate = formatISO(agora);
  switch (chave) {
    case 'hoje':
      return { chave, de: formatISO(startOfDay(agora)), ate };
    case '7d':
      return { chave, de: formatISO(startOfDay(subDays(agora, 7))), ate };
    case '30d':
      return { chave, de: formatISO(startOfDay(subDays(agora, 30))), ate };
    case 'mes':
      return { chave, de: formatISO(startOfMonth(agora)), ate };
    default:
      return { chave, de: formatISO(startOfDay(subDays(agora, 30))), ate };
  }
}

const chave = computed({
  get: () => props.modelValue.chave,
  set: (v: string) => emit('update:modelValue', calcular(v)),
});
</script>

<template>
  <Select v-model="chave" :opcoes="opcoes" class="w-48" />
</template>
