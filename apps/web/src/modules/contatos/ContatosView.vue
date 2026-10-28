<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { refDebounced } from '@vueuse/core';
import { Handshake, Plus, Search, Users, Wallet } from 'lucide-vue-next';
import {
  NaturezaPessoa,
  PermissaoComercial,
  PersonalizacaoComercial,
  TipoParceiro,
} from '@arcco/contratos';
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
import ComissoesAPagarPainel from './ComissoesAPagarPainel.vue';
import type { Contato } from '@/types';
import { servicoContatos } from '@/services';
import { formatarMoeda, formatarTelefone, iniciais } from '@/composables/formatadores';
import { ROTULO_TIPO_CONTATO, opcoesDe } from '@/composables/rotulos';
import { useAutenticacaoStore } from '@/stores/autenticacao';

const ROTULO_TIPO_PARCEIRO: Record<string, string> = {
  [TipoParceiro.ARQUITETO_DESIGNER]: 'Arquiteto/Designer',
  [TipoParceiro.INSTALADOR_ELETRICISTA]: 'Instalador/Eletricista',
  [TipoParceiro.CONSTRUTORA]: 'Construtora',
};

const router = useRouter();
const route = useRoute();
const auth = useAutenticacaoStore();

const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);
const abaParceiros = computed(() => route.name === 'parceiros');
const podeVerFaturamento = computed(() =>
  auth.temPermissaoComercial(PermissaoComercial.VER_FATURAMENTO),
);
const podeVerComissoes = computed(() =>
  auth.temPermissaoComercial(PermissaoComercial.VER_COMISSOES),
);
const comissoesAbertas = ref(false);
/** Período simples por mês (YYYY-MM). Vazio = todo o histórico. */
const mes = ref('');

function rotuloMes(data: Date): string {
  const texto = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
const opcoesMes = computed(() => {
  const hoje = new Date();
  const lista = [{ valor: '', rotulo: 'Todo o período' }];
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    lista.push({ valor, rotulo: rotuloMes(d) });
  }
  return lista;
});
const periodo = computed(() => {
  if (!mes.value) return { de: undefined, ate: undefined };
  const [ano = 0, mm = 1] = mes.value.split('-').map(Number);
  const ultimo = new Date(ano, mm, 0).getDate();
  return { de: `${mes.value}-01`, ate: `${mes.value}-${String(ultimo).padStart(2, '0')}` };
});
const mostrarPeriodo = computed(
  () =>
    ecolume.value &&
    abaParceiros.value &&
    (podeVerFaturamento.value || podeVerComissoes.value),
);

const busca = ref('');
const buscaDebounced = refDebounced(busca, 350);
const tipo = ref('');
const natureza = ref('');
const parceiro = ref('');
const cidade = ref('');
const pagina = ref(1);
const formAberto = ref(false);

const opcoesTipo = [{ valor: '', rotulo: 'Todos os tipos' }, ...opcoesDe(ROTULO_TIPO_CONTATO)];
const opcoesNatureza = [
  { valor: '', rotulo: 'PF e PJ' },
  { valor: NaturezaPessoa.PF, rotulo: 'Pessoa física' },
  { valor: NaturezaPessoa.PJ, rotulo: 'Pessoa jurídica' },
];
const opcoesParceiro = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'true', rotulo: 'Parceiros' },
  { valor: 'false', rotulo: 'Não parceiros' },
];

const filtros = computed(() => ({
  busca: buscaDebounced.value || undefined,
  tipo: ecolume.value ? undefined : tipo.value || undefined,
  natureza: ecolume.value ? natureza.value || undefined : undefined,
  parceiro: ecolume.value
    ? abaParceiros.value
      ? 'true'
      : parceiro.value || undefined
    : undefined,
  cidade: ecolume.value ? cidade.value.trim() || undefined : undefined,
  de: mostrarPeriodo.value ? periodo.value.de : undefined,
  ate: mostrarPeriodo.value ? periodo.value.ate : undefined,
  pagina: pagina.value,
  porPagina: 15,
}));

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['contatos', filtros.value, abaParceiros.value]),
  queryFn: () => servicoContatos.listar(filtros.value),
});

