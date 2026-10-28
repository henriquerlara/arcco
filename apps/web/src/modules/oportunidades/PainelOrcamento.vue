<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  Copy,
  FileText,
  Plus,
  Send,
  AlertTriangle,
  List,
  ShoppingCart,
  Trash2,
} from 'lucide-vue-next';
import {
  PersonalizacaoComercial,
  PermissaoComercial,
  calcularMargemEfetiva,
  calcularPrecoUnitarioLinha,
} from '@arcco/contratos';
import type { BaseCustoItemOrcamento } from '@/types';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import Dialog from '@/components/ui/Dialog.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Select from '@/components/ui/Select.vue';
import Textarea from '@/components/ui/Textarea.vue';
import ModalConfirmacao from '@/components/compartilhados/ModalConfirmacao.vue';
import AssistenteConversaoPedido from './AssistenteConversaoPedido.vue';
import type { Orcamento, Produto } from '@/types';
import {
  servicoArquivos,
  servicoFornecedores,
  servicoOrcamentos,
  servicoProdutos,
} from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { formatarMoeda, parsearMoeda } from '@/composables/formatadores';
import { useAutenticacaoStore } from '@/stores/autenticacao';

const props = defineProps<{
  oportunidadeId: string;
  codigoPedido: string;
  podeEnviar: boolean;
}>();

const emit = defineEmits<{ (e: 'atualizado'): void }>();

const auth = useAutenticacaoStore();
const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);
const podeVerCustos = computed(() =>
  auth.temPermissaoComercial(PermissaoComercial.VER_CUSTOS),
);
const podeConverterPedido = computed(() =>
  auth.temPermissaoComercial(PermissaoComercial.CONVERTER_PEDIDO),
);

const STATUS_CONVERSIVEIS = new Set(['RASCUNHO', 'ENVIADO', 'ACEITO']);
const conversaoAberta = ref(false);
const orcamentoConversaoId = ref<string | null>(null);

function abrirConversao(o: Orcamento) {
  orcamentoConversaoId.value = o.id;
  conversaoAberta.value = true;
}

function aposConversao() {
  void refetch();
  void queryClient.invalidateQueries({ queryKey: ['pedidos', props.oportunidadeId] });
  void queryClient.invalidateQueries({ queryKey: ['pipeline-ecolume'] });
  void queryClient.invalidateQueries({ queryKey: ['oportunidade', props.oportunidadeId] });
  emit('atualizado');
}

function podeConverterOrcamento(o: Orcamento) {
  return ecolume.value && podeConverterPedido.value && STATUS_CONVERSIVEIS.has(o.status);
}

const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();

const { data: orcamentos, refetch } = useQuery({
  queryKey: computed(() => ['orcamentos', props.oportunidadeId]),
  queryFn: () => servicoOrcamentos.listar(props.oportunidadeId),
});

const { data: produtos } = useQuery({
  queryKey: ['produtos', 'ativos'],
  queryFn: () => servicoProdutos.listar(true),
});

const { data: fornecedores } = useQuery({
  queryKey: ['fornecedores', 'orcamento'],
  queryFn: () => servicoFornecedores.listar(),
  enabled: ecolume,
});

const lista = computed(() => orcamentos.value ?? []);
const vigente = computed(() => lista.value.find((o) => o.vigente) ?? lista.value[0] ?? null);

const editorAberto = ref(false);
const enviando = ref(false);
const salvando = ref(false);
const duplicando = ref(false);
const marcandoEnviado = ref(false);
const confirmarExclusao = ref(false);
const excluindo = ref(false);
const orcamentoParaExcluir = ref<Orcamento | null>(null);
const editandoId = ref<string | null>(null);
const textoEnvio = ref('');
const modalEnvio = ref(false);
const orcamentoParaEnvio = ref<Orcamento | null>(null);
const modalDetalhes = ref(false);
const orcamentoDetalhes = ref<Orcamento | null>(null);
const modalCadastroRapido = ref(false);

type ModoLinha = 'CATALOGO' | 'NOVO' | 'AVULSO';

type LinhaEditor = {
  modo: ModoLinha;
  produtoId: string;
  nome: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  baseCusto: BaseCustoItemOrcamento;
  custoBase: number | null;
  ipiPercentual: number;
  stPercentual: number;
  margem: number | null;
  precoManual: boolean;
  codigoInterno: string | null;
  fornecedorId: string;
};

function linhaVazia(modo: ModoLinha = 'CATALOGO'): LinhaEditor {
  return {
    modo,
    produtoId: '',
    nome: '',
    unidade: 'un',
    quantidade: 1,
    precoUnitario: 0,
    baseCusto: modo === 'NOVO' || modo === 'AVULSO' ? 'INFORMADO' : 'ULTIMO_PRECO',
    custoBase: null,
    ipiPercentual: 0,
    stPercentual: 0,
    margem: modo === 'NOVO' ? 1.6 : null,
    precoManual: modo === 'AVULSO',
    codigoInterno: null,
    fornecedorId: '',
  };
}

