<script setup lang="ts">
import { computed } from 'vue';
import { subDays, startOfMonth, startOfDay, formatISO } from 'date-fns';
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'radix-vue';
import { Check, ChevronDown } from 'lucide-vue-next';

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
  <SelectRoot v-model="chave">
    <SelectTrigger
      class="group inline-flex h-9 items-center gap-2 rounded-md border border-marfim/15 bg-white/[0.04] px-3 text-left text-sm text-marfim/80 outline-none transition-[border-color,background-color,color] hover:border-marfim/30 hover:bg-white/[0.07] hover:text-marfim focus:border-dourado-claro/45 focus:bg-white/[0.07] focus:ring-1 focus:ring-dourado/20 data-[state=open]:border-dourado-claro/40 data-[state=open]:bg-white/[0.08]"
      aria-label="Período do dashboard"
    >
      <SelectValue placeholder="Período" />
      <SelectIcon as-child>
        <ChevronDown
          class="size-3.5 shrink-0 text-marfim/40 transition-transform duration-200 group-data-[state=open]:rotate-180 group-data-[state=open]:text-dourado-claro/70"
        />
      </SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="6"
        align="end"
        class="z-50 min-w-[11.5rem] overflow-hidden rounded-md border border-borda/80 bg-branco shadow-flutuante animate-fade-in"
      >
        <SelectViewport class="p-1">
          <SelectItem
            v-for="opcao in opcoes"
            :key="opcao.valor"
            :value="opcao.valor"
            class="relative flex cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-3 text-sm text-texto outline-none data-[highlighted]:bg-marfim data-[state=checked]:font-semibold"
          >
            <span class="absolute left-2 flex size-4 items-center justify-center">
              <SelectItemIndicator>
                <Check class="size-3.5 text-carvao" />
              </SelectItemIndicator>
            </span>
            <SelectItemText>{{ opcao.rotulo }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