const colunas = computed<ColunaTabela[]>(() => {
  if (abaParceiros.value) {
    const cols: ColunaTabela[] = [
      { chave: 'nome', rotulo: 'Nome' },
      { chave: 'tipo', rotulo: 'Tipo' },
      { chave: 'telefone', rotulo: 'Telefone' },
      { chave: 'rt', rotulo: 'RT %', alinhamento: 'centro' },
      { chave: 'cidade', rotulo: 'Cidade' },
    ];
    if (ecolume.value && podeVerFaturamento.value) {
      cols.push(
        { chave: 'vendas', rotulo: 'Vendas', alinhamento: 'centro' },
        { chave: 'valorVendido', rotulo: 'Valor vendido', alinhamento: 'direita' },
      );
    }
    if (ecolume.value && podeVerComissoes.value) {
      cols.push(
        { chave: 'comissaoAPagar', rotulo: 'A pagar', alinhamento: 'direita' },
        { chave: 'comissaoPaga', rotulo: 'Paga', alinhamento: 'direita' },
      );
    }
    return cols;
  }
  if (ecolume.value) {
    return [
      { chave: 'nome', rotulo: 'Nome' },
      { chave: 'tipo', rotulo: 'Tipo' },
      { chave: 'telefone', rotulo: 'Telefone' },
      { chave: 'cidade', rotulo: 'Cidade' },
      { chave: 'oportunidades', rotulo: 'Negócios', alinhamento: 'centro' },
    ];
  }
  return [
    { chave: 'nome', rotulo: 'Nome' },
    { chave: 'tipo', rotulo: 'Tipo' },
    { chave: 'telefone', rotulo: 'Telefone' },
    { chave: 'empresaNome', rotulo: 'Empresa' },
    { chave: 'oportunidades', rotulo: 'Negócios', alinhamento: 'centro' },
    { chave: 'obras', rotulo: 'Projetos', alinhamento: 'centro' },
  ];
});

const linhas = computed(() => data.value?.dados ?? []);

function abrirDetalhe(contato: Contato) {
  const nome = abaParceiros.value
    ? 'parceiro-detalhe'
    : ecolume.value
      ? 'cliente-detalhe'
      : 'contato-detalhe';
  void router.push({ name: nome, params: { id: contato.id } });
}

