<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Filter } from 'lucide-vue-next';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import SeletorUsuario from '@/components/formularios/SeletorUsuario.vue';
import SeletorCategoria from '@/components/formularios/SeletorCategoria.vue';
import Button from '@/components/ui/Button.vue';
import ColunaPipeline from './ColunaPipeline.vue';
import { servicoOportunidades, type ColunaPipeline as TColuna } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { formatarMoeda } from '@/composables/formatadores';

const router = useRouter();
const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();

const responsavelId = ref<string | null>(null);
const categoriaId = ref<string | null>(null);
const filtrosVisiveis = ref(false);

const filtros = computed(() => ({
  responsavelId: responsavelId.value ?? undefined,
  categoriaId: categoriaId.value ?? undefined,
}));

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['pipeline', filtros.value]),
  queryFn: () => servicoOportunidades.pipeline(filtros.value),
});

const colunas = ref<TColuna[]>([]);
watch(
  data,
  (v) => {
    if (v) colunas.value = v.map((c) => ({ etapa: c.etapa, oportunidades: [...c.oportunidades] }));
  },
  { immediate: true },
);

const valorTotal = computed(() =>
  colunas.value
    .flatMap((c) => c.oportunidades)
    .reduce((s, o) => s + (o.valorEstimado ?? 0), 0),
);

function abrir(id: string) {
  void router.push({ name: 'oportunidade-detalhe', params: { id } });
}

async function mover({ oportunidadeId, etapaId }: { oportunidadeId: string; etapaId: string }) {
  try {
    await servicoOportunidades.mover(oportunidadeId, etapaId);
    sucesso('Oportunidade movida.');
    await queryClient.invalidateQueries({ queryKey: ['pipeline'] });
  } catch (e) {
    notificarErro(e, 'Não foi possível mover a oportunidade.');
    await refetch();
  }
}
</script>

<template>
  <div class="flex h-full flex-col gap-5">
    <CabecalhoPagina
      titulo="Pipeline"
      :descricao="`Arraste os cartões entre as etapas · ${formatarMoeda(valorTotal)} em jogo`"
    >
      <template #acoes>
        <Button variante="secundario" @click="filtrosVisiveis = !filtrosVisiveis">
          <Filter class="size-4" />
          Filtros
        </Button>
      </template>
    </CabecalhoPagina>

    <div
      v-if="filtrosVisiveis"
      class="grid gap-3 rounded-lg border border-borda bg-branco p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div>
        <p class="mb-1 text-xs font-medium text-texto-secundario">Responsável</p>
        <SeletorUsuario v-model="responsavelId" incluir-vazio rotulo-vazio="Todos" />
      </div>
      <div>
        <p class="mb-1 text-xs font-medium text-texto-secundario">Categoria</p>
        <SeletorCategoria v-model="categoriaId" incluir-vazio rotulo-vazio="Todas" />
      </div>
    </div>

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />

    <div v-else-if="isLoading" class="flex gap-4 overflow-x-auto pb-4">
      <Skeleton v-for="n in 5" :key="n" class="h-96 w-72 shrink-0" />
    </div>

    <div v-else class="flex flex-1 gap-4 overflow-x-auto pb-4">
      <ColunaPipeline
        v-for="coluna in colunas"
        :key="coluna.etapa.id"
        :etapa="coluna.etapa"
        :oportunidades="coluna.oportunidades"
        @abrir="abrir"
        @mover="mover"
      />
    </div>
  </div>
</template>
