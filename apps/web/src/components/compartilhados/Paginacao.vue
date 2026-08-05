<script setup lang="ts">
import { computed } from 'vue';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import type { Paginacao } from '@/types';

const props = defineProps<{ paginacao: Paginacao }>();
const emit = defineEmits<{ (e: 'mudar', pagina: number): void }>();

const inicio = computed(
  () => (props.paginacao.pagina - 1) * props.paginacao.porPagina + 1,
);
const fim = computed(() =>
  Math.min(props.paginacao.pagina * props.paginacao.porPagina, props.paginacao.total),
);
</script>

<template>
  <div
    v-if="paginacao.total > 0"
    class="flex flex-col items-center justify-between gap-3 border-t border-borda px-4 py-3 text-sm text-texto-secundario sm:flex-row"
  >
    <p>
      Mostrando <span class="font-medium text-texto">{{ inicio }}</span>–<span
        class="font-medium text-texto"
        >{{ fim }}</span
      >
      de <span class="font-medium text-texto">{{ paginacao.total }}</span>
    </p>
    <div class="flex items-center gap-2">
      <Button
        variante="secundario"
        tamanho="sm"
        :disabled="paginacao.pagina <= 1"
        @click="emit('mudar', paginacao.pagina - 1)"
      >
        <ChevronLeft class="size-4" />
        Anterior
      </Button>
      <span class="px-1">
        {{ paginacao.pagina }} / {{ paginacao.totalPaginas }}
      </span>
      <Button
        variante="secundario"
        tamanho="sm"
        :disabled="paginacao.pagina >= paginacao.totalPaginas"
        @click="emit('mudar', paginacao.pagina + 1)"
      >
        Próxima
        <ChevronRight class="size-4" />
      </Button>
    </div>
  </div>
</template>
