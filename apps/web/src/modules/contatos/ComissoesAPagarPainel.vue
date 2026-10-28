<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import TabelaDados, { type ColunaTabela } from '@/components/compartilhados/TabelaDados.vue';
import Paginacao from '@/components/compartilhados/Paginacao.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import type { ComissaoParceiroLinha } from '@/types';
import { servicoContatos } from '@/services';
import { formatarData, formatarMoeda } from '@/composables/formatadores';

const props = defineProps<{ de?: string; ate?: string }>();

const pagina = ref(1);

const filtros = computed(() => ({
  status: 'A_PAGAR',
  de: props.de,
  ate: props.ate,
  pagina: pagina.value,
  porPagina: 10,
}));

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['comissoes', filtros.value]),
  queryFn: () => servicoContatos.listarComissoes(filtros.value),
});

const colunas: ColunaTabela[] = [
  { chave: 'data', rotulo: 'Data' },
  { chave: 'parceiro', rotulo: 'Parceiro' },
  { chave: 'cliente', rotulo: 'Cliente' },
  { chave: 'pedido', rotulo: 'Pedido' },
  { chave: 'venda', rotulo: 'Venda', alinhamento: 'direita' },
  { chave: 'rt', rotulo: 'RT', alinhamento: 'centro' },
  { chave: 'comissao', rotulo: 'Comissão', alinhamento: 'direita' },
];

const linhas = computed(() => data.value?.dados ?? []);
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex flex-wrap items-center justify-between gap-2">
        <span>Comissões a pagar</span>
        <span v-if="data?.totalComissaoAPagar != null" class="text-sm font-normal text-texto-secundario">
          Total: <strong class="text-texto">{{ formatarMoeda(data.totalComissaoAPagar) }}</strong>
        </span>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />
      <p
        v-else-if="!isLoading && linhas.length === 0"
        class="text-sm text-texto-secundario"
      >
        Nenhuma comissão a pagar no período.
      </p>
      <TabelaDados v-else :colunas="colunas" :linhas="linhas" :carregando="isLoading">
        <template #celula-data="{ linha }">
          {{ formatarData((linha as ComissaoParceiroLinha).data) }}
        </template>
        <template #celula-parceiro="{ linha }">
          <RouterLink
            :to="`/app/parceiros/${(linha as ComissaoParceiroLinha).parceiroId}`"
            class="font-medium text-texto hover:text-dourado-hover"
          >
            {{ (linha as ComissaoParceiroLinha).parceiroNome || '—' }}
          </RouterLink>
        </template>
        <template #celula-cliente="{ linha }">
          {{ (linha as ComissaoParceiroLinha).clienteNome }}
        </template>
        <template #celula-pedido="{ linha }">
          <RouterLink
            :to="`/app/oportunidades/${(linha as ComissaoParceiroLinha).oportunidadeId}`"
            class="hover:text-dourado-hover"
          >
            {{ (linha as ComissaoParceiroLinha).pedidoNumero }}
            <span class="block text-xs text-texto-secundario">
              {{ (linha as ComissaoParceiroLinha).negocioCodigo }}
            </span>
          </RouterLink>
        </template>
        <template #celula-venda="{ linha }">
          {{ formatarMoeda((linha as ComissaoParceiroLinha).valorVenda) }}
        </template>
        <template #celula-rt="{ linha }">
          {{
            (linha as ComissaoParceiroLinha).rtPercentual != null
              ? `${(linha as ComissaoParceiroLinha).rtPercentual}%`
              : '—'
          }}
        </template>
        <template #celula-comissao="{ linha }">
          {{
            (linha as ComissaoParceiroLinha).valorComissao != null
              ? formatarMoeda((linha as ComissaoParceiroLinha).valorComissao)
              : '—'
          }}
        </template>
        <template #rodape>
          <Paginacao
            v-if="data?.paginacao"
            :paginacao="data.paginacao"
            @mudar="(p) => (pagina = p)"
          />
        </template>
      </TabelaDados>
    </CardContent>
  </Card>
</template>
