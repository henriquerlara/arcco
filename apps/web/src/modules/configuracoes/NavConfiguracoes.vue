<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';

const rota = useRoute();

const itens = [
  { rotulo: 'Empresa', nome: 'config-empresa' },
  { rotulo: 'Equipe', nome: 'config-equipe' },
  { rotulo: 'Categorias', nome: 'config-categorias' },
  { rotulo: 'Funil', nome: 'config-funil' },
  { rotulo: 'Campos', nome: 'config-campos' },
  { rotulo: 'Chatbot', nome: 'config-chatbot' },
  { rotulo: 'WhatsApp', nome: 'config-whatsapp' },
];
</script>

<template>
  <nav class="flex flex-wrap gap-1 rounded-md border border-borda bg-marfim p-1">
    <RouterLink
      v-for="item in itens"
      :key="item.nome"
      :to="{ name: item.nome }"
      class="rounded-sm px-3 py-1.5 text-sm font-medium transition-colors"
      :class="
        rota.name === item.nome
          ? 'bg-branco text-texto shadow-suave'
          : 'text-texto-secundario hover:text-texto'
      "
    >
      {{ item.rotulo }}
    </RouterLink>
  </nav>
</template>