const opcoesFornecedor = computed(() =>
  (fornecedores.value ?? []).map((f) => ({
    valor: f.id,
    rotulo: f.nomeCurto ? `${f.nomeCurto} — ${f.nome}` : f.nome,
  })),
);

const linhas = ref<LinhaEditor[]>([linhaVazia()]);
const descontoValor = ref(0);
const descontoTipo = ref<'VALOR' | 'PERCENTUAL'>('VALOR');
const descontoPercentual = ref(0);
const observacoes = ref('');

const opcoesProduto = computed(() =>
  (produtos.value ?? []).map((p) => {
    const rotulo = [
      p.descricaoComercial || p.nome,
      p.codigoInterno,
      p.codigoFornecedor,
      p.nomeFiscal && p.nomeFiscal !== p.nome ? p.nomeFiscal : null,
      `est. ${p.estoqueAtual} ${p.unidade}`,
    ]
      .filter(Boolean)
      .join(' · ');
    return { valor: p.id, rotulo };
  }),
);

const avisos = computed(() => {
  const mapa = new Map((produtos.value ?? []).map((p) => [p.id, p]));
  return linhas.value
    .filter((l) => l.produtoId)
    .map((l) => {
      const p = mapa.get(l.produtoId);
      if (!p || !p.controlaEstoque) return null;
      if (l.quantidade <= p.estoqueAtual) return null;
      return {
        nome: p.nome,
        solicitado: l.quantidade,
        disponivel: p.estoqueAtual,
      };
    })
    .filter(Boolean) as Array<{ nome: string; solicitado: number; disponivel: number }>;
});

const totalPreview = computed(() => {
  const sub = linhas.value.reduce((acc, l) => acc + l.quantidade * l.precoUnitario, 0);
  if (descontoTipo.value === 'PERCENTUAL') {
    return Math.max(0, sub - (sub * (descontoPercentual.value || 0)) / 100);
  }
  return Math.max(0, sub - (descontoValor.value || 0));
});

function produtoPorId(id: string): Produto | undefined {
  return (produtos.value ?? []).find((p) => p.id === id);
}

function recalcularLinha(linha: LinhaEditor) {
  if (linha.precoManual && podeVerCustos.value) return;
  const calc = calcularPrecoUnitarioLinha({
    custoBase: linha.custoBase,
    ipiPercentual: linha.ipiPercentual,
    stPercentual: linha.stPercentual,
    margem: linha.margem,
  });
  if (calc != null) {
    linha.precoUnitario = calc;
    linha.precoManual = false;
  }
}

function margemEfetivaLinha(linha: LinhaEditor): number | null {
  if (!linha.precoManual) return linha.margem;
  return calcularMargemEfetiva({
    precoUnitario: linha.precoUnitario,
    custoBase: linha.custoBase,
    ipiPercentual: linha.ipiPercentual,
    stPercentual: linha.stPercentual,
  });
}

function aoEscolherProduto(idx: number, produtoId: string) {
  const p = produtoPorId(produtoId);
  if (!p) return;
  const qtd = linhas.value[idx]?.quantidade || 1;
  const ultimo = p.ultimoPreco ?? null;
  const medio = p.custoMedio ?? null;
  const base: BaseCustoItemOrcamento =
    ultimo != null ? 'ULTIMO_PRECO' : medio != null ? 'CUSTO_MEDIO' : 'INFORMADO';
  const custoBase = base === 'ULTIMO_PRECO' ? ultimo : base === 'CUSTO_MEDIO' ? medio : null;
  const linha: LinhaEditor = {
    modo: 'CATALOGO',
    produtoId: p.id,
    nome: p.descricaoComercial || p.nome,
    unidade: p.unidade,
    quantidade: qtd,
    precoUnitario: p.precoSugerido ?? p.precoVenda,
    baseCusto: base,
    custoBase,
    ipiPercentual: p.ipi ?? 0,
    stPercentual: p.fornecedor?.aliquotaSt ?? 0,
    margem: p.margem ?? null,
    precoManual: false,
    codigoInterno: p.codigoInterno ?? null,
    fornecedorId: p.fornecedorId ?? '',
  };
  recalcularLinha(linha);
  if (linha.precoUnitario === 0 && p.precoSugerido) linha.precoUnitario = p.precoSugerido;
  linhas.value[idx] = linha;
}

function aoEscolherFornecedor(idx: number, fornecedorId: string) {
  const linha = linhas.value[idx];
  if (!linha) return;
  linha.fornecedorId = fornecedorId;
  const f = (fornecedores.value ?? []).find((x) => x.id === fornecedorId);
  if (f && linha.modo === 'NOVO') {
    linha.stPercentual = f.aliquotaSt ?? 0;
    recalcularLinha(linha);
  }
}

