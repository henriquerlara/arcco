<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Button from '@/components/ui/Button.vue';
import { servicoSaude } from '@/services/saude';
import { useNotificacao } from '@/composables/useNotificacao';

const { sucesso } = useNotificacao();
const duracaoSlotMinutos = ref(30);
const horizonteDias = ref(30);

onMounted(async () => {
  const config = await servicoSaude.configuracao();
  duracaoSlotMinutos.value = config.duracaoSlotMinutos;
  horizonteDias.value = config.horizonteDias;
});

async function salvar() {
  await servicoSaude.salvarConfiguracao({
    duracaoSlotMinutos: Number(duracaoSlotMinutos.value),
    horizonteDias: Number(horizonteDias.value),
  });
  sucesso('Configuração da clínica salva.');
}
</script>

<template>
  <form class="max-w-lg space-y-5 rounded-md border border-borda bg-branco p-5" @submit.prevent="salvar">
    <p class="text-sm leading-relaxed text-texto-secundario">
      A recepção define quanto tempo dura cada consulta e até quantos dias à frente a agenda fica aberta.
    </p>
    <label class="block text-sm">
      <span class="mb-1 block font-medium text-carvao">Duração do slot (minutos)</span>
      <input v-model.number="duracaoSlotMinutos" type="number" min="10" max="120" class="h-10 w-full rounded-md border border-borda px-3" />
    </label>
    <label class="block text-sm">
      <span class="mb-1 block font-medium text-carvao">Horizonte de agendamento (dias)</span>
      <input v-model.number="horizonteDias" type="number" min="1" max="180" class="h-10 w-full rounded-md border border-borda px-3" />
    </label>
    <Button type="submit">Salvar</Button>
  </form>
</template>
