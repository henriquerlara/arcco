<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ESPECIALIDADES_CLINICA } from '@arcco/contratos';
import Button from '@/components/ui/Button.vue';
import { servicoSaude, rotuloEspecialidade, type ProfissionalClinica } from '@/services/saude';

const profissionais = ref<ProfissionalClinica[]>([]);
const formulario = ref({ nome: '', especialidade: 'clinico_geral' });

async function carregar() {
  profissionais.value = await servicoSaude.profissionais();
}

async function criar() {
  await servicoSaude.criarProfissional(formulario.value);
  formulario.value = { nome: '', especialidade: 'clinico_geral' };
  await carregar();
}

onMounted(carregar);
</script>

<template>
  <div class="space-y-6">
    <form class="space-y-3 rounded-md border border-borda bg-branco p-4" @submit.prevent="criar">
      <h2 class="text-sm font-semibold text-carvao">Novo profissional</h2>
      <div class="grid gap-3 md:grid-cols-3">
      <input v-model="formulario.nome" required placeholder="Nome do profissional" class="h-10 rounded-md border border-borda px-3 text-sm" />
      <select v-model="formulario.especialidade" class="h-10 rounded-md border border-borda px-3 text-sm">
        <option v-for="item in ESPECIALIDADES_CLINICA" :key="item.id" :value="item.id">{{ item.rotulo }}</option>
      </select>
      <Button type="submit">Adicionar</Button>
      </div>
    </form>
    <div class="grid gap-3 md:grid-cols-3">
      <article v-for="profissional in profissionais" :key="profissional.id" class="rounded-md border border-borda bg-branco px-4 py-4">
        <h2 class="font-semibold text-carvao">{{ profissional.nome }}</h2>
        <p class="mt-1 text-sm text-texto-secundario">{{ rotuloEspecialidade(profissional.especialidade) }}</p>
        <p class="mt-3 text-xs text-texto-secundario">Segunda a sexta, 08:00–18:00</p>
      </article>
    </div>
  </div>
</template>
