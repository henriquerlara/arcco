<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { servicoSaude, rotuloEspecialidade } from '@/services/saude';
import SeloConsulta from './SeloConsulta.vue';

const data = ref(new Date().toISOString().slice(0, 10));
const dia = ref('');
const profissionais = ref<Awaited<ReturnType<typeof servicoSaude.agenda>>['profissionais']>([]);

async function carregar() {
  const resposta = await servicoSaude.agenda(data.value);
  dia.value = resposta.dia;
  profissionais.value = resposta.profissionais;
}

onMounted(carregar);
watch(data, carregar);
</script>

<template>
  <div class="space-y-5">
    <label class="flex items-center gap-3 text-sm text-texto-secundario">
      Dia
      <input v-model="data" type="date" class="h-10 rounded-md border border-borda bg-branco px-3 text-carvao" />
      <span class="font-medium text-carvao">{{ dia }}</span>
    </label>

    <div class="grid gap-4 lg:grid-cols-3">
      <article v-for="profissional in profissionais" :key="profissional.id" class="rounded-md border border-borda bg-branco">
        <header class="border-b border-borda px-4 py-3">
          <h2 class="font-semibold text-carvao">{{ profissional.nome }}</h2>
          <p class="text-xs text-texto-secundario">
            {{ rotuloEspecialidade(profissional.especialidade) }}
            <span v-if="profissional.grade"> · {{ profissional.grade.horaInicio }}–{{ profissional.grade.horaFim }}</span>
            <span v-else> · sem grade neste dia</span>
          </p>
        </header>
        <p v-if="!profissional.consultas.length" class="px-4 py-6 text-sm text-texto-secundario">Horários livres.</p>
        <ul v-else class="divide-y divide-borda">
          <li v-for="consulta in profissional.consultas" :key="consulta.id" class="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div>
              <span class="font-semibold text-carvao">{{ consulta.hora }}</span>
              {{ consulta.paciente.nome }}
              <span v-if="consulta.convenio" class="text-texto-secundario"> · {{ consulta.convenio }}</span>
            </div>
            <SeloConsulta :status="consulta.status" />
          </li>
        </ul>
      </article>
    </div>
  </div>
</template>
