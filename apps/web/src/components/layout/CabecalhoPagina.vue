<script setup lang="ts">
defineProps<{
  titulo: string;
  descricao?: string;
  usarSerif?: boolean;
}>();
</script>

<template>
  <header class="flex flex-col gap-5 border-b border-borda/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
    <div class="min-w-0">
      <div v-if="$slots.trilha" class="rotulo-editorial mb-2 text-dourado-hover">
        <slot name="trilha" />
      </div>
      <h1
        :class="[
          'truncate text-texto',
          usarSerif
            ? 'fonte-marca text-3xl font-semibold md:text-[2rem]'
            : 'text-2xl font-semibold tracking-[-0.035em] md:text-[1.75rem]',
        ]"
      >
        {{ titulo }}
      </h1>
      <p v-if="descricao" class="mt-1.5 max-w-2xl text-sm text-texto-secundario">{{ descricao }}</p>
    </div>
    <div v-if="$slots.acoes" class="flex shrink-0 items-center gap-2">
      <slot name="acoes" />
    </div>
  </header>
</template>
