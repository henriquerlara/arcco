<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { refDebounced } from '@vueuse/core';
import { Plus, Search, Users } from 'lucide-vue-next';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import TabelaDados, { type ColunaTabela } from '@/components/compartilhados/TabelaDados.vue';
import Paginacao from '@/components/compartilhados/Paginacao.vue';
import EstadoVazio from '@/components/compartilhados/EstadoVazio.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import ContatoFormulario from './ContatoFormulario.vue';
import type { Contato } from '@/types';
import { servicoContatos } from '@/services';
import { formatarTelefone, iniciais } from '@/composables/formatadores';
import { ROTULO_TIPO_CONTATO, opcoesDe } from '@/composables/rotulos';

const router = useRouter();

const busca = ref('');
const buscaDebounced = refDebounced(busca, 350);
const tipo = ref('');
const pagina = ref(1);
const formAberto = ref(false);

const opcoesTipo = [{ valor: '', rotulo: 'Todos os tipos' }, ...opcoesDe(ROTULO_TIPO_CONTATO)];

const filtros = computed(() => ({
  busca: buscaDebounced.value || undefined,
  tipo: tipo.value || undefined,
  pagina: pagina.value,
  porPagina: 15,
}));

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['contatos', filtros.value]),
  queryFn: () => servicoContatos.listar(filtros.value),
});

const colunas: ColunaTabela[] = [
  { chave: 'nome', rotulo: 'Nome' },
  { chave: 'tipo', rotulo: 'Tipo' },
  { chave: 'telefone', rotulo: 'Telefone' },
  { chave: 'empresaNome', rotulo: 'Empresa' },
  { chave: 'oportunidades', rotulo: 'Negócios', alinhamento: 'centro' },
  { chave: 'obras', rotulo: 'Projetos', alinhamento: 'centro' },
];

const linhas = computed(() => data.value?.dados ?? []);

function abrirDetalhe(contato: Contato) {
  void router.push({ name: 'contato-detalhe', params: { id: contato.id } });
}
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina titulo="Pessoas" descricao="Pessoas e empresas do seu relacionamento comercial.">
      <template #acoes>
        <Button @click="formAberto = true">
          <Plus class="size-4" />
          Nova pessoa
        </Button>
      </template>
    </CabecalhoPagina>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-secundario" />
        <Input v-model="busca" placeholder="Buscar por nome, telefone ou empresa" class="pl-9" />
      </div>
      <Select v-model="tipo" :opcoes="opcoesTipo" class="sm:w-52" />
    </div>

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />

    <EstadoVazio
      v-else-if="!isLoading && linhas.length === 0"
      titulo="Nenhuma pessoa encontrada"
      descricao="Cadastre a primeira pessoa ou ajuste a busca."
      :icone="Users"
    >
      <template #acao>
        <Button @click="formAberto = true">
          <Plus class="size-4" />
          Nova pessoa
        </Button>
      </template>
    </EstadoVazio>

    <TabelaDados
      v-else
      :colunas="colunas"
      :linhas="linhas"
      :carregando="isLoading"
      clicavel
      @linha-clique="abrirDetalhe"
    >
      <template #celula-nome="{ linha }">
        <div class="flex items-center gap-3">
          <span class="flex size-8 items-center justify-center rounded-full bg-marfim text-xs font-semibold text-texto-secundario">
            {{ iniciais((linha as Contato).nome) }}
          </span>
          <div>
            <p class="font-medium text-texto">{{ (linha as Contato).nome }}</p>
            <p v-if="(linha as Contato).email" class="text-xs text-texto-secundario">
              {{ (linha as Contato).email }}
            </p>
          </div>
        </div>
      </template>
      <template #celula-tipo="{ linha }">
        <Badge variante="neutro">{{ ROTULO_TIPO_CONTATO[(linha as Contato).tipo] }}</Badge>
      </template>
      <template #celula-telefone="{ linha }">
        {{ formatarTelefone((linha as Contato).telefone) }}
      </template>
      <template #celula-empresaNome="{ linha }">
        {{ (linha as Contato).empresaNome || '—' }}
      </template>
      <template #celula-oportunidades="{ linha }">
        <span class="font-medium">{{ (linha as Contato).totalOportunidades ?? 0 }}</span>
      </template>
      <template #celula-obras="{ linha }">
        <span class="font-medium">{{ (linha as Contato).totalObras ?? 0 }}</span>
      </template>

      <template #rodape>
        <Paginacao
          v-if="data?.paginacao"
          :paginacao="data.paginacao"
          @mudar="(p) => (pagina = p)"
        />
      </template>
    </TabelaDados>

    <ContatoFormulario v-model="formAberto" />
  </div>
</template>
