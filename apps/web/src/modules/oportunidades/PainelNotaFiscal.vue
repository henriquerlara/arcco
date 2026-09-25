<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { FileSpreadsheet, RefreshCw, Send } from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import { servicoNotasFiscais } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import type { NotaFiscal, StatusNotaFiscal } from '@/types';

const props = defineProps<{
  oportunidadeId: string;
  orcamentoId: string | null;
  orcamentoConvertido: boolean;
  /** Rascunho/enviado/aceito com itens — vira final no Fechado sem WhatsApp. */
  orcamentoElegivel?: boolean;
  oportunidadeGanha: boolean;
}>();

const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();
const emitindo = ref(false);
const sincronizandoId = ref<string | null>(null);

const podeEmitir = computed(() => {
  if (!props.oportunidadeGanha || !props.orcamentoId) return false;
  return (
    props.orcamentoConvertido ||
    props.orcamentoElegivel
  );
});

const { data: notas, isLoading, refetch } = useQuery({
  queryKey: computed(() => ['notas-fiscais', props.oportunidadeId]),
  queryFn: () => servicoNotasFiscais.listarPorOportunidade(props.oportunidadeId),
  enabled: computed(() => Boolean(props.oportunidadeId)),
});

const lista = computed(() => notas.value ?? []);
const ultima = computed(() => lista.value[0] ?? null);

const rotuloStatus: Record<StatusNotaFiscal, string> = {
  RASCUNHO: 'Rascunho',
  PROCESSANDO: 'Processando',
  AUTORIZADA: 'Autorizada',
  REJEITADA: 'Rejeitada',
  CANCELADA: 'Cancelada',
};

function ehSimulacao(nf: NotaFiscal): boolean {
  return Boolean(nf.respostaFocus?._mock);
}

function rotuloNota(nf: NotaFiscal): string {
  const base = rotuloStatus[nf.status];
  return ehSimulacao(nf) ? `${base} (simulação)` : base;
}

function varianteStatus(nf: NotaFiscal) {
  if (nf.status === 'AUTORIZADA') return 'sucesso';
  if (nf.status === 'REJEITADA' || nf.status === 'CANCELADA') return 'erro';
  if (nf.status === 'PROCESSANDO') return 'alerta';
  return 'neutro';
}

async function emitir() {
  if (!props.orcamentoId || !podeEmitir.value) return;
  emitindo.value = true;
  try {
    await servicoNotasFiscais.emitir(props.orcamentoId);
    sucesso('Nota fiscal enviada para emissão.');
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] });
  } catch (erro) {
    notificarErro(erro);
  } finally {
    emitindo.value = false;
  }
}

async function sincronizar(nf: NotaFiscal) {
  sincronizandoId.value = nf.id;
  try {
    await servicoNotasFiscais.sincronizar(nf.id);
    sucesso('Status atualizado.');
    await refetch();
  } catch (erro) {
    notificarErro(erro);
  } finally {
    sincronizandoId.value = null;
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <FileSpreadsheet class="size-4 text-dourado-hover" />
        Nota fiscal
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <p v-if="!oportunidadeGanha" class="text-sm text-texto-secundario">
        Disponível quando o negócio estiver na etapa <strong>Ganha</strong>.
      </p>
      <p v-else-if="!orcamentoId" class="text-sm text-texto-secundario">
        Monte um orçamento com itens para liberar a emissão.
      </p>
      <p v-else-if="!podeEmitir" class="text-sm text-texto-secundario">
        O orçamento atual não pode ser faturado (cancelado ou sem itens).
      </p>
      <template v-else>
        <p
          v-if="!orcamentoConvertido"
          class="text-xs text-texto-secundario"
        >
          O último orçamento montado será usado como final (envio por WhatsApp é opcional).
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <Button
            :disabled="emitindo || (ultima?.status === 'AUTORIZADA' && !ehSimulacao(ultima))"
            @click="emitir"
          >
            <Send class="size-4" />
            {{ emitindo ? 'Emitindo…' : 'Emitir NF-e' }}
          </Button>
          <span class="text-xs text-texto-secundario">
            Sem token Focus, a emissão roda em modo simulado.
          </span>
        </div>
      </template>

      <div v-if="isLoading" class="text-sm text-texto-secundario">Carregando notas…</div>
      <ul v-else-if="lista.length" class="space-y-3">
        <li
          v-for="nf in lista"
          :key="nf.id"
          class="rounded-lg border border-borda bg-marfim/40 p-3 text-sm"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <Badge :variante="varianteStatus(nf)">{{ rotuloNota(nf) }}</Badge>
            <Button
              variante="fantasma"
              tamanho="sm"
              :disabled="sincronizandoId === nf.id"
              @click="sincronizar(nf)"
            >
              <RefreshCw class="size-3.5" />
              Sincronizar
            </Button>
          </div>
          <p v-if="nf.numero" class="mt-2 text-texto">
            Nº {{ nf.numero }}{{ nf.serie ? ` · série ${nf.serie}` : '' }}
          </p>
          <p v-if="nf.chaveAcesso" class="mt-1 break-all text-xs text-texto-secundario">
            Chave: {{ nf.chaveAcesso }}
          </p>
          <p
            v-if="nf.mensagemErro"
            :class="ehSimulacao(nf) ? 'mt-1 text-xs text-texto-secundario' : 'mt-1 text-xs text-erro'"
          >
            {{ nf.mensagemErro }}
          </p>
          <p v-if="nf.refFocus" class="mt-1 text-[11px] text-texto-secundario">
            Ref: {{ nf.refFocus }}
          </p>
        </li>
      </ul>
      <p v-else class="text-sm text-texto-secundario">Nenhuma nota emitida ainda.</p>
    </CardContent>
  </Card>
</template>
