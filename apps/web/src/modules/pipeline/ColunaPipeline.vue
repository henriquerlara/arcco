<script setup lang="ts">
import { computed } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import type { EtapaFunil, Oportunidade } from '@/types';
import CartaoOportunidade from './CartaoOportunidade.vue';
import { formatarMoeda } from '@/composables/formatadores';

const props = defineProps<{
  etapa: EtapaFunil;
  oportunidades: Oportunidade[];
}>();

const emit = defineEmits<{
  (e: 'abrir', id: string): void;
  (e: 'mover', payload: { oportunidadeId: string; etapaId: string }): void;
}>();

const lista = computed({
  get: () => props.oportunidades,
  set: () => {
    /* controlado pelo pai via eventos de add */
  },
});

const total = computed(() =>
  props.oportunidades.reduce((s, o) => s + (o.valorEstimado ?? 0), 0),
);

const corTopo = computed(() => {
  if (props.etapa.tipo === 'GANHA') return 'bg-sucesso';
  if (props.etapa.tipo === 'PERDIDA') return 'bg-erro';
  return 'bg-dourado';
});

function aoAdicionar(evento: { data: Oportunidade }) {
  emit('mover', { oportunidadeId: evento.data.id, etapaId: props.etapa.id });
}
</script>

<template>
  <div class="flex w-72 shrink-0 flex-col rounded-lg border border-borda bg-marfim/50">
    <header class="flex items-center justify-between gap-2 border-b border-borda px-3 py-2.5">
      <div class="flex items-center gap-2">
        <span class="size-2 rounded-full" :class="corTopo" />
        <h3 class="text-sm font-semibold text-texto">{{ etapa.nome }}</h3>
        <span
          class="rounded-full bg-branco px-1.5 py-0.5 text-xs font-medium text-texto-secundario"
        >
          {{ oportunidades.length }}
        </span>
      </div>
    </header>

    <p class="px-3 pt-2 text-xs text-texto-secundario">{{ formatarMoeda(total) }}</p>

    <VueDraggable
      v-model="lista"
      :group="{ name: 'pipeline', pull: true, put: true }"
      :animation="160"
      item-key="id"
      ghost-class="opacity-40"
      class="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-2"
      @add="aoAdicionar"
    >
      <CartaoOportunidade
        v-for="op in oportunidades"
        :key="op.id"
        :oportunidade="op"
        @abrir="(id) => emit('abrir', id)"
      />
    </VueDraggable>
  </div>
</template>
