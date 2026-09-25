<script setup lang="ts">
import type { Conversa } from '@/types';
import BadgeStatus from '@/components/compartilhados/BadgeStatus.vue';
import Badge from '@/components/ui/Badge.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import { iniciais, tempoRelativo, formatarTelefone } from '@/composables/formatadores';
import { cn } from '@/composables/cn';

const ROTULO_INTENCAO: Record<string, string> = {
  VENDAS: 'Vendas',
  NOVO_ORCAMENTO: 'Novo orçamento',
  NEGOCIAR_ORCAMENTO: 'Negociar',
  AJUSTAR_ORCAMENTO: 'Ajuste',
  FINANCEIRO: 'Financeiro',
  ENTREGA: 'Entrega',
  SAC: 'SAC',
  POS_VENDA: 'Pós-venda',
  FALAR_COM_PESSOA: 'Humano',
  DUVIDA: 'Dúvida',
  ACOMPANHAR_SOLICITACAO: 'Acompanhar',
  OUTRO: 'Outro',
};

function rotuloIntencao(valor?: string | null): string | null {
  if (!valor) return null;
  return ROTULO_INTENCAO[valor] ?? valor;
}

defineProps<{
  conversas: Conversa[];
  selecionadaId?: string | null;
  carregando?: boolean;
}>();

const emit = defineEmits<{ (e: 'selecionar', id: string): void }>();
</script>

<template>
  <div class="flex h-full flex-col divide-y divide-borda overflow-y-auto">
    <template v-if="carregando">
      <div v-for="n in 6" :key="n" class="flex items-center gap-3 p-3">
        <Skeleton class="size-10 rounded-full" />
        <div class="flex-1 space-y-2">
          <Skeleton class="h-3.5 w-32" />
          <Skeleton class="h-3 w-48" />
        </div>
      </div>
    </template>

    <button
      v-for="conversa in conversas"
      v-else
      :key="conversa.id"
      :class="
        cn(
          'relative flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-marfim/60',
          selecionadaId === conversa.id && 'bg-marfim before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:bg-carvao',
        )
      "
      @click="emit('selecionar', conversa.id)"
    >
      <div class="relative">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-full bg-carvao text-sm font-semibold text-dourado-claro"
        >
          {{ iniciais(conversa.nomeExibicao ?? conversa.contato?.nome ?? conversa.telefone) }}
        </span>
        <span
          v-if="conversa.naoLidas"
          class="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-erro px-1 text-[10px] font-semibold text-branco"
        >
          {{ conversa.naoLidas }}
        </span>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between gap-2">
          <p class="truncate text-sm font-medium text-texto">
            {{ conversa.nomeExibicao ?? conversa.contato?.nome ?? formatarTelefone(conversa.telefone) }}
          </p>
          <span class="shrink-0 text-[11px] text-texto-secundario">
            {{ tempoRelativo(conversa.ultimaMensagemEm) }}
          </span>
        </div>
        <p class="mt-0.5 truncate text-xs text-texto-secundario">
          {{ conversa.ultimaMensagem ?? conversa.ultimaMensagemPreview ?? 'Sem mensagens' }}
        </p>
        <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
          <BadgeStatus familia="statusConversa" :valor="conversa.status" />
          <BadgeStatus familia="modoAtendimento" :valor="conversa.modo" />
          <Badge v-if="rotuloIntencao(conversa.intencaoAtual ?? conversa.intencao)" variante="neutro">
            {{ rotuloIntencao(conversa.intencaoAtual ?? conversa.intencao) }}
          </Badge>
        </div>
      </div>
    </button>
  </div>
</template>
