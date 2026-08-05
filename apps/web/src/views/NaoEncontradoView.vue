<script setup lang="ts">
import { RouterLink } from 'vue-router';
import MarcaArcco from '@/components/marca/MarcaArcco.vue';
import Button from '@/components/ui/Button.vue';
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-6 bg-preto px-4 text-center">
    <MarcaArcco tema="claro" tamanho="lg" />
    <div>
      <p class="fonte-marca text-6xl font-semibold text-dourado">404</p>
      <p class="mt-2 text-marfim/70">A página que você procura não existe ou foi movida.</p>
    </div>
    <Button as="a" variante="primario">
      <RouterLink to="/app/dashboard">Voltar ao painel</RouterLink>
    </Button>
  </div>
</template>
