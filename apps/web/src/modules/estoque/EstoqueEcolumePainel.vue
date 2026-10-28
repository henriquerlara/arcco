<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  Search,
  SlidersHorizontal,
  ChevronRight,
  Printer,
  Download,
} from 'lucide-vue-next';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import EstadoVazio from '@/components/compartilhados/EstadoVazio.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import FornecedoresView from '@/modules/fornecedores/FornecedoresView.vue';
import { servicoProdutos, servicoFornecedores } from '@/services';
import { formatarNumero, formatarMoeda, formatarDataHora } from '@/composables/formatadores';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import {
  PerfilUsuario,
  PermissaoComercial,
  StatusEstoqueEcolume,
  STATUS_ESTOQUE_ECOLUME_ROTULOS,
  TipoMovimentacaoEstoque,
} from '@arcco/contratos';
import type { ProdutoEstoqueEcolume, GrupoListaCompra, MovimentacaoEstoqueGlobal } from '@/types';

type Aba = 'produtos' | 'movimentacoes' | 'fornecedores' | 'lista-compra';

const queryClient = useQueryClient();
const auth = useAutenticacaoStore();
const rota = useRoute();
const router = useRouter();

const podeVerCustos = computed(() => auth.temPermissaoComercial(PermissaoComercial.VER_CUSTOS));
const podeAjustar = computed(
  () =>
    auth.temPerfil(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR) &&
    auth.temPermissaoComercial(PermissaoComercial.AJUSTAR_ESTOQUE),
);

const aba = ref<Aba>((rota.query.aba as Aba) || 'produtos');
watch(aba, (v) => {
  void router.replace({ query: { ...rota.query, aba: v === 'produtos' ? undefined : v } });
});

const busca = ref('');
const buscaDebounced = ref('');
const statusFiltro = ref<string>('');
const fornecedorFiltro = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;
watch(busca, (v) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    buscaDebounced.value = v.trim();
  }, 250);
});

const filtrosProdutos = computed(() => ({
  busca: buscaDebounced.value || undefined,
  status: (statusFiltro.value || undefined) as
    | (typeof StatusEstoqueEcolume)[keyof typeof StatusEstoqueEcolume]
    | undefined,
  fornecedorId: fornecedorFiltro.value || undefined,
}));

const { data: resumo } = useQuery({
  queryKey: ['estoque', 'resumo'],
  queryFn: () => servicoProdutos.resumoEstoque(),
});

const {
  data: produtosData,
  isLoading: carregandoProdutos,
  isError: erroProdutos,
  error: erroProdutosObj,
  refetch: refetchProdutos,
} = useQuery({
  queryKey: computed(() => ['estoque', 'ecolume', filtrosProdutos.value]),
  queryFn: () => servicoProdutos.listarEstoque(filtrosProdutos.value),
  enabled: computed(() => aba.value === 'produtos'),
});

const produtos = computed(() => (produtosData.value ?? []) as ProdutoEstoqueEcolume[]);

const { data: produtosFiltroMov } = useQuery({
  queryKey: ['estoque', 'ecolume', 'filtro-mov'],
  queryFn: () => servicoProdutos.listarEstoque({}),
  enabled: computed(() => aba.value === 'movimentacoes'),
  staleTime: 60_000,
});
const opcoesProdutoMov = computed(
  () => (produtosFiltroMov.value ?? []) as ProdutoEstoqueEcolume[],
);

const { data: fornecedoresData } = useQuery({
  queryKey: ['fornecedores', 'filtro-estoque'],
  queryFn: () => servicoFornecedores.listar(),
  staleTime: 60_000,
});

const filtroMovProduto = ref('');
const filtroMovTipo = ref('');
const filtroMovDe = ref('');
const filtroMovAte = ref('');
const filtroMovUsuario = ref('');

const filtrosMov = computed(() => ({
  produtoId: filtroMovProduto.value || undefined,
  tipo: (filtroMovTipo.value || undefined) as
    | (typeof TipoMovimentacaoEstoque)[keyof typeof TipoMovimentacaoEstoque]
    | undefined,
  de: filtroMovDe.value || undefined,
  ate: filtroMovAte.value || undefined,
  usuarioId: filtroMovUsuario.value.trim() || undefined,
}));

const {
  data: movsData,
  isLoading: carregandoMovs,
  refetch: refetchMovs,
} = useQuery({
  queryKey: computed(() => ['estoque', 'movimentacoes-global', filtrosMov.value]),
  queryFn: () => servicoProdutos.listarMovimentacoesEstoque(filtrosMov.value),
  enabled: computed(() => aba.value === 'movimentacoes'),
});
const movimentacoes = computed(() => (movsData.value ?? []) as MovimentacaoEstoqueGlobal[]);

