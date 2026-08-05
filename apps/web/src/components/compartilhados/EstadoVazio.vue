<script setup lang="ts">
import { Inbox } from 'lucide-vue-next';
import type { Component } from 'vue';

defineProps<{
  titulo: string;
  descricao?: string;
  icone?: Component;
}>();
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-lg border border-dashed border-borda bg-branco/50 px-6 py-14 text-center"
  >
    <div class="mb-4 flex size-14 items-center justify-center rounded-full bg-marfim text-dourado-hover">
      <component :is="icone ?? Inbox" class="size-7" />
    </div>
    <h3 class="text-base font-semibold text-texto">{{ titulo }}</h3>
    <p v-if="descricao" class="mt-1 max-w-sm text-sm text-texto-secundario">{{ descricao }}</p>
    <div v-if="$slots.acao" class="mt-5">
      <slot name="acao" />
    </div>
  </div>
</template>