function aoMudarBase(idx: number, base: BaseCustoItemOrcamento) {
  const linha = linhas.value[idx];
  if (!linha) return;
  linha.baseCusto = base;
  const p = produtoPorId(linha.produtoId);
  if (base === 'ULTIMO_PRECO') linha.custoBase = p?.ultimoPreco ?? linha.custoBase;
  else if (base === 'CUSTO_MEDIO') linha.custoBase = p?.custoMedio ?? linha.custoBase;
  linha.precoManual = false;
  recalcularLinha(linha);
}

function aoEditarPreco(idx: number, valor: number) {
  const linha = linhas.value[idx];
  if (!linha || !podeVerCustos.value) return;
  linha.precoUnitario = valor;
  linha.precoManual = true;
}

function adicionarLinha() {
  linhas.value.push(linhaVazia('CATALOGO'));
}

function adicionarItemNovo() {
  linhas.value.push(linhaVazia('NOVO'));
}

function adicionarItemAvulso() {
  linhas.value.push(linhaVazia('AVULSO'));
}

function abrirNovo() {
  editandoId.value = null;
  linhas.value = [linhaVazia()];
  descontoValor.value = 0;
  descontoTipo.value = 'VALOR';
  descontoPercentual.value = 0;
  observacoes.value = '';
  editorAberto.value = true;
}

function abrirEdicao(o: Orcamento) {
  if (o.status !== 'RASCUNHO') return;
  editandoId.value = o.id;
  linhas.value = o.itens.map((i) => ({
    modo: (i.produtoId ? 'CATALOGO' : 'AVULSO') as ModoLinha,
    produtoId: i.produtoId ?? '',
    nome: i.nome,
    unidade: i.unidade,
    quantidade: i.quantidade,
    precoUnitario: i.precoUnitario,
    baseCusto: i.baseCusto ?? (i.produtoId ? 'ULTIMO_PRECO' : 'INFORMADO'),
    custoBase: i.custoBase ?? null,
    ipiPercentual: i.ipiPercentual ?? 0,
    stPercentual: i.stPercentual ?? 0,
    margem: i.margem ?? null,
    precoManual: Boolean(i.precoManual) || !i.produtoId,
    codigoInterno: i.codigoInterno ?? null,
    fornecedorId: '',
  }));
  if (linhas.value.length === 0) linhas.value = [linhaVazia()];
  descontoValor.value = o.descontoValor;
  descontoTipo.value = o.descontoTipo ?? 'VALOR';
  descontoPercentual.value = o.descontoPercentual ?? 0;
  observacoes.value = o.observacoes ?? '';
  editorAberto.value = true;
}

function formatarDataHora(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR');
}

function rotuloStatus(status: string) {
  const mapa: Record<string, string> = {
    RASCUNHO: 'Rascunho',
    ENVIADO: 'Enviado',
    ACEITO: 'Aceito',
    CANCELADO: 'Cancelado',
    CONVERTIDO: 'Convertido',
    SUBSTITUIDO: 'Substituído',
    RECUSADO: 'Recusado',
  };
  return mapa[status] ?? status;
}

function montarPayloadItens(salvarNovosNoCadastro: boolean) {
  return linhas.value
    .filter((l) => l.nome || l.produtoId)
    .map((l) => {
      const base = {
        produtoId: l.modo === 'CATALOGO' ? l.produtoId || null : null,
        nome: l.nome || produtoPorId(l.produtoId)?.nome || 'Item',
        unidade: l.unidade || 'un',
        quantidade: Number(l.quantidade) || 1,
        precoUnitario: Number(l.precoUnitario) || 0,
        desconto: 0,
      };
      if (!ecolume.value) return base;
      const novoNoCadastro = l.modo === 'NOVO' && salvarNovosNoCadastro;
      return {
        ...base,
        codigoInterno: l.codigoInterno,
        baseCusto: l.baseCusto,
        custoBase: l.custoBase,
        ipiPercentual: l.ipiPercentual,
        stPercentual: l.stPercentual,
        margem: l.margem,
        precoManual: l.modo === 'AVULSO' ? true : l.precoManual,
        ...(novoNoCadastro
          ? { salvarNoCadastro: true, fornecedorId: l.fornecedorId || null }
          : {}),
      };
    });
}