const {
  data: listaCompraData,
  isLoading: carregandoLista,
  refetch: refetchLista,
} = useQuery({
  queryKey: ['estoque', 'lista-compra'],
  queryFn: () => servicoProdutos.listaCompra(),
  enabled: computed(() => aba.value === 'lista-compra'),
});
const listaCompra = computed(() => (listaCompraData.value ?? []) as GrupoListaCompra[]);

function varianteStatus(status: string) {
  if (status === 'A_COMPRAR') return 'erro' as const;
  if (status === 'BAIXO') return 'alerta' as const;
  if (status === 'SOB_ENCOMENDA') return 'neutro' as const;
  return 'sucesso' as const;
}

function exportarGrupo(grupo: GrupoListaCompra) {
  const linhas = [
    ['Descricao', 'Codigo interno', 'Codigo fornecedor', 'Unidade', 'Saldo', 'Faltante'],
    ...grupo.itens.map((i) => [
      i.descricaoComercial,
      i.codigoInterno ?? '',
      i.codigoFornecedor ?? '',
      i.unidade,
      String(i.saldo),
      String(i.quantidadeFaltante),
    ]),
  ];
  const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lista-compra-${grupo.fornecedorNome.replace(/\s+/g, '-').toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function imprimirGrupo(grupo: GrupoListaCompra) {
  const win = window.open('', '_blank');
  if (!win) return;
  const linhas = grupo.itens
    .map(
      (i) =>
        `<tr><td>${i.descricaoComercial}</td><td>${i.codigoInterno ?? ''}</td><td>${i.quantidadeFaltante} ${i.unidade}</td></tr>`,
    )
    .join('');
  win.document.write(`<!doctype html><html><head><title>Lista ${grupo.fornecedorNome}</title>
    <style>body{font-family:sans-serif;padding:24px} table{border-collapse:collapse;width:100%}
    td,th{border:1px solid #ccc;padding:6px 8px;text-align:left}</style></head><body>
    <h1>Lista de compra — ${grupo.fornecedorNome}</h1>
    <table><thead><tr><th>Produto</th><th>Código</th><th>Faltante</th></tr></thead>
    <tbody>${linhas}</tbody></table>
    <p>Total faltante: ${grupo.totalFaltante}</p>
    <script>window.print()<\/script></body></html>`);
  win.document.close();
}

async function atualizarAba() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['estoque'] }),
    refetchProdutos(),
    refetchMovs(),
    refetchLista(),
  ]);
}
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina
      titulo="Estoque"
      descricao="Produtos, movimentações, fornecedores e lista de compra."
    >
      <template #acoes>
        <RouterLink
          to="/app/fiscal/notas-entrada"
          class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-borda px-4 text-sm font-semibold text-carvao hover:border-dourado"
        >
          Importar XML
        </RouterLink>
      </template>
    </CabecalhoPagina>

    <div class="grid gap-3 sm:grid-cols-4">
      <Card class="p-4">
        <p class="text-xs text-texto-secundario">Cadastrados</p>
        <p class="mt-1 text-2xl font-semibold">{{ formatarNumero(resumo?.produtosCadastrados ?? resumo?.totalComControle) }}</p>
      </Card>
      <Card class="p-4">
        <p class="text-xs text-texto-secundario">Abaixo do mínimo</p>
        <p class="mt-1 text-2xl font-semibold text-alerta">{{ formatarNumero(resumo?.abaixoMinimo ?? resumo?.criticos) }}</p>
      </Card>
      <Card class="p-4">
        <p class="text-xs text-texto-secundario">A comprar</p>
        <p class="mt-1 text-2xl font-semibold text-erro">{{ formatarNumero(resumo?.aComprar) }}</p>
      </Card>
      <Card class="p-4">
        <p class="text-xs text-texto-secundario">Sob encomenda</p>
        <p class="mt-1 text-2xl font-semibold">{{ formatarNumero(resumo?.sobEncomenda) }}</p>
      </Card>
    </div>

    <div class="flex flex-wrap gap-1 border-b border-borda pb-px">
      <button
        v-for="item in [
          { id: 'produtos', rotulo: 'Produtos e saldo' },
          { id: 'movimentacoes', rotulo: 'Movimentações' },
          { id: 'fornecedores', rotulo: 'Fornecedores' },
          { id: 'lista-compra', rotulo: 'Lista de compra' },
        ] as const"
        :key="item.id"
        type="button"
        class="rounded-t-md px-3 py-2 text-sm font-medium"
        :class="aba === item.id ? 'bg-marfim text-texto border border-b-0 border-borda' : 'text-texto-secundario hover:text-texto'"
        @click="aba = item.id"
      >
        {{ item.rotulo }}
      </button>
    </div>

    <!-- Produtos -->
    <div v-if="aba === 'produtos'" class="space-y-3">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div class="relative min-w-0 flex-1">
          <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-secundario" />
          <Input
            v-model="busca"
            class="pl-9"
            placeholder="Descrição comercial, fiscal, código interno, fornecedor ou EAN"
          />
        </div>
        <select v-model="statusFiltro" class="h-10 rounded-md border border-borda bg-fundo px-3 text-sm">
          <option value="">Todos os status</option>
          <option v-for="(rotulo, chave) in STATUS_ESTOQUE_ECOLUME_ROTULOS" :key="chave" :value="chave">
            {{ rotulo }}
          </option>
        </select>
        <select v-model="fornecedorFiltro" class="h-10 rounded-md border border-borda bg-fundo px-3 text-sm">
          <option value="">Todos os fornecedores</option>
          <option v-for="f in fornecedoresData ?? []" :key="f.id" :value="f.id">
            {{ f.nomeCurto || f.nome }}
          </option>
        </select>
      </div>

      <EstadoErro v-if="erroProdutos" :erro="erroProdutosObj" @tentar-novamente="refetchProdutos()" />
      <div v-else-if="carregandoProdutos" class="space-y-2">
        <Skeleton v-for="n in 5" :key="n" class="h-14" />
      </div>
      <EstadoVazio v-else-if="produtos.length === 0" titulo="Nenhum produto" descricao="Ajuste os filtros ou cadastre itens." />
      <div v-else class="overflow-x-auto rounded-md border border-borda">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="border-b border-borda bg-marfim/60 text-xs uppercase text-texto-secundario">
            <tr>
              <th class="px-3 py-2 font-medium">Descrição</th>
              <th class="px-3 py-2 font-medium">Fornecedor</th>
              <th class="px-3 py-2 font-medium">Saldo</th>
              <th class="px-3 py-2 font-medium">Mín.</th>
              <th v-if="podeVerCustos" class="px-3 py-2 font-medium">Últ. preço</th>
              <th v-if="podeVerCustos" class="px-3 py-2 font-medium">Custo médio</th>
              <th v-if="podeVerCustos" class="px-3 py-2 font-medium">Sugerido</th>
              <th class="px-3 py-2 font-medium">Status</th>
              <th class="px-3 py-2 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in produtos" :key="p.id" class="border-b border-borda/60 last:border-0 hover:bg-marfim/40">
              <td class="px-3 py-2">
                <RouterLink :to="`/app/estoque/${p.id}`" class="font-medium hover:underline">
                  {{ p.descricaoComercial || p.nome }}
                </RouterLink>
                <p class="text-xs text-texto-secundario">
                  <span v-if="p.codigoInterno">{{ p.codigoInterno }}</span>
                  <span v-if="p.nomeFiscal"> · {{ p.nomeFiscal }}</span>
                </p>
              </td>
              <td class="px-3 py-2 text-texto-secundario">
                {{ p.fornecedor?.nomeCurto || p.fornecedor?.nome || '—' }}
              </td>
              <td class="px-3 py-2 font-medium">
                {{ formatarNumero(p.estoqueAtual) }}
                <span class="text-texto-secundario">{{ p.unidade }}</span>
              </td>
              <td class="px-3 py-2 text-texto-secundario">{{ formatarNumero(p.estoqueMinimo) }}</td>
              <td v-if="podeVerCustos" class="px-3 py-2">
                {{ p.ultimoPreco != null ? formatarMoeda(p.ultimoPreco) : '—' }}
              </td>
              <td v-if="podeVerCustos" class="px-3 py-2">
                {{ p.custoMedio != null ? formatarMoeda(p.custoMedio) : '—' }}
              </td>
              <td v-if="podeVerCustos" class="px-3 py-2">
                {{ p.precoSugerido != null ? formatarMoeda(p.precoSugerido) : '—' }}
              </td>
              <td class="px-3 py-2">
                <Badge :variante="varianteStatus(p.status)">
                  {{ STATUS_ESTOQUE_ECOLUME_ROTULOS[p.status] || p.status }}
                </Badge>
              </td>
              <td class="px-3 py-2">
                <div class="flex justify-end gap-1">
                  <RouterLink
                    v-if="podeAjustar"
                    :to="`/app/estoque/${p.id}`"
                    class="inline-flex size-8 items-center justify-center rounded-sm hover:bg-marfim"
                    title="Ajustar estoque"
                  >
                    <SlidersHorizontal class="size-4" />
                  </RouterLink>
                  <RouterLink
                    :to="`/app/estoque/${p.id}`"
                    class="inline-flex size-8 items-center justify-center rounded-sm hover:bg-marfim"
                    title="Ficha / movimentações"
                  >
                    <ChevronRight class="size-4" />
                  </RouterLink>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Movimentações -->
    <div v-else-if="aba === 'movimentacoes'" class="space-y-3">
      <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <select v-model="filtroMovProduto" class="h-10 rounded-md border border-borda bg-fundo px-3 text-sm">
          <option value="">Todos os produtos</option>
          <option v-for="p in opcoesProdutoMov" :key="p.id" :value="p.id">
            {{ p.descricaoComercial || p.nome }}
          </option>
        </select>
        <select v-model="filtroMovTipo" class="h-10 rounded-md border border-borda bg-fundo px-3 text-sm">
          <option value="">Todos os tipos</option>
          <option value="ENTRADA">Entrada</option>
          <option value="BAIXA">Baixa</option>
          <option value="AJUSTE">Ajuste</option>
        </select>
        <Input v-model="filtroMovDe" type="date" class="h-10" />
        <Input v-model="filtroMovAte" type="date" class="h-10" />
        <Input v-model="filtroMovUsuario" class="h-10 max-w-[14rem]" placeholder="Usuário (id)" />
        <Button variante="secundario" @click="atualizarAba">Atualizar</Button>
      </div>
      <div v-if="carregandoMovs" class="space-y-2"><Skeleton v-for="n in 4" :key="n" class="h-12" /></div>
      <EstadoVazio v-else-if="movimentacoes.length === 0" titulo="Sem movimentações" descricao="Nenhum lançamento no filtro." />
      <div v-else class="overflow-x-auto rounded-md border border-borda">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-borda bg-marfim/60 text-xs uppercase text-texto-secundario">
            <tr>
              <th class="px-3 py-2">Data</th>
              <th class="px-3 py-2">Produto</th>
              <th class="px-3 py-2">Tipo</th>
              <th class="px-3 py-2">Qtd</th>
              <th class="px-3 py-2">Saldo após</th>
              <th class="px-3 py-2">Obs.</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in movimentacoes" :key="m.id" class="border-b border-borda/60">
              <td class="px-3 py-2 whitespace-nowrap">{{ formatarDataHora(m.criadoEm) }}</td>
              <td class="px-3 py-2">
                <RouterLink :to="`/app/estoque/${m.produtoId}`" class="hover:underline">
                  {{ m.produto?.descricaoComercial || m.produto?.nome || m.produtoId }}
                </RouterLink>
              </td>
              <td class="px-3 py-2">{{ m.tipo }}</td>
              <td class="px-3 py-2">{{ formatarNumero(m.quantidade) }}</td>
              <td class="px-3 py-2">{{ formatarNumero(m.saldoApos) }}</td>
              <td class="px-3 py-2 text-texto-secundario">{{ m.observacao || m.motivo || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Fornecedores -->
    <div v-else-if="aba === 'fornecedores'">
      <FornecedoresView embutido />
    </div>

    <!-- Lista de compra -->
    <div v-else class="space-y-3">
      <p class="text-sm text-texto-secundario">
        Itens com saldo negativo. Quantidade faltante = |saldo|. Pedidos de origem entram quando a ECOL-16 existir.
      </p>
      <div v-if="carregandoLista" class="space-y-2"><Skeleton v-for="n in 3" :key="n" class="h-24" /></div>
      <EstadoVazio
        v-else-if="listaCompra.length === 0"
        titulo="Nada a comprar"
        descricao="Não há produtos com saldo negativo."
      />
      <Card v-for="grupo in listaCompra" :key="grupo.fornecedorId ?? 'sem'" class="space-y-3 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p class="font-medium">{{ grupo.fornecedorNome }}</p>
            <p class="text-xs text-texto-secundario">
              {{ grupo.itens.length }} item(ns) · faltante total {{ formatarNumero(grupo.totalFaltante) }}
            </p>
          </div>
          <div class="flex gap-2">
            <Button variante="secundario" tamanho="sm" @click="imprimirGrupo(grupo)">
              <Printer class="size-4" /> Imprimir
            </Button>
            <Button variante="secundario" tamanho="sm" @click="exportarGrupo(grupo)">
              <Download class="size-4" /> Exportar
            </Button>
          </div>
        </div>
        <ul class="divide-y divide-borda text-sm">
          <li v-for="item in grupo.itens" :key="item.produtoId" class="flex justify-between gap-3 py-2">
            <RouterLink :to="`/app/estoque/${item.produtoId}`" class="hover:underline">
              {{ item.descricaoComercial }}
              <span class="text-texto-secundario">{{ item.codigoInterno ? ` · ${item.codigoInterno}` : '' }}</span>
            </RouterLink>
            <span class="shrink-0 font-medium text-erro">
              {{ formatarNumero(item.quantidadeFaltante) }} {{ item.unidade }}
            </span>
          </li>
        </ul>
      </Card>
    </div>
  </div>
</template>
