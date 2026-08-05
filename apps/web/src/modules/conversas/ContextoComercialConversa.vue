<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { User, Building2, Target, Sparkles, ExternalLink } from 'lucide-vue-next';
import type { ContextoComercial } from '@/types';
import Badge from '@/components/ui/Badge.vue';
import BadgeStatus from '@/components/compartilhados/BadgeStatus.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import { formatarMoeda, formatarTelefone } from '@/composables/formatadores';
import { ROTULO_TIPO_CONTATO } from '@/composables/rotulos';

defineProps<{
  contexto: ContextoComercial | null;
  carregando?: boolean;
}>();
</script>

<template>
  <aside class="flex h-full flex-col gap-4 overflow-y-auto bg-branco p-4">
    <h3 class="text-xs font-semibold uppercase tracking-wider text-texto-secundario">
      Contexto comercial
    </h3>

    <template v-if="carregando">
      <Skeleton class="h-28 w-full" />
      <Skeleton class="h-28 w-full" />
    </template>

    <template v-else-if="contexto">
      <!-- Resumo da IA -->
      <section
        v-if="contexto.resumo"
        class="rounded-md border border-dourado/25 bg-dourado/8 p-3"
      >
        <p class="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#8a6d24]">
          <Sparkles class="size-3.5" /> Resumo automático
        </p>
        <p class="text-sm text-texto">{{ contexto.resumo }}</p>
        <ul
          v-if="contexto.pontosChave?.length"
          class="mt-2 list-inside list-disc space-y-0.5 text-xs text-texto-secundario"
        >
          <li v-for="(p, i) in contexto.pontosChave" :key="i">{{ p }}</li>
        </ul>
      </section>

      <!-- Contato -->
      <section v-if="contexto.contato" class="rounded-md border border-borda p-3">
        <p class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-texto-secundario">
          <User class="size-3.5" /> Contato
        </p>
        <RouterLink
          :to="`/app/contatos/${contexto.contato.id}`"
          class="group flex items-center justify-between"
        >
          <span class="text-sm font-medium text-texto group-hover:text-dourado-hover">
            {{ contexto.contato.nome }}
          </span>
          <ExternalLink class="size-3.5 text-texto-secundario" />
        </RouterLink>
        <p class="mt-1 text-xs text-texto-secundario">
          {{ formatarTelefone(contexto.contato.telefone) }}
        </p>
        <Badge variante="neutro" class="mt-2">
          {{ ROTULO_TIPO_CONTATO[contexto.contato.tipo] }}
        </Badge>
      </section>

      <!-- Obra -->
      <section v-if="contexto.obra" class="rounded-md border border-borda p-3">
        <p class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-texto-secundario">
          <Building2 class="size-3.5" /> Obra
        </p>
        <RouterLink
          :to="`/app/obras/${contexto.obra.id}`"
          class="text-sm font-medium text-texto hover:text-dourado-hover"
        >
          {{ contexto.obra.nome }}
        </RouterLink>
        <div class="mt-2">
          <BadgeStatus familia="statusObra" :valor="contexto.obra.status" />
        </div>
      </section>

      <!-- Oportunidade -->
      <section v-if="contexto.oportunidade" class="rounded-md border border-borda p-3">
        <p class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-texto-secundario">
          <Target class="size-3.5" /> Oportunidade
        </p>
        <RouterLink
          :to="`/app/oportunidades/${contexto.oportunidade.id}`"
          class="text-sm font-medium text-texto hover:text-dourado-hover"
        >
          {{ contexto.oportunidade.titulo }}
        </RouterLink>
        <p
          v-if="contexto.oportunidade.valorEstimado"
          class="mt-1 text-sm font-semibold text-dourado-hover"
        >
          {{ formatarMoeda(contexto.oportunidade.valorEstimado) }}
        </p>
        <div class="mt-2 flex items-center gap-1.5">
          <BadgeStatus familia="prioridade" :valor="contexto.oportunidade.prioridade" />
          <Badge v-if="contexto.oportunidade.etapa" variante="dourado">
            {{ contexto.oportunidade.etapa.nome }}
          </Badge>
        </div>
      </section>

      <!-- Dados coletados pelo bot -->
      <section
        v-if="contexto.dadosColetados && Object.keys(contexto.dadosColetados).length"
        class="rounded-md border border-borda p-3"
      >
        <p class="mb-2 text-xs font-semibold text-texto-secundario">Dados coletados</p>
        <dl class="space-y-1 text-xs">
          <div
            v-for="(valor, chave) in contexto.dadosColetados"
            :key="chave"
            class="flex justify-between gap-2"
          >
            <dt class="text-texto-secundario">{{ chave }}</dt>
            <dd class="text-right font-medium text-texto">{{ valor }}</dd>
          </div>
        </dl>
      </section>
    </template>

    <p v-else class="text-sm text-texto-secundario">Sem contexto disponível.</p>
  </aside>
</template>