async function persistirOrcamento(salvarNovosNoCadastro: boolean) {
  const itens = montarPayloadItens(salvarNovosNoCadastro);
  if (!ecolume.value && itens.length === 0) return;
  salvando.value = true;
  try {
    const payloadDesconto = {
      descontoValor: Number(descontoValor.value) || 0,
      descontoTipo: descontoTipo.value,
      descontoPercentual:
        descontoTipo.value === 'PERCENTUAL' ? Number(descontoPercentual.value) || 0 : null,
      observacoes: observacoes.value || null,
    };
    if (editandoId.value) {
      await servicoOrcamentos.atualizar(editandoId.value, { itens, ...payloadDesconto });
    } else {
      await servicoOrcamentos.criar({
        oportunidadeId: props.oportunidadeId,
        itens,
        ...payloadDesconto,
      });
    }
    sucesso('Orçamento salvo.');
    editorAberto.value = false;
    modalCadastroRapido.value = false;
    await queryClient.invalidateQueries({ queryKey: ['produtos'] });
    await refetch();
    emit('atualizado');
  } catch (e) {
    notificarErro(e);
  } finally {
    salvando.value = false;
  }
}

async function salvar() {
  const temNovo = ecolume.value && linhas.value.some((l) => l.modo === 'NOVO' && l.nome.trim());
  if (temNovo) {
    modalCadastroRapido.value = true;
    return;
  }
  await persistirOrcamento(false);
}

async function confirmarCadastroRapido(salvarNoCadastro: boolean) {
  modalCadastroRapido.value = false;
  await persistirOrcamento(salvarNoCadastro);
}

async function garantirPdf(o: Orcamento): Promise<Orcamento> {
  // ECOLUME enviado: backend também recusa regenerar; evita round-trip desnecessário.
  if (ecolume.value && o.status !== 'RASCUNHO' && o.arquivoId) return o;
  const atualizado = await servicoOrcamentos.gerarPdf(o.id);
  await refetch();
  return atualizado;
}

async function gerarPdf(o: Orcamento) {
  try {
    const atualizado = await garantirPdf(o);
    if (atualizado.arquivoId) {
      await servicoArquivos.abrir(atualizado.arquivoId);
      sucesso('PDF aberto.');
    } else {
      sucesso('PDF pronto.');
    }
  } catch (e) {
    notificarErro(e);
  }
}

async function duplicar(o: Orcamento) {
  duplicando.value = true;
  try {
    const novo = await servicoOrcamentos.duplicar(o.id);
    sucesso(`Orçamento ${novo.numero} criado a partir de ${o.numero}.`);
    await refetch();
    emit('atualizado');
  } catch (e) {
    notificarErro(e);
  } finally {
    duplicando.value = false;
  }
}

async function marcarEnviado(o: Orcamento) {
  if (o.status !== 'RASCUNHO') return;
  marcandoEnviado.value = true;
  try {
    await servicoOrcamentos.marcarEnviado(o.id);
    sucesso('Orçamento marcado como enviado.');
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ['oportunidade', props.oportunidadeId] });
    emit('atualizado');
  } catch (e) {
    notificarErro(e);
  } finally {
    marcandoEnviado.value = false;
  }
}

function podeExcluirOrcamento(o: Orcamento) {
  return (
    ecolume.value &&
    o.status === 'RASCUNHO' &&
    auth.temPermissaoComercial(PermissaoComercial.EXCLUIR_ORCAMENTO_RASCUNHO)
  );
}

function pedirExclusao(o: Orcamento) {
  orcamentoParaExcluir.value = o;
  confirmarExclusao.value = true;
}

async function excluirOrcamento() {
  const o = orcamentoParaExcluir.value;
  if (!o) return;
  excluindo.value = true;
  try {
    await servicoOrcamentos.excluir(o.id);
    sucesso(`Orçamento ${o.numero} excluído.`);
    confirmarExclusao.value = false;
    orcamentoParaExcluir.value = null;
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ['oportunidade', props.oportunidadeId] });
    emit('atualizado');
  } catch (e) {
    notificarErro(e);
  } finally {
    excluindo.value = false;
  }
}

function prepararEnvio(o: Orcamento) {
  orcamentoParaEnvio.value = o;
  textoEnvio.value =
    `Olá! Segue o orçamento *${o.numero}* do pedido *${props.codigoPedido}* no valor de *${formatarMoeda(o.total)}*.\n\nQualquer dúvida, estou à disposição.`;
  modalEnvio.value = true;
}

function abrirDetalhes(o: Orcamento) {
  orcamentoDetalhes.value = o;
  modalDetalhes.value = true;
}

async function confirmarEnvio() {
  if (!orcamentoParaEnvio.value || !textoEnvio.value.trim()) return;
  enviando.value = true;
  try {
    await servicoOrcamentos.enviar(orcamentoParaEnvio.value.id, textoEnvio.value.trim());
    sucesso('Orçamento enviado. Este passa a ser o vigente.');
    modalEnvio.value = false;
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ['oportunidade', props.oportunidadeId] });
    emit('atualizado');
  } catch (e) {
    notificarErro(e);
  } finally {
    enviando.value = false;
  }
}

