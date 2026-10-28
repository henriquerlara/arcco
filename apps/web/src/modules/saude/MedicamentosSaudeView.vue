<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Button from '@/components/ui/Button.vue';
import { servicoSaude, type MedicamentoClinica } from '@/services/saude';

const medicamentos = ref<MedicamentoClinica[]>([]);
const formulario = ref({ nome: '', apresentacao: '', estoque: 0, estoqueMinimo: 5 });

async function carregar() {
  medicamentos.value = await servicoSaude.medicamentos();
}

async function criar() {
  await servicoSaude.criarMedicamento({
    ...formulario.value,
    estoque: Number(formulario.value.estoque),
    estoqueMinimo: Number(formulario.value.estoqueMinimo),
  });
  formulario.value = { nome: '', apresentacao: '', estoque: 0, estoqueMinimo: 5 };
  await carregar();
}

async function ajustar(item: MedicamentoClinica, delta: number) {
  await servicoSaude.ajustarEstoque(item.id, Math.max(0, item.estoque + delta));
  await carregar();
}

onMounted(carregar);
</script>

<template>
  <div class="space-y-6">
    <form class="space-y-3 rounded-md border border-borda bg-branco p-4" @submit.prevent="criar">
      <h2 class="text-sm font-semibold text-carvao">Novo medicamento</h2>
      <div class="grid gap-3 md:grid-cols-5">
      <input v-model="formulario.nome" required placeholder="Medicamento" class="h-10 rounded-md border border-borda px-3 text-sm" />
      <input v-model="formulario.apresentacao" placeholder="Apresentação" class="h-10 rounded-md border border-borda px-3 text-sm" />
      <input v-model.number="formulario.estoque" type="number" min="0" placeholder="Estoque" class="h-10 rounded-md border border-borda px-3 text-sm" />
      <input v-model.number="formulario.estoqueMinimo" type="number" min="0" placeholder="Mínimo" class="h-10 rounded-md border border-borda px-3 text-sm" />
      <Button type="submit">Incluir</Button>
      </div>
    </form>
    <ul class="divide-y divide-borda overflow-hidden rounded-md border border-borda bg-branco">
      <li v-for="item in medicamentos" :key="item.id" class="flex items-center justify-between gap-4 px-4 py-3">
        <div>
          <p class="font-medium text-carvao">{{ item.nome }}</p>
          <p class="text-xs text-texto-secundario">{{ item.apresentacao || 'Sem apresentação' }}</p>
        </div>
        <div class="flex items-center gap-3">
          <span v-if="item.estoque <= item.estoqueMinimo" class="rounded-full bg-[#fff4df] px-2.5 py-0.5 text-[11px] font-semibold text-[#8a5a12]">
            Abaixo do mínimo
          </span>
          <span :class="item.estoque <= item.estoqueMinimo ? 'text-erro' : 'text-carvao'" class="text-sm font-semibold">
            {{ item.estoque }} un.
          </span>
          <button class="rounded-md border border-borda px-2 py-1 text-xs" @click="ajustar(item, -1)">−</button>
          <button class="rounded-md border border-borda px-2 py-1 text-xs" @click="ajustar(item, 1)">+</button>
        </div>
      </li>
    </ul>
  </div>
</template>
