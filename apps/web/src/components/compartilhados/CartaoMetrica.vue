<script setup lang="ts">
import type { Component } from 'vue';
import { TrendingDown, TrendingUp } from 'lucide-vue-next';
import Skeleton from './Skeleton.vue';

defineProps<{
  rotulo: string;
  valor: string | number;
  icone?: Component;
  variacao?: number | null;
  ajuda?: string;
  carregando?: boolean;
  destaque?: boolean;
}>();
</script>

<template>
  <div
    class="superficie-arquitetonica group overflow-hidden rounded-md p-5"
    :class="destaque && 'border-carvao bg-carvao text-marfim'"
  >
    <div class="flex items-start justify-between gap-3">
      <p :class="['rotulo-editorial', destaque ? 'text-marfim/55' : 'text-texto-secundario']">{{ rotulo }}</p>
      <div
        v-if="icone"
        :class="['flex size-9 items-center justify-center rounded-md', destaque ? 'bg-white/[0.07] text-dourado-claro' : 'bg-marfim text-carvao']"
      >
        <component :is="icone" class="size-5" />
      </div>
    </div>

    <div class="mt-3">
      <Skeleton v-if="carregando" class="h-8 w-28" />
      <p v-else :class="['fonte-marca text-[1.85rem] leading-none', destaque ? 'text-marfim' : 'text-texto']">{{ valor }}</p>
    </div>

    <div v-if="!carregando" class="mt-2 flex items-center gap-2 text-xs">
      <span
        v-if="variacao !== null && variacao !== undefined"
        class="inline-flex items-center gap-1 font-medium"
        :class="variacao >= 0 ? 'text-sucesso' : 'text-erro'"
      >
        <component :is="variacao >= 0 ? TrendingUp : TrendingDown" class="size-3.5" />
        {{ Math.abs(variacao) }}%
      </span>
      <span v-if="ajuda" :class="destaque ? 'text-marfim/50' : 'text-texto-secundario'">{{ ajuda }}</span>
    </div>
  </div>
</template>
