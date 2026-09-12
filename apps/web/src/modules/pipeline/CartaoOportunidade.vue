<script setup lang="ts">
import { computed } from 'vue';
import { ArrowUpRight, Building2, CalendarClock, Send, User } from 'lucide-vue-next';
import type { Oportunidade } from '@/types';
import Badge from '@/components/ui/Badge.vue';
import BadgeStatus from '@/components/compartilhados/BadgeStatus.vue';
import Button from '@/components/ui/Button.vue';
import { formatarMoeda, formatarDataCurta, iniciais, estaAtrasada } from '@/composables/formatadores';
import { lerAjustes, temAjustePendente } from '@/composables/ajustes';

const props = defineProps<{ oportunidade: Oportunidade; destacarEnvioOrcamento?: boolean }>();
const emit = defineEmits<{
  (e: 'abrir', id: string): void;
  (e: 'enviar-orcamento', id: string): void;
}>();

const ehAjuste = computed(() =>
  temAjustePendente(props.oportunidade.dadosPersonalizados, props.oportunidade.descricao),
);

const linhasCard = computed(() => {
  const ajustes = lerAjustes(props.oportunidade.dadosPersonalizados, props.oportunidade.descricao);
  if (ajustes.length > 0) {
    return ajustes.flatMap((item) =>
      item.texto
        .split(/\n+/)
        .map((parte) => parte.trim())
        .filter(Boolean),
    );
  }
  return String(props.oportunidade.descricao ?? '')
    .split(/\n+/)
    .map((parte) => parte.trim())
    .filter(Boolean);
});

function aoEnviar(evento: Event) {
  evento.stopPropagation();
  emit('enviar-orcamento', props.oportunidade.id);
}
</script>

<template>
  <article
    class="superficie-interativa group relative overflow-hidden rounded-md border border-borda/90 bg-branco p-4"
    role="link"
    tabindex="0"
    @click="emit('abrir', oportunidade.id)"
    @keydown.enter="emit('abrir', oportunidade.id)"
    @keydown.space.prevent="emit('abrir', oportunidade.id)"
  >
    <div class="absolute inset-y-0 left-0 w-0.5 origin-bottom scale-y-0 bg-carvao transition-transform duration-200 group-hover:scale-y-100" />

    <div class="flex items-center justify-between gap-3">
      <h4 class="text-sm font-semibold tracking-tight text-texto">
        {{ oportunidade.codigo }}
      </h4>
      <div class="flex items-center gap-1.5">
        <Badge v-if="ehAjuste" variante="alerta">Ajuste</Badge>
        <BadgeStatus familia="prioridade" :valor="oportunidade.prioridade" />
        <ArrowUpRight class="size-4 shrink-0 text-texto-secundario/40 transition-colors group-hover:text-dourado-hover" />
      </div>
    </div>

    <p v-if="oportunidade.valorEstimado" class="mt-3 text-lg font-semibold tracking-tight text-texto">
      {{ formatarMoeda(oportunidade.valorEstimado) }}
    </p>

    <ul v-if="linhasCard.length" class="mt-2 space-y-1">
      <li
        v-for="(linha, indice) in linhasCard"
        :key="`${indice}-${linha}`"
        class="line-clamp-2 text-xs leading-relaxed text-texto-secundario"
      >
        {{ linha }}
      </li>
    </ul>

    <div class="mt-4 space-y-2 border-t border-borda/60 pt-3 text-xs text-texto-secundario">
      <p v-if="oportunidade.contato" class="flex items-center gap-2">
        <span class="grid size-6 shrink-0 place-items-center rounded-lg bg-marfim"><User class="size-3.5" /></span>
        <span class="truncate">{{ oportunidade.contato.nome }}</span>
      </p>
      <p v-if="oportunidade.obra" class="flex items-center gap-2">
        <span class="grid size-6 shrink-0 place-items-center rounded-lg bg-marfim"><Building2 class="size-3.5" /></span>
        <span class="truncate">{{ oportunidade.obra.nome }}</span>
      </p>
      <p v-if="oportunidade.dataProximaAcao" class="flex items-center gap-2" :class="estaAtrasada(oportunidade.dataProximaAcao) ? 'text-erro' : ''">
        <span class="grid size-6 shrink-0 place-items-center rounded-lg bg-marfim"><CalendarClock class="size-3.5" /></span>
        <span class="truncate">{{ oportunidade.proximaAcao ?? 'Próxima ação' }} · {{ formatarDataCurta(oportunidade.dataProximaAcao) }}</span>
      </p>
    </div>

    <div class="mt-4 flex items-center justify-between gap-2">
      <Badge v-if="oportunidade.categoria" variante="contorno">{{ oportunidade.categoria.nome }}</Badge>
      <span v-else class="text-[10px] uppercase tracking-wider text-texto-secundario/50">Negócio ativo</span>
      <div class="flex items-center gap-2">
        <Button v-if="destacarEnvioOrcamento" variante="primario" tamanho="icone-sm" class="shadow-md" title="Enviar orçamento" aria-label="Enviar orçamento" @click="aoEnviar">
          <Send class="size-3.5" />
        </Button>
        <span v-if="oportunidade.responsavel" class="grid size-7 place-items-center rounded-full border border-borda bg-marfim text-[10px] font-bold text-texto-secundario" :title="oportunidade.responsavel.nome">
          {{ iniciais(oportunidade.responsavel.nome) }}
        </span>
      </div>
    </div>
  </article>
</template>
