<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import {
  PerfilUsuario,
  PersonalizacaoComercial,
  rotaOcultaNaPersonalizacao,
} from '@arcco/contratos';
import { useAutenticacaoStore } from '@/stores/autenticacao';

const rota = useRoute();
const auth = useAutenticacaoStore();

const ehGestor = computed(() =>
  auth.temPerfil(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR),
);

const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);

function visivel(nome: string): boolean {
  return !rotaOcultaNaPersonalizacao(nome, auth.empresa?.personalizacaoComercial);
}

const ehAdmin = computed(() => auth.temPerfil(PerfilUsuario.PROPRIETARIO));

const itens = computed(() => {
  const base = [{ rotulo: 'Empresa', nome: 'config-empresa' }];
  if (!ehGestor.value) return base;
  return [
    ...base,
    ...(ecolume.value ? [{ rotulo: 'Parâmetros', nome: 'config-parametros' }] : []),
    { rotulo: 'Equipe', nome: 'config-equipe' },
    ...(ecolume.value && ehAdmin.value
      ? [{ rotulo: 'Auditoria', nome: 'config-auditoria' }]
      : []),
    { rotulo: 'WhatsApp', nome: 'config-whatsapp' },
    { rotulo: 'Nota fiscal', nome: 'config-fiscal' },
  ].filter((item) => visivel(item.nome));
});

const avancados = computed(() => {
  if (!ehGestor.value) return [];
  return [
    { rotulo: 'Automação', nome: 'config-chatbot' },
    { rotulo: 'Funil', nome: 'config-funil' },
    { rotulo: 'Categorias', nome: 'config-categorias' },
    { rotulo: 'Campos', nome: 'config-campos' },
  ].filter((item) => visivel(item.nome));
});
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
    <details v-if="avancados.length" class="group relative ml-auto">
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
