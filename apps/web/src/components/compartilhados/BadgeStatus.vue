<script setup lang="ts">
import { computed } from 'vue';
import Badge, { type BadgeVariantes } from '@/components/ui/Badge.vue';
import {
  ROTULO_MODO_ATENDIMENTO,
  ROTULO_PRIORIDADE,
  ROTULO_STATUS_CONVERSA,
  ROTULO_STATUS_OBRA,
  ROTULO_STATUS_WHATSAPP,
  ROTULO_TIPO_ETAPA,
} from '@/composables/rotulos';

type Familia =
  | 'statusObra'
  | 'statusConversa'
  | 'modoAtendimento'
  | 'prioridade'
  | 'tipoEtapa'
  | 'statusWhatsapp';

const props = defineProps<{
  familia: Familia;
  valor: string;
}>();

const mapaVariantes: Record<Familia, Record<string, BadgeVariantes['variante']>> = {
  statusObra: {
    PLANEJAMENTO: 'info',
    EM_ANDAMENTO: 'dourado',
    PAUSADA: 'alerta',
    CONCLUIDA: 'sucesso',
    CANCELADA: 'erro',
  },
  statusConversa: {
    BOT_ATENDENDO: 'info',
    AGUARDANDO_HUMANO: 'alerta',
    EM_ATENDIMENTO: 'dourado',
    AGUARDANDO_CLIENTE: 'neutro',
    FINALIZADA: 'sucesso',
  },
  modoAtendimento: {
    BOT: 'info',
    HUMANO: 'dourado',
    PAUSADO: 'neutro',
  },
  prioridade: {
    BAIXA: 'neutro',
    MEDIA: 'info',
    ALTA: 'alerta',
    URGENTE: 'erro',
  },
  tipoEtapa: {
    ABERTA: 'neutro',
    GANHA: 'sucesso',
    PERDIDA: 'erro',
  },
  statusWhatsapp: {
    DESCONECTADO: 'neutro',
    CONECTANDO: 'info',
    QR_CODE: 'alerta',
    CONECTADO: 'sucesso',
    ERRO: 'erro',
  },
};

const mapaRotulos: Record<Familia, Record<string, string>> = {
  statusObra: ROTULO_STATUS_OBRA,
  statusConversa: ROTULO_STATUS_CONVERSA,
  modoAtendimento: ROTULO_MODO_ATENDIMENTO,
  prioridade: ROTULO_PRIORIDADE,
  tipoEtapa: ROTULO_TIPO_ETAPA,
  statusWhatsapp: ROTULO_STATUS_WHATSAPP,
};

const variante = computed(
  () => mapaVariantes[props.familia][props.valor] ?? 'neutro',
);
const rotulo = computed(() => mapaRotulos[props.familia][props.valor] ?? props.valor);
</script>

<template>
  <Badge :variante="variante">{{ rotulo }}</Badge>
</template>