watch(
  () => props.oportunidadeId,
  () => refetch(),
);
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between gap-3">
      <CardTitle>Orçamento</CardTitle>
      <Button tamanho="sm" @click="abrirNovo">
        <Plus class="size-4" />
        {{ ecolume ? 'Novo orçamento' : 'Montar' }}
      </Button>
    </CardHeader>
    <CardContent class="space-y-4">
      <p v-if="lista.length === 0" class="text-sm text-texto-secundario">
        <template v-if="ecolume">
          Crie um orçamento em branco ou com itens. Após marcar como enviado, ele fica somente
          leitura — use Duplicar para uma nova versão.
        </template>
        <template v-else>
          Monte o orçamento com produtos do catálogo. O PDF é gerado pela ARCCO e a baixa de estoque
          só acontece ao marcar o negócio como Fechado.
        </template>
      </p>

      <div v-for="o in lista" :key="o.id" class="rounded-md border border-borda p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium text-texto">{{ o.numero }}</p>
              <Badge :variante="o.status === 'ENVIADO' || o.vigente ? 'sucesso' : 'neutro'">
                {{ rotuloStatus(o.status) }}
                <template v-if="o.vigente"> · vigente</template>
              </Badge>
            </div>
            <p class="mt-1 text-sm text-texto-secundario">
              <template v-if="ecolume">
                {{ codigoPedido }} ·
                {{
                  o.criadoEm
                    ? new Date(o.criadoEm).toLocaleDateString('pt-BR')
                    : '—'
                }}
                · {{ formatarMoeda(o.total) }}
                <template v-if="o.enviadoEm">
                  · Enviado {{ formatarDataHora(o.enviadoEm) }}
                </template>
              </template>
              <template v-else>
                Pedido {{ codigoPedido }} · v{{ o.versao }} · {{ o.itens.length }} item(ns) ·
                {{ formatarMoeda(o.total) }}
              </template>
            </p>
            <p
              v-if="o.orcamentoOrigem?.numero"
              class="mt-0.5 text-xs text-texto-secundario"
            >
              Baseado em {{ o.orcamentoOrigem.numero }}
            </p>
          </div>
          <div class="flex flex-col items-stretch gap-2 sm:items-end">
            <div class="flex flex-wrap justify-end gap-1">
              <Button
                v-if="podeConverterOrcamento(o)"
                tamanho="sm"
                @click="abrirConversao(o)"
              >
                <ShoppingCart class="size-4" /> Converter em pedido
              </Button>
              <Button
                v-if="ecolume && o.status === 'RASCUNHO'"
                tamanho="sm"
                :carregando="marcandoEnviado"
                @click="marcarEnviado(o)"
              >
                <Send class="size-4" /> Marcar como enviado
              </Button>
              <Button
                v-if="o.status === 'RASCUNHO'"
                tamanho="sm"
                @click="abrirEdicao(o)"
              >
                Editar
              </Button>
              <Button
                v-if="!ecolume && podeEnviar && (o.status === 'RASCUNHO' || o.status === 'ENVIADO')"
                tamanho="sm"
                @click="prepararEnvio(o)"
              >
                <Send class="size-4" /> Enviar
              </Button>
            </div>
            <div class="flex flex-wrap justify-end gap-1">
              <Button variante="contorno" tamanho="sm" @click="abrirDetalhes(o)">
                <List class="size-4" /> Detalhes
              </Button>
              <Button
                v-if="ecolume"
                variante="contorno"
                tamanho="sm"
                :carregando="duplicando"
                @click="duplicar(o)"
              >
                <Copy class="size-4" /> Duplicar
              </Button>
              <Button variante="contorno" tamanho="sm" @click="gerarPdf(o)">
                <FileText class="size-4" /> PDF
              </Button>
              <Button
                v-if="podeExcluirOrcamento(o)"
                variante="contorno"
                tamanho="sm"
                @click="pedirExclusao(o)"
              >
                <Trash2 class="size-4" /> Excluir
              </Button>
            </div>
          </div>
        </div>

        <ul v-if="o.avisosEstoque?.length" class="mt-2 space-y-1">
          <li
            v-for="a in o.avisosEstoque"
            :key="a.produtoId"
            class="flex items-start gap-1.5 text-xs text-alerta"
          >
            <AlertTriangle class="mt-0.5 size-3.5 shrink-0" />
            {{ a.nome }}: pediu {{ a.solicitado }}, estoque {{ a.disponivel }}
          </li>
        </ul>
      </div>

      <p v-if="vigente && !ecolume" class="text-xs text-texto-secundario">
        No Fechado, o último orçamento montado vira o final (WhatsApp opcional) e baixa o estoque.
      </p>
    </CardContent>
  </Card>

  <Dialog
    v-model="editorAberto"
    :titulo="editandoId ? 'Editar orçamento' : 'Novo orçamento'"
    tamanho="2xl"
  >
    <div class="space-y-4">
      <div
        v-if="avisos.length"
        class="rounded-md border border-alerta/30 bg-alerta/10 p-3 text-sm text-alerta"
      >
        <p class="font-medium">Atenção de estoque (pode orçar mesmo assim):</p>
        <ul class="mt-1 list-disc pl-4">
          <li v-for="(a, i) in avisos" :key="i">
            {{ a.nome }} — pediu {{ a.solicitado }}, disponível {{ a.disponivel }}
          </li>
        </ul>
      </div>

      <div
        v-for="(linha, idx) in linhas"
        :key="idx"
        class="space-y-3 rounded-md border border-borda/60 p-3"
      >
        <div v-if="ecolume && linha.modo !== 'CATALOGO'" class="flex items-center gap-2">
          <Badge variante="contorno">
            {{ linha.modo === 'NOVO' ? 'Item novo' : 'Item avulso' }}
          </Badge>
        </div>

        <div class="grid gap-3 sm:grid-cols-12">
          <div v-if="linha.modo === 'CATALOGO'" class="sm:col-span-5 space-y-1">
            <Label>{{ ecolume ? 'Produto / busca' : 'Produto' }}</Label>
            <Select
              :model-value="linha.produtoId"
              :opcoes="opcoesProduto"
              placeholder="Descrição, código interno ou fornecedor…"
              @update:model-value="(v) => aoEscolherProduto(idx, v)"
            />
          </div>
          <div
            class="space-y-1"
            :class="linha.modo === 'CATALOGO' ? 'sm:col-span-5' : 'sm:col-span-10'"
          >
            <Label>{{ ecolume ? 'Descrição comercial' : 'Nome' }}</Label>
            <Input v-model="linha.nome" :disabled="!ecolume && !!linha.produtoId" />
          </div>
          <div class="sm:col-span-2 space-y-1">
            <Label>Qtd</Label>
            <Input v-model.number="linha.quantidade" type="number" min="0.01" step="0.01" />
          </div>
        </div>

        <div
          v-if="ecolume && linha.modo === 'NOVO' && podeVerCustos"
          class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm"
        >
          <div class="space-y-1 lg:col-span-2">
            <Label>Fornecedor</Label>
            <Select
              :model-value="linha.fornecedorId"
              :opcoes="opcoesFornecedor"
              placeholder="Selecione…"
              @update:model-value="(v) => aoEscolherFornecedor(idx, v)"
            />
          </div>
          <div class="space-y-1">
            <Label>Custo ref.</Label>
            <Input
              :model-value="linha.custoBase ?? ''"
              type="number"
              step="0.0001"
              @update:model-value="
                (v) => {
                  linha.custoBase = v === '' ? null : Number(v);
                  linha.baseCusto = 'INFORMADO';
                  recalcularLinha(linha);
                }
              "
            />
          </div>
          <div class="space-y-1">
            <Label>IPI%</Label>
            <Input
              v-model.number="linha.ipiPercentual"
              type="number"
              step="0.01"
              @change="recalcularLinha(linha)"
            />
          </div>
          <div class="space-y-1">
            <Label>ST%</Label>
            <Input
              v-model.number="linha.stPercentual"
              type="number"
              step="0.01"
              @change="recalcularLinha(linha)"
            />
          </div>
          <div class="space-y-1">
            <Label>Margem</Label>
            <Input
              v-model.number="linha.margem"
              type="number"
              step="0.01"
              @change="recalcularLinha(linha)"
            />
          </div>
        </div>

        <template v-if="ecolume && podeVerCustos && linha.modo === 'CATALOGO'">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div class="space-y-1">
              <Label>Base de custo</Label>
              <Select
                :model-value="linha.baseCusto"
                :opcoes="[
                  { valor: 'ULTIMO_PRECO', rotulo: 'Último preço' },
                  { valor: 'CUSTO_MEDIO', rotulo: 'Custo médio' },
                  { valor: 'INFORMADO', rotulo: 'Informado' },
                ]"
                @update:model-value="(v) => aoMudarBase(idx, v as BaseCustoItemOrcamento)"
              />
            </div>
            <div class="space-y-1">
              <Label>Último</Label>
              <p class="flex h-10 items-center text-texto-secundario">
                {{ formatarMoeda(produtoPorId(linha.produtoId)?.ultimoPreco ?? 0) }}
              </p>
            </div>
            <div class="space-y-1">
              <Label>Médio</Label>
              <p class="flex h-10 items-center text-texto-secundario">
                {{ formatarMoeda(produtoPorId(linha.produtoId)?.custoMedio ?? 0) }}
              </p>
            </div>
            <div class="space-y-1">
              <Label>Custo base</Label>
              <Input
                :model-value="linha.custoBase ?? ''"
                type="number"
                step="0.0001"
                @update:model-value="
                  (v) => {
                    linha.custoBase = v === '' ? null : Number(v);
                    linha.baseCusto = 'INFORMADO';
                    recalcularLinha(linha);
                  }
                "
              />
            </div>
          </div>
          <div class="grid gap-3 sm:grid-cols-3 text-sm">
            <div class="space-y-1">
              <Label>IPI%</Label>
              <Input
                v-model.number="linha.ipiPercentual"
                type="number"
                step="0.01"
                @change="recalcularLinha(linha)"
              />
            </div>
            <div class="space-y-1">
              <Label>ST%</Label>
              <Input
                v-model.number="linha.stPercentual"
                type="number"
                step="0.01"
                @change="recalcularLinha(linha)"
              />
            </div>
            <div class="space-y-1">
              <Label>Margem</Label>
              <Input
                v-model.number="linha.margem"
                type="number"
                step="0.01"
                @change="recalcularLinha(linha)"
              />
            </div>
          </div>
        </template>

        <div class="grid gap-3 sm:grid-cols-12">
          <div class="sm:col-span-4 space-y-1">
            <Label>Preço unit.</Label>
            <Input
              :model-value="linha.precoUnitario"
              mascara="moeda"
              placeholder="0,00"
              :disabled="ecolume && !podeVerCustos"
              @update:model-value="
                (v) =>
                  ecolume
                    ? aoEditarPreco(idx, parsearMoeda(String(v)) ?? 0)
                    : (linha.precoUnitario = parsearMoeda(String(v)) ?? 0)
              "
            />
            <p
              v-if="ecolume && !podeVerCustos && linha.modo === 'AVULSO'"
              class="text-xs text-alerta"
            >
              Preço avulso exige VER_CUSTOS ou limite ECOL-02.
            </p>
            <p
              v-if="ecolume && podeVerCustos && linha.precoManual && linha.modo !== 'AVULSO'"
              class="text-xs text-texto-secundario"
            >
              Margem efetiva {{ margemEfetivaLinha(linha)?.toFixed(4) ?? '—' }}
            </p>
          </div>
          <div class="sm:col-span-2 flex items-end text-sm font-medium text-texto">
            {{ formatarMoeda(linha.quantidade * linha.precoUnitario) }}
          </div>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button variante="contorno" tamanho="sm" @click="adicionarLinha">
          <Plus class="size-4" /> Item
        </Button>
        <Button
          v-if="ecolume && podeVerCustos"
          variante="contorno"
          tamanho="sm"
          @click="adicionarItemNovo"
        >
          <Plus class="size-4" /> Item novo
        </Button>
        <Button v-if="ecolume" variante="contorno" tamanho="sm" @click="adicionarItemAvulso">
          <Plus class="size-4" /> Item avulso
        </Button>
      </div>

      <div class="grid gap-3 sm:grid-cols-3">
        <div v-if="ecolume" class="space-y-1.5">
          <Label>Tipo de desconto</Label>
          <Select
            :model-value="descontoTipo"
            :opcoes="[
              { valor: 'VALOR', rotulo: 'Valor (R$)' },
              { valor: 'PERCENTUAL', rotulo: 'Percentual (%)' },
            ]"
            :disabled="!podeVerCustos"
            @update:model-value="(v) => (descontoTipo = v as 'VALOR' | 'PERCENTUAL')"
          />
        </div>
        <div class="space-y-1.5">
          <Label>{{ descontoTipo === 'PERCENTUAL' ? 'Desconto (%)' : 'Desconto (R$)' }}</Label>
          <Input
            v-if="descontoTipo === 'PERCENTUAL'"
            v-model.number="descontoPercentual"
            type="number"
            min="0"
            max="100"
            step="0.01"
            :disabled="ecolume && !podeVerCustos"
          />
          <Input
            v-else
            :model-value="descontoValor"
            mascara="moeda"
            placeholder="0,00"
            :disabled="ecolume && !podeVerCustos"
            @update:model-value="(v) => (descontoValor = parsearMoeda(String(v)) ?? 0)"
          />
        </div>
        <div class="flex items-end justify-end text-lg font-semibold text-texto">
          Total {{ formatarMoeda(totalPreview) }}
        </div>
      </div>

      <div class="space-y-1.5">
        <Label>Nota interna</Label>
        <Textarea
          v-model="observacoes"
          :rows="2"
          placeholder="Só para a equipe — não entra no PDF enviado ao cliente"
        />
      </div>

      <div class="flex justify-end gap-2">
        <Button variante="secundario" @click="editorAberto = false">Cancelar</Button>
        <Button :carregando="salvando" @click="salvar">Salvar orçamento</Button>
      </div>
    </div>
  </Dialog>

  <Dialog
    v-model="modalDetalhes"
    :titulo="orcamentoDetalhes ? `Orçamento ${orcamentoDetalhes.numero}` : 'Detalhes do orçamento'"
    tamanho="lg"
  >
    <div v-if="orcamentoDetalhes" class="space-y-4">
      <p class="text-sm text-texto-secundario">
        {{ codigoPedido }} · {{ rotuloStatus(orcamentoDetalhes.status) }}
        <template v-if="!ecolume"> · v{{ orcamentoDetalhes.versao }}</template>
        <template v-if="orcamentoDetalhes.vigente"> · vigente</template>
        <template v-if="orcamentoDetalhes.enviadoEm">
          · Enviado {{ formatarDataHora(orcamentoDetalhes.enviadoEm) }}
        </template>
      </p>
      <p
        v-if="orcamentoDetalhes.orcamentoOrigem?.numero"
        class="text-sm text-texto-secundario"
      >
        Baseado em {{ orcamentoDetalhes.orcamentoOrigem.numero }}
      </p>

      <div class="overflow-x-auto rounded-md border border-borda">
        <table class="w-full min-w-[28rem] text-left text-sm">
          <thead class="bg-marfim/50 text-xs uppercase tracking-wide text-texto-secundario">
            <tr>
              <th class="px-3 py-2 font-medium">Produto</th>
              <th class="px-3 py-2 font-medium">Qtd</th>
              <th class="px-3 py-2 font-medium">Unit.</th>
              <th class="px-3 py-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in orcamentoDetalhes.itens"
              :key="item.id"
              class="border-t border-borda/60"
            >
              <td class="px-3 py-2 text-texto">{{ item.nome }}</td>
              <td class="px-3 py-2 text-texto-secundario">
                {{ item.quantidade }} {{ item.unidade }}
              </td>
              <td class="px-3 py-2 text-texto-secundario">
                {{ formatarMoeda(item.precoUnitario) }}
              </td>
              <td class="px-3 py-2 text-right font-medium text-texto">
                {{ formatarMoeda(item.totalLinha) }}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t border-borda bg-marfim/30">
              <td colspan="3" class="px-3 py-2 text-right text-texto-secundario">
                <span v-if="orcamentoDetalhes.descontoValor > 0">
                  Subtotal {{ formatarMoeda(orcamentoDetalhes.subtotal) }} · Desconto
                  {{ formatarMoeda(orcamentoDetalhes.descontoValor) }} ·
                </span>
                Total
              </td>
              <td class="px-3 py-2 text-right font-semibold text-texto">
                {{ formatarMoeda(orcamentoDetalhes.total) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div
        v-if="orcamentoDetalhes.observacoes"
        class="rounded-md border border-borda/70 bg-marfim/40 px-3 py-2 text-sm"
      >
        <p class="text-xs font-medium uppercase tracking-wide text-texto-secundario">
          Nota interna
        </p>
        <p class="mt-1 text-texto-secundario">{{ orcamentoDetalhes.observacoes }}</p>
      </div>

      <div class="flex justify-end">
        <Button variante="secundario" @click="modalDetalhes = false">Fechar</Button>
      </div>
    </div>
  </Dialog>

  <Dialog v-model="modalEnvio" titulo="Enviar orçamento no WhatsApp">
    <div class="space-y-3">
      <p class="text-sm text-texto-secundario">
        O PDF gerado pela ARCCO será anexado. Este orçamento passa a ser o vigente.
      </p>
      <div class="space-y-1.5">
        <Label obrigatorio>Mensagem</Label>
        <Textarea v-model="textoEnvio" :rows="5" />
      </div>
      <div class="flex justify-end gap-2">
        <Button variante="secundario" @click="modalEnvio = false">Cancelar</Button>
        <Button :carregando="enviando" @click="confirmarEnvio">
          <Send class="size-4" /> Enviar
        </Button>
      </div>
    </div>
  </Dialog>

  <Dialog v-model="modalCadastroRapido" titulo="Salvar este item no cadastro?">
    <div class="space-y-3">
      <p class="text-sm text-texto-secundario">
        Há itens novos neste orçamento. Deseja gravá-los no cadastro de produtos (saldo zero, sem
        movimentação de estoque)?
      </p>
      <div class="flex flex-wrap justify-end gap-2">
        <Button
          variante="secundario"
          :carregando="salvando"
          @click="confirmarCadastroRapido(false)"
        >
          Não, só no orçamento
        </Button>
        <Button :carregando="salvando" @click="confirmarCadastroRapido(true)">
          Sim, salvar no cadastro
        </Button>
      </div>
    </div>
  </Dialog>

  <ModalConfirmacao
    v-model="confirmarExclusao"
    titulo="Excluir orçamento?"
    :descricao="
      orcamentoParaExcluir
        ? `O rascunho ${orcamentoParaExcluir.numero} será removido. Esta ação não poderá ser desfeita.`
        : ''
    "
    texto-confirmar="Excluir"
    perigo
    :carregando="excluindo"
    @confirmar="excluirOrcamento"
  />

  <AssistenteConversaoPedido
    :aberto="conversaoAberta"
    :orcamento-id="orcamentoConversaoId"
    @fechar="conversaoAberta = false"
    @convertido="aposConversao"
  />
</template>
