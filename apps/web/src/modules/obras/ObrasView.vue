<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { refDebounced } from '@vueuse/core';
import { Plus, Search, Building2 } from 'lucide-vue-next';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import TabelaDados, { type ColunaTabela } from '@/components/compartilhados/TabelaDados.vue';
import Paginacao from '@/components/compartilhados/Paginacao.vue';
import EstadoVazio from '@/components/compartilhados/EstadoVazio.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import BadgeStatus from '@/components/compartilhados/BadgeStatus.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import ObraFormulario from './ObraFormulario.vue';
import type { Obra } from '@/types';
import { servicoObras } from '@/services';
import { ROTULO_STATUS_OBRA, opcoesDe } from '@/composables/rotulos';

const router = useRouter();
const busca = ref('');
const buscaDebounced = refDebounced(busca, 350);
const status = ref('');
const pagina = ref(1);
const formAberto = ref(false);

const opcoesStatus = [{ valor: '', rotulo: 'Todos os status' }, ...opcoesDe(ROTULO_STATUS_OBRA)];

const filtros = computed(() => ({
  busca: buscaDebounced.value || undefined,
  status: status.value || undefined,
  pagina: pagina.value,
  porPagina: 15,
}));

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['obras', filtros.value]),
  queryFn: () => servicoObras.listar(filtros.value),
});

const colunas: ColunaTabela[] = [
  { chave: 'nome', rotulo: 'Projeto' },
  { chave: 'status', rotulo: 'Status' },
  { chave: 'local', rotulo: 'Localização' },
  { chave: 'oportunidades', rotulo: 'Negócios', alinhamento: 'centro' },
];

const linhas = computed(() => data.value?.dados ?? []);

function abrir(obra: Obra) {
  void router.push({ name: 'obra-detalhe', params: { id: obra.id } });
}
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina titulo="Projetos" descricao="Empreendimentos e projetos que sua empresa atende.">
      <template #acoes>
        <Button @click="formAberto = true">
          <Plus class="size-4" /> Novo projeto
        </Button>
      </template>
    </CabecalhoPagina>

    <div class="flex flex-col gap-3 sm:flex-row">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-secundario" />
        <Input v-model="busca" placeholder="Buscar projeto por nome ou cidade" class="pl-9" />
      </div>
      <Select v-model="status" :opcoes="opcoesStatus" class="sm:w-52" />
    </div>

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />

    <EstadoVazio
      v-else-if="!isLoading && linhas.length === 0"
      titulo="Nenhum projeto cadastrado"
      descricao="Cadastre o primeiro projeto para vincular pessoas e negócios."
      :icone="Building2"
    >
      <template #acao>
        <Button @click="formAberto = true"><Plus class="size-4" /> Novo projeto</Button>
      </template>
    </EstadoVazio>

    <TabelaDados v-else :colunas="colunas" :linhas="linhas" :carregando="isLoading" clicavel @linha-clique="abrir">
      <template #celula-nome="{ linha }">
        <div>
          <p class="font-medium text-texto">{{ (linha as Obra).nome }}</p>
          <p v-if="(linha as Obra).identificacao" class="text-xs text-texto-secundario">
            {{ (linha as Obra).identificacao }}
          </p>
        </div>
      </template>
      <template #celula-status="{ linha }">
        <BadgeStatus familia="statusObra" :valor="(linha as Obra).status" />
      </template>
      <template #celula-local="{ linha }">
        {{ [(linha as Obra).cidade, (linha as Obra).estado].filter(Boolean).join(' · ') || '—' }}
      </template>
      <template #celula-oportunidades="{ linha }">
        <span class="font-medium">{{ (linha as Obra).totalOportunidades ?? 0 }}</span>
      </template>
      <template #rodape>
        <Paginacao v-if="data?.paginacao" :paginacao="data.paginacao" @mudar="(p) => (pagina = p)" />
      </template>
    </TabelaDados>

    <ObraFormulario v-model="formAberto" />
  </div>
</template>
