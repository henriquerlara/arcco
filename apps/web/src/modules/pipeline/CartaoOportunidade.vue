<script setup lang="ts">
import { CalendarClock, Building2, User } from 'lucide-vue-next';
import type { Oportunidade } from '@/types';
import Badge from '@/components/ui/Badge.vue';
import BadgeStatus from '@/components/compartilhados/BadgeStatus.vue';
import { formatarMoeda, formatarDataCurta, iniciais, estaAtrasada } from '@/composables/formatadores';

defineProps<{ oportunidade: Oportunidade }>();
const emit = defineEmits<{ (e: 'abrir', id: string): void }>();
</script>

<template>
  <article
    class="cursor-pointer rounded-md border border-borda bg-branco p-3 shadow-suave transition-all hover:border-dourado/50 hover:shadow-cartao"
    @click="emit('abrir', oportunidade.id)"
  >
    <div class="flex items-start justify-between gap-2">
      <h4 class="line-clamp-2 text-sm font-semibold text-texto">{{ oportunidade.titulo }}</h4>
      <BadgeStatus familia="prioridade" :valor="oportunidade.prioridade" />
    </div>

    <p v-if="oportunidade.valorEstimado" class="mt-2 text-sm font-semibold text-dourado-hover">
      {{ formatarMoeda(oportunidade.valorEstimado) }}
    </p>

    <p
      v-if="oportunidade.descricao"
      class="mt-2 line-clamp-2 text-xs text-texto-secundario"
    >
      {{ oportunidade.descricao }}
    </p>

    <div class="mt-2 space-y-1 text-xs text-texto-secundario">
      <p v-if="oportunidade.contato" class="flex items-center gap-1.5">
        <User class="size-3.5" />
        <span class="truncate">{{ oportunidade.contato.nome }}</span>
      </p>
      <p v-if="oportunidade.obra" class="flex items-center gap-1.5">
        <Building2 class="size-3.5" />
        <span class="truncate">{{ oportunidade.obra.nome }}</span>
      </p>
      <p
        v-if="oportunidade.dataProximaAcao"
        class="flex items-center gap-1.5"
        :class="estaAtrasada(oportunidade.dataProximaAcao) ? 'text-erro' : ''"
      >
        <CalendarClock class="size-3.5" />
        <span>{{ oportunidade.proximaAcao ?? 'Próxima ação' }} · {{ formatarDataCurta(oportunidade.dataProximaAcao) }}</span>
      </p>
    </div>

    <div class="mt-3 flex items-center justify-between">
      <Badge v-if="oportunidade.categoria" variante="contorno">
        {{ oportunidade.categoria.nome }}
      </Badge>
      <span v-else />
      <span
        v-if="oportunidade.responsavel"
        class="flex size-6 items-center justify-center rounded-full bg-marfim text-[10px] font-semibold text-texto-secundario"
        :title="oportunidade.responsavel.nome"
      >
        {{ iniciais(oportunidade.responsavel.nome) }}
      </span>
    </div>
  </article>
</template>
