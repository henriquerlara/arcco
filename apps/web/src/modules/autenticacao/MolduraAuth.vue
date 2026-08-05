<script setup lang="ts">
import MarcaArcco from '@/components/marca/MarcaArcco.vue';
import ArcosMarcaAgua from '@/components/marca/ArcosMarcaAgua.vue';

defineProps<{
  titulo: string;
  subtitulo?: string;
  frase?: string;
}>();
</script>

<template>
  <div class="flex min-h-screen bg-preto text-marfim">
    <!-- Lado da marca (desktop) -->
    <div
      class="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-carvao p-12 lg:flex"
    >
      <ArcosMarcaAgua
        class="absolute -bottom-16 -right-10 h-[560px] w-[560px] text-dourado/10"
      />
      <MarcaArcco tema="claro" tamanho="lg" subtitulo="Inteligência comercial" />

      <div class="relative z-10 max-w-md">
        <p class="fonte-marca text-3xl leading-snug text-marfim">
          {{ frase ?? 'Cada obra começa com uma conversa. A ARCCO transforma conversas em vendas.' }}
        </p>
        <p class="mt-4 text-sm text-marfim/50">
          Do primeiro contato no WhatsApp ao orçamento fechado — tudo organizado em um só lugar.
        </p>
      </div>

      <p class="relative z-10 text-xs text-marfim/40">
        © {{ new Date().getFullYear() }} ARCCO · Feito para empresas que atendem obras.
      </p>
    </div>

    <!-- Lado do formulário -->
    <div class="relative flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
      <ArcosMarcaAgua
        class="absolute inset-0 m-auto h-[420px] w-[420px] text-dourado/5 lg:hidden"
      />
      <div class="relative z-10 w-full max-w-md">
        <div class="mb-8 flex justify-center lg:hidden">
          <MarcaArcco tema="claro" tamanho="md" subtitulo="Inteligência comercial" />
        </div>

        <div class="rounded-lg border border-borda bg-superficie p-8 text-texto shadow-flutuante">
          <div class="mb-6">
            <h1 class="fonte-marca text-2xl font-semibold text-texto">{{ titulo }}</h1>
            <p v-if="subtitulo" class="mt-1 text-sm text-texto-secundario">{{ subtitulo }}</p>
          </div>
          <slot />
        </div>

        <div v-if="$slots.rodape" class="mt-6 text-center text-sm text-marfim/60">
          <slot name="rodape" />
        </div>
      </div>
    </div>
  </div>
</template>
