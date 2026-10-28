<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { Filter, Plus } from 'lucide-vue-next';
import { PersonalizacaoComercial } from '@arcco/contratos';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import SeletorUsuario from '@/components/formularios/SeletorUsuario.vue';
import SeletorCategoria from '@/components/formularios/SeletorCategoria.vue';
import Button from '@/components/ui/Button.vue';
import ColunaPipeline from './ColunaPipeline.vue';
import PipelineEcolume from './PipelineEcolume.vue';
import OportunidadeFormulario from '@/modules/oportunidades/OportunidadeFormulario.vue';
import { servicoOportunidades, type ColunaPipeline as TColuna } from '@/services';
import { formatarMoeda } from '@/composables/formatadores';
import { useAutenticacaoStore } from '@/stores/autenticacao';

const auth = useAutenticacaoStore();
const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);

const router = useRouter();

const responsavelId = ref<string | null>(null);
const categoriaId = ref<string | null>(null);
const filtrosVisiveis = ref(false);
const formAberto = ref(false);

const filtros = computed(() => ({
  responsavelId: responsavelId.value ?? undefined,
  categoriaId: categoriaId.value ?? undefined,
}));

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['pipeline', filtros.value]),
  queryFn: () => servicoOportunidades.pipeline(filtros.value),
  enabled: computed(() => !ecolume.value),
});

const colunas = ref<TColuna[]>([]);
watch(
  data,
  (v) => {
    if (v && Array.isArray(v)) {
      colunas.value = v.map((c) => ({ etapa: c.etapa, oportunidades: [...c.oportunidades] }));
    }
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

function abrirParaOrcamento(id: string) {
  void router.push({
    name: 'oportunidade-detalhe',
    params: { id },
    query: { enviarOrcamento: '1' },
  });
}
</script>

<template>
  <PipelineEcolume v-if="ecolume" />
  <div v-else class="flex h-full flex-col gap-5">
    <CabecalhoPagina
      titulo="Negócios"
      :descricao="`Progresso atualizado pelas ações do time · ${formatarMoeda(valorTotal)} em jogo`"
    >
      <template #acoes>
        <Button variante="secundario" @click="filtrosVisiveis = !filtrosVisiveis">
          <Filter class="size-4" />
          Filtros
        </Button>
        <Button @click="formAberto = true">
          <Plus class="size-4" />
          Novo negócio
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

    <div v-else-if="isLoading" class="flex min-h-0 flex-1 gap-3">
      <Skeleton v-for="n in 4" :key="n" class="h-96 min-w-0 flex-1 basis-0" />
    </div>

    <div v-else class="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-1">
      <ColunaPipeline
        v-for="coluna in colunas"
        :key="coluna.etapa.id"
        :etapa="coluna.etapa"
        :oportunidades="coluna.oportunidades"
        @abrir="abrir"
        @enviar-orcamento="abrirParaOrcamento"
      />
    </div>

    <OportunidadeFormulario v-model="formAberto" />
  </div>
</template>