function rotuloTipo(contato: Contato): string {
  if (abaParceiros.value && contato.tipoParceiro) {
    return ROTULO_TIPO_PARCEIRO[contato.tipoParceiro] ?? contato.tipoParceiro;
  }
  if (ecolume.value && contato.natureza) {
    return contato.natureza === 'PJ' ? 'PJ' : 'PF';
  }
  return ROTULO_TIPO_CONTATO[contato.tipo] ?? contato.tipo;
}
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina
      :titulo="abaParceiros ? 'Parceiros' : ecolume ? 'Clientes' : 'Pessoas'"
      :descricao="
        abaParceiros
          ? 'Parceiros comerciais com RT e dados de pagamento.'
          : ecolume
            ? 'Clientes pessoa física e jurídica do relacionamento comercial.'
            : 'Pessoas e empresas do seu relacionamento comercial.'
      "
    >
      <template #acoes>
        <Button
          v-if="ecolume && abaParceiros && podeVerComissoes"
          variante="secundario"
          @click="comissoesAbertas = !comissoesAbertas"
        >
          <Wallet class="size-4" />
          {{ comissoesAbertas ? 'Ocultar comissões' : 'Comissões a pagar' }}
        </Button>
        <Button @click="formAberto = true">
          <Plus class="size-4" />
          {{ abaParceiros ? 'Novo parceiro' : ecolume ? 'Novo cliente' : 'Nova pessoa' }}
        </Button>
      </template>
    </CabecalhoPagina>

    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div class="relative min-w-[12rem] flex-1">
        <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-secundario" />
        <Input
          v-model="busca"
          :placeholder="
            ecolume
              ? 'Buscar por nome, fantasia, CPF/CNPJ ou telefone'
              : 'Buscar por nome, telefone ou empresa'
          "
          class="pl-9"
        />
      </div>
      <Select v-if="!ecolume" v-model="tipo" :opcoes="opcoesTipo" class="sm:w-52" />
      <template v-else-if="!abaParceiros">
        <Select v-model="natureza" :opcoes="opcoesNatureza" class="sm:w-44" />
        <Select v-model="parceiro" :opcoes="opcoesParceiro" class="sm:w-44" />
        <Input v-model="cidade" placeholder="Cidade" class="sm:w-40" />
      </template>
      <template v-else>
        <Input v-model="cidade" placeholder="Cidade" class="sm:w-40" />
        <Select v-if="mostrarPeriodo" v-model="mes" :opcoes="opcoesMes" class="sm:w-52" />
      </template>
    </div>

    <ComissoesAPagarPainel
      v-if="ecolume && abaParceiros && podeVerComissoes && comissoesAbertas"
      :de="periodo.de"
      :ate="periodo.ate"
    />

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />

    <EstadoVazio
      v-else-if="!isLoading && linhas.length === 0"
      :titulo="
        abaParceiros
          ? 'Nenhum parceiro encontrado'
          : ecolume
            ? 'Nenhum cliente encontrado'
            : 'Nenhuma pessoa encontrada'
      "
      :descricao="
        abaParceiros
          ? 'Marque um cliente como parceiro ou cadastre um novo.'
          : ecolume
            ? 'Cadastre o primeiro cliente ou ajuste a busca.'
            : 'Cadastre a primeira pessoa ou ajuste a busca.'
      "
      :icone="abaParceiros ? Handshake : Users"
    >
      <template #acao>
        <Button @click="formAberto = true">
          <Plus class="size-4" />
          {{ abaParceiros ? 'Novo parceiro' : ecolume ? 'Novo cliente' : 'Nova pessoa' }}
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
            <p
              v-if="ecolume && (linha as Contato).nomeFantasia"
              class="text-xs text-texto-secundario"
            >
              {{ (linha as Contato).nomeFantasia }}
            </p>
            <p v-else-if="(linha as Contato).email" class="text-xs text-texto-secundario">
              {{ (linha as Contato).email }}
            </p>
          </div>
        </div>
      </template>
      <template #celula-tipo="{ linha }">
        <div class="flex flex-wrap gap-1">
          <Badge variante="neutro">{{ rotuloTipo(linha as Contato) }}</Badge>
          <Badge v-if="(linha as Contato).ehParceiro" variante="dourado">Parceiro</Badge>
        </div>
      </template>
      <template #celula-telefone="{ linha }">
        {{ formatarTelefone((linha as Contato).telefone) }}
      </template>
      <template #celula-cidade="{ linha }">
        {{
          (linha as Contato).cidade
            ? `${(linha as Contato).cidade}${(linha as Contato).uf ? '/' + (linha as Contato).uf : ''}`
            : '—'
        }}
      </template>
      <template #celula-rt="{ linha }">
        {{
          (linha as Contato).rtPadrao != null ? `${Number((linha as Contato).rtPadrao)}%` : '—'
        }}
      </template>
      <template #celula-vendas="{ linha }">
        <span class="font-medium">{{ (linha as Contato).quantidadePedidos ?? 0 }}</span>
      </template>
      <template #celula-valorVendido="{ linha }">
        {{ formatarMoeda((linha as Contato).valorVendido ?? 0) }}
      </template>
      <template #celula-comissaoAPagar="{ linha }">
        {{ formatarMoeda((linha as Contato).comissaoAPagar ?? 0) }}
      </template>
      <template #celula-comissaoPaga="{ linha }">
        {{ formatarMoeda((linha as Contato).comissaoPaga ?? 0) }}
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

    <ContatoFormulario v-model="formAberto" :marcar-parceiro="abaParceiros" />
  </div>
</template>
