<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Button from '@/components/ui/Button.vue';
import {
  servicoSaude,
  rotuloDataConsulta,
  rotuloEspecialidade,
  type ConsultaClinica,
  type PacienteClinica,
  type ProfissionalClinica,
} from '@/services/saude';
import SeloConsulta from './SeloConsulta.vue';

const consultas = ref<ConsultaClinica[]>([]);
const pacientes = ref<PacienteClinica[]>([]);
const profissionais = ref<ProfissionalClinica[]>([]);
const formulario = ref({ pacienteId: '', profissionalId: '', data: '', hora: '09:00', convenio: '' });

async function carregar() {
  [consultas.value, pacientes.value, profissionais.value] = await Promise.all([
    servicoSaude.consultas(),
    servicoSaude.pacientes(),
    servicoSaude.profissionais(),
  ]);
}

async function criar() {
  await servicoSaude.criarConsulta(formulario.value);
  formulario.value = { pacienteId: '', profissionalId: '', data: '', hora: '09:00', convenio: '' };
  await carregar();
}

async function marcar(consulta: ConsultaClinica, status: ConsultaClinica['status']) {
  await servicoSaude.atualizarConsulta(consulta.id, status);
  await carregar();
}

onMounted(carregar);
</script>

<template>
  <div class="space-y-6">
    <form class="space-y-3 rounded-md border border-borda bg-branco p-4" @submit.prevent="criar">
      <h2 class="text-sm font-semibold text-carvao">Nova consulta</h2>
      <div class="grid gap-3 md:grid-cols-5">
      <select v-model="formulario.pacienteId" required class="h-10 rounded-md border border-borda px-3 text-sm">
        <option value="" disabled>Paciente</option>
        <option v-for="paciente in pacientes" :key="paciente.id" :value="paciente.id">{{ paciente.nome }}</option>
      </select>
      <select v-model="formulario.profissionalId" required class="h-10 rounded-md border border-borda px-3 text-sm">
        <option value="" disabled>Profissional</option>
        <option v-for="profissional in profissionais" :key="profissional.id" :value="profissional.id">{{ profissional.nome }}</option>
      </select>
      <input v-model="formulario.data" required type="date" class="h-10 rounded-md border border-borda px-3 text-sm" />
      <input v-model="formulario.hora" required type="time" class="h-10 rounded-md border border-borda px-3 text-sm" />
      <Button type="submit">Agendar</Button>
      </div>
    </form>

    <p v-if="!consultas.length" class="rounded-md border border-borda bg-branco px-4 py-8 text-sm text-texto-secundario">
      Nenhuma consulta na agenda.
    </p>
    <div v-else class="overflow-hidden rounded-md border border-borda bg-branco">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-borda text-xs text-texto-secundario">
          <tr>
            <th class="px-4 py-3 font-medium">Quando</th>
            <th class="px-4 py-3 font-medium">Paciente</th>
            <th class="px-4 py-3 font-medium">Profissional</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-borda">
          <tr v-for="consulta in consultas" :key="consulta.id">
            <td class="px-4 py-3">{{ rotuloDataConsulta(consulta.data) }} · {{ consulta.hora }}</td>
            <td class="px-4 py-3">{{ consulta.paciente.nome }}</td>
            <td class="px-4 py-3">{{ consulta.profissional.nome }} · {{ rotuloEspecialidade(consulta.especialidade) }}</td>
            <td class="px-4 py-3"><SeloConsulta :status="consulta.status" /></td>
            <td class="px-4 py-3 text-right">
              <button v-if="consulta.status === 'AGENDADA'" class="text-xs font-semibold text-carvao" @click="marcar(consulta, 'CONFIRMADA')">Confirmar</button>
              <button v-if="consulta.status === 'CONFIRMADA'" class="text-xs font-semibold text-carvao" @click="marcar(consulta, 'REALIZADA')">Marcar como realizada</button>
              <button v-if="consulta.status !== 'CANCELADA' && consulta.status !== 'REALIZADA'" class="ml-3 text-xs font-semibold text-erro" @click="marcar(consulta, 'CANCELADA')">Cancelar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
