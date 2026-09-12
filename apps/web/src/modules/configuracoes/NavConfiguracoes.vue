<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';

const rota = useRoute();

const itens = [
  { rotulo: 'Empresa', nome: 'config-empresa' },
  { rotulo: 'Equipe', nome: 'config-equipe' },
  { rotulo: 'WhatsApp', nome: 'config-whatsapp' },
];

const avancados = [
  { rotulo: 'Automação', nome: 'config-chatbot' },
  { rotulo: 'Funil', nome: 'config-funil' },
  { rotulo: 'Categorias', nome: 'config-categorias' },
  { rotulo: 'Campos', nome: 'config-campos' },
];
</script>

<template>
  <nav class="flex flex-wrap items-center gap-0 border-b border-borda">
    <RouterLink
      v-for="item in itens"
      :key="item.nome"
      :to="{ name: item.nome }"
      class="-mb-px border-b-2 border-transparent px-4 py-2.5 text-sm font-medium transition-colors"
      :class="
        rota.name === item.nome
          ? 'border-carvao text-carvao'
          : 'text-texto-secundario hover:text-texto'
      "
    >
      {{ item.rotulo }}
    </RouterLink>
    <details class="group relative ml-auto">
      <summary class="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-texto-secundario hover:text-texto">
        Avançado
      </summary>
      <div class="absolute right-0 z-20 mt-2 grid min-w-44 gap-1 rounded-lg border border-borda bg-branco p-1.5 shadow-flutuante">
        <RouterLink
          v-for="item in avancados"
          :key="item.nome"
          :to="{ name: item.nome }"
          class="rounded-md px-3 py-2 text-sm text-texto-secundario hover:bg-marfim hover:text-texto"
        >{{ item.rotulo }}</RouterLink>
      </div>
    </details>
  </nav>
</template>
