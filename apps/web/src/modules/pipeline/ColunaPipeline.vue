<script setup lang="ts">
import { computed } from 'vue';
import type { EtapaFunil, Oportunidade } from '@/types';
import CartaoOportunidade from './CartaoOportunidade.vue';
import { formatarMoeda } from '@/composables/formatadores';

const props = defineProps<{
  etapa: EtapaFunil;
  oportunidades: Oportunidade[];
}>();

const emit = defineEmits<{
  (e: 'abrir', id: string): void;
  (e: 'enviar-orcamento', id: string): void;
}>();

const total = computed(() =>
  props.oportunidades.reduce((s, o) => s + (o.valorEstimado ?? 0), 0),
);

const ehEtapaOrcamento = computed(() => props.etapa.chaveSistema === 'QUALIFICACAO');

const ehForaDoFunil = computed(
  () => props.etapa.id === '__fora_do_funil__' || props.etapa.ativo === false,
);

const corTopo = computed(() => {
  if (ehForaDoFunil.value) return 'bg-texto-secundario';
  if (props.etapa.tipo === 'GANHA') return 'bg-sucesso';
  if (props.etapa.tipo === 'PERDIDA') return 'bg-erro';
  return 'bg-dourado';
});
</script>

<template>
  <div
    class="flex min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-md border bg-marfim/45"
    :class="ehForaDoFunil ? 'border-borda border-dashed' : 'border-borda/80'"
  >
    <header class="flex items-center justify-between gap-2 border-b border-borda/70 bg-branco/70 px-3 py-3.5 backdrop-blur-sm sm:px-4">
      <div class="flex min-w-0 items-center gap-2">
        <span class="h-4 w-1 shrink-0" :class="corTopo" />
        <h3 class="truncate text-sm font-semibold text-texto">{{ etapa.nome }}</h3>
        <span
          class="shrink-0 rounded-sm border border-borda/70 bg-marfim px-2 py-0.5 text-[10px] font-bold text-texto-secundario"
        >
          {{ oportunidades.length }}
        </span>
      </div>
    </header>

    <p class="px-3 pt-3 text-xs font-medium text-texto-secundario sm:px-4">
      {{ formatarMoeda(total) }}
      <span v-if="ehEtapaOrcamento" class="mt-0.5 block text-[11px] text-dourado-hover">
        Envie o orçamento pelo cartão para avançar
      </span>
      <span v-else-if="ehForaDoFunil" class="mt-0.5 block text-[11px] text-texto-secundario">
        Etapa desativada — abra o card e mova para uma etapa ativa
      </span>
    </p>

    <div class="flex min-h-[140px] flex-1 flex-col gap-3 overflow-y-auto p-2.5 sm:p-3">
      <CartaoOportunidade
        v-for="op in oportunidades"
        :key="op.id"
        :oportunidade="op"
        :destacar-envio-orcamento="ehEtapaOrcamento"
        @abrir="(id) => emit('abrir', id)"
        @enviar-orcamento="(id) => emit('enviar-orcamento', id)"
      />
    </div>
  </div>
</template>
