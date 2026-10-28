<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import { servicoSaude, type PacienteClinica } from '@/services/saude';

const pacientes = ref<PacienteClinica[]>([]);
const formulario = ref({ nome: '', telefone: '', convenio: '', numeroCarteira: '' });

async function carregar() {
  pacientes.value = await servicoSaude.pacientes();
}

async function criar() {
  await servicoSaude.criarPaciente(formulario.value);
  formulario.value = { nome: '', telefone: '', convenio: '', numeroCarteira: '' };
  await carregar();
}

onMounted(carregar);
</script>

<template>
  <div class="space-y-6">
    <form class="space-y-3 rounded-md border border-borda bg-branco p-4" @submit.prevent="criar">
      <h2 class="text-sm font-semibold text-carvao">Novo paciente</h2>
      <div class="grid gap-3 md:grid-cols-5">
        <Input v-model="formulario.nome" required placeholder="Nome do paciente" />
        <Input
          v-model="formulario.telefone"
          mascara="telefone"
          required
          placeholder="Telefone"
        />
        <Input v-model="formulario.convenio" placeholder="Convênio" />
        <Input v-model="formulario.numeroCarteira" placeholder="Carteirinha" />
        <Button type="submit">Cadastrar</Button>
      </div>
    </form>
    <ul class="divide-y divide-borda overflow-hidden rounded-md border border-borda bg-branco">
      <li v-for="paciente in pacientes" :key="paciente.id" class="flex items-center justify-between px-4 py-3">
        <div>
          <p class="font-medium text-carvao">{{ paciente.nome }}</p>
          <p class="text-xs text-texto-secundario">
            {{ paciente.telefone }}<span v-if="paciente.convenio"> · {{ paciente.convenio }}</span>
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>
