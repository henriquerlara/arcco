<script setup lang="ts">
defineProps<{
  titulo: string;
  descricao?: string;
  usarSerif?: boolean;
}>();
</script>

<template>
  <header class="flex flex-col gap-4 pb-1 sm:flex-row sm:items-start sm:justify-between">
    <div class="min-w-0">
      <div v-if="$slots.trilha" class="mb-1 text-xs text-texto-secundario">
        <slot name="trilha" />
      </div>
      <h1
        :class="[
          'truncate text-texto',
          usarSerif
            ? 'fonte-marca text-3xl font-semibold'
            : 'text-2xl font-semibold tracking-tight',
        ]"
      >
        {{ titulo }}
      </h1>
      <p v-if="descricao" class="mt-1 text-sm text-texto-secundario">{{ descricao }}</p>
    </div>
    <div v-if="$slots.acoes" class="flex shrink-0 items-center gap-2">
      <slot name="acoes" />
    </div>
  </header>
</template>
