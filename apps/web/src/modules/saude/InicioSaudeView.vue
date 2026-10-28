<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { servicoSaude, rotuloEspecialidade, type ConsultaClinica } from '@/services/saude';
import SeloConsulta from './SeloConsulta.vue';

const resumo = ref({ consultasHoje: 0, aguardandoConfirmacao: 0, profissionais: 0, medicamentosAbaixoDoMinimo: 0 });
const consultas = ref<ConsultaClinica[]>([]);

onMounted(async () => {
  const dados = await servicoSaude.inicio();
  resumo.value = dados.resumo;
  consultas.value = dados.consultasHoje;
});

const cartoes = [
  { chave: 'consultasHoje' as const, rotulo: 'Consultas hoje' },
  { chave: 'aguardandoConfirmacao' as const, rotulo: 'Aguardando confirmação' },
  { chave: 'profissionais' as const, rotulo: 'Profissionais ativos' },
  { chave: 'medicamentosAbaixoDoMinimo' as const, rotulo: 'Estoque baixo' },
];
</script>

<template>
  <div class="space-y-8">
    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article v-for="cartao in cartoes" :key="cartao.chave" class="rounded-md border border-borda bg-branco px-4 py-4">
        <p class="text-xs font-medium text-texto-secundario">{{ cartao.rotulo }}</p>
        <p class="fonte-marca mt-2 text-3xl text-carvao">{{ resumo[cartao.chave] }}</p>
      </article>
    </section>

    <section class="rounded-md border border-borda bg-branco">
      <header class="border-b border-borda px-4 py-3">
        <h2 class="text-sm font-semibold text-carvao">Agenda de hoje</h2>
      </header>
      <p v-if="!consultas.length" class="px-4 py-8 text-sm text-texto-secundario">Nenhuma consulta marcada para hoje.</p>
      <ul v-else class="divide-y divide-borda">
        <li v-for="consulta in consultas" :key="consulta.id" class="flex items-center justify-between gap-4 px-4 py-3">
          <div>
            <p class="font-medium text-carvao">{{ consulta.hora }} · {{ consulta.paciente.nome }}</p>
            <p class="text-xs text-texto-secundario">
              {{ consulta.profissional.nome }} · {{ rotuloEspecialidade(consulta.especialidade) }}
            </p>
          </div>
          <SeloConsulta :status="consulta.status" />
        </li>
      </ul>
    </section>
  </div>
</template>
