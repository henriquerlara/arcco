<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Upload } from 'lucide-vue-next';
import { PermissaoComercial } from '@arcco/contratos';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import EstadoVazio from '@/components/compartilhados/EstadoVazio.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Switch from '@/components/ui/Switch.vue';
import SeletorProduto from '@/components/formularios/SeletorProduto.vue';
import {
  servicoArquivos,
  servicoNotasEntrada,
  type ConferenciaItem,
  type ConferenciaNota,
  type DecisaoItem,
} from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { formatarMoeda, formatarData } from '@/composables/formatadores';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import type { Produto } from '@/types';

withDefaults(defineProps<{ embutido?: boolean }>(), { embutido: false });
const emit = defineEmits<{ (e: 'importado'): void }>();

type DecisaoLocal = DecisaoItem & {
  descricaoComercial: string;
  precisaCustoRef: boolean;
};

const auth = useAutenticacaoStore();
const podeImportar = computed(() =>
  auth.temPermissaoComercial(PermissaoComercial.IMPORTAR_XML),
);
const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: ['notas-entrada'],
  queryFn: () => servicoNotasEntrada.listar(),
});
const notas = computed(() => data.value ?? []);

const arrastando = ref(false);
const processando = ref(false);
const confirmando = ref(false);
const salvandoPendente = ref(false);
/** Preenchido ao reabrir uma nota PENDENTE; a confirmação usa o XML guardado. */
const notaPendenteId = ref<string | null>(null);
const xmlAtual = ref('');
const conferencia = ref<ConferenciaNota | null>(null);
const aliquotaSt = ref(0);
const decisoes = reactive<Record<number, DecisaoLocal>>({});

function inicializarDecisoes(prev: ConferenciaNota) {
  for (const key of Object.keys(decisoes)) delete decisoes[Number(key)];
  for (const item of prev.itens) {
    decisoes[item.numeroItem] = {
      numeroItem: item.numeroItem,
      acao: item.acaoSugerida,
      produtoId: item.produtoReconhecido?.id ?? null,
      descricaoComercial: item.descricaoComercialSugerida,
      controlaEstoque: item.controlaEstoqueSugerido,
      custoReferenciaSaldo: null,
      precisaCustoRef: item.precisaCustoReferenciaSaldo,
    };
  }
}

async function lerArquivo(file: File) {
  if (!file.name.toLowerCase().endsWith('.xml') && file.type && !file.type.includes('xml')) {
    notificarErro(new Error('Envie um arquivo XML'));
    return;
  }
  processando.value = true;
  try {
    const xml = await file.text();
    xmlAtual.value = xml;
    notaPendenteId.value = null;
    const prev = await servicoNotasEntrada.previsualizar(xml);
    conferencia.value = prev;
    aliquotaSt.value = prev.fornecedor.aliquotaSt ?? 0;
    inicializarDecisoes(prev);
  } catch (e) {
    conferencia.value = null;
    notificarErro(e);
  } finally {
    processando.value = false;
  }
}

function onDrop(ev: DragEvent) {
  arrastando.value = false;
  const file = ev.dataTransfer?.files?.[0];
  if (file) void lerArquivo(file);
}

function onFileInput(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void lerArquivo(file);
  input.value = '';
}

function itemConferencia(numeroItem: number): ConferenciaItem | undefined {
  return conferencia.value?.itens.find((i) => i.numeroItem === numeroItem);
}

function aoMudarAcao(numeroItem: number, acao: DecisaoItem['acao']) {
  const d = decisoes[numeroItem];
  const item = itemConferencia(numeroItem);
  if (!d || !item) return;
  d.acao = acao;
  if (acao === 'criar') {
    d.produtoId = null;
    d.precisaCustoRef = false;
    d.custoReferenciaSaldo = null;
    d.controlaEstoque = item.controlaEstoqueSugerido;
  } else if (acao === 'reconhecido') {
    d.produtoId = item.produtoReconhecido?.id ?? null;
    d.precisaCustoRef = item.precisaCustoReferenciaSaldo;
    d.controlaEstoque = item.produtoReconhecido?.controlaEstoque ?? item.controlaEstoqueSugerido;
  } else {
    // vincular: mantém produtoId se já houver; senão limpa
    if (!d.produtoId && item.produtoReconhecido) {
      d.produtoId = item.produtoReconhecido.id;
      d.precisaCustoRef = item.precisaCustoReferenciaSaldo;
    } else if (!d.produtoId) {
      d.precisaCustoRef = false;
    }
  }
}

function aoSelecionarProduto(numeroItem: number, produto: Produto | null) {
  const d = decisoes[numeroItem];
  const item = itemConferencia(numeroItem);
  if (!d) return;
  d.produtoId = produto?.id ?? null;
  if (!produto) {
    d.precisaCustoRef = false;
    return;
  }
  d.controlaEstoque = produto.controlaEstoque;
  if (!d.descricaoComercial?.trim()) {
    d.descricaoComercial = produto.nome;
  }
  // Sem custoMedio na lista (ECOL-26a), usa a dica do preview se for o mesmo produto.
  d.precisaCustoRef =
    produto.controlaEstoque &&
    (item?.produtoReconhecido?.id === produto.id
      ? Boolean(item.precisaCustoReferenciaSaldo)
      : produto.estoqueAtual > 0);
}

function mostrarSeletor(d: DecisaoLocal, item: ConferenciaItem): boolean {
  return d.acao === 'vincular' || (d.acao === 'reconhecido' && Boolean(item.produtoReconhecido));
}

function podeConfirmar(): boolean {
  if (!conferencia.value) return false;
  for (const item of conferencia.value.itens) {
    const d = decisoes[item.numeroItem];
    if (!d) return false;
    if (d.acao === 'vincular' && !d.produtoId) return false;
    if (d.acao === 'reconhecido' && !d.produtoId && !item.produtoReconhecido) return false;
    if (d.precisaCustoRef && d.controlaEstoque && (d.custoReferenciaSaldo == null || d.custoReferenciaSaldo < 0)) {
      return false;
    }
  }
  if (conferencia.value.fornecedor.novo && (aliquotaSt.value < 0 || aliquotaSt.value > 100)) {
    return false;
  }
  return true;
}

function montarItensDecisao(): DecisaoItem[] {
  if (!conferencia.value) return [];
  return conferencia.value.itens.map((item) => {
    const d = decisoes[item.numeroItem]!;
    let acao = d.acao;
    let produtoId = d.produtoId;
    // Se o usuário trocou o produto sugerido, força vincular.
    if (
      acao === 'reconhecido' &&
      item.produtoReconhecido &&
      produtoId &&
      produtoId !== item.produtoReconhecido.id
    ) {
      acao = 'vincular';
    }
    if (acao === 'criar') produtoId = null;
    return {
      numeroItem: d.numeroItem,
      acao,
      produtoId,
      descricaoComercial: d.descricaoComercial,
      controlaEstoque: d.controlaEstoque,
      custoReferenciaSaldo: d.custoReferenciaSaldo,
    };
  });
}

async function salvarPendente() {
  if (!conferencia.value || !xmlAtual.value || notaPendenteId.value) return;
  salvandoPendente.value = true;
  try {
    await servicoNotasEntrada.salvarPendente({
      xml: xmlAtual.value,
      aliquotaStFornecedor: conferencia.value.fornecedor.novo ? Number(aliquotaSt.value) : undefined,
      itens: montarItensDecisao(),
    });
    sucesso('Nota salva como pendente. Estoque não foi alterado.');
    conferencia.value = null;
    xmlAtual.value = '';
    await queryClient.invalidateQueries({ queryKey: ['notas-entrada'] });
  } catch (e) {
    notificarErro(e);
  } finally {
    salvandoPendente.value = false;
  }
}

async function reabrirPendente(id: string) {
  processando.value = true;
  try {
    const conf = await servicoNotasEntrada.obterConferencia(id);
    inicializarDecisoes(conf);
    for (const salva of conf.decisoes) {
      const d = decisoes[salva.numeroItem];
      const item = conf.itens.find((i) => i.numeroItem === salva.numeroItem);
      if (!d || !item) continue;
      if (salva.produtoId) {
        d.produtoId = salva.produtoId;
        d.acao = item.produtoReconhecido?.id === salva.produtoId ? 'reconhecido' : 'vincular';
        if (d.acao === 'vincular') d.precisaCustoRef = false;
      }
      if (salva.descricaoComercial) d.descricaoComercial = salva.descricaoComercial;
      d.controlaEstoque = salva.controlaEstoque;
    }
    conferencia.value = conf;
    notaPendenteId.value = conf.notaId;
    xmlAtual.value = '';
    aliquotaSt.value = conf.fornecedor.aliquotaSt ?? 0;
  } catch (e) {
    notificarErro(e);
  } finally {
    processando.value = false;
  }
}

async function confirmar() {
  if (!conferencia.value || (!xmlAtual.value && !notaPendenteId.value) || !podeConfirmar()) return;
  confirmando.value = true;
  try {
    const itens = montarItensDecisao();
    if (notaPendenteId.value) {
      await servicoNotasEntrada.confirmar({ notaEntradaId: notaPendenteId.value, itens });
    } else {
      await servicoNotasEntrada.confirmar({
        xml: xmlAtual.value,
        aliquotaStFornecedor: conferencia.value.fornecedor.novo
          ? Number(aliquotaSt.value)
          : undefined,
        itens,
      });
    }
    sucesso('Nota de entrada importada.');
    conferencia.value = null;
    xmlAtual.value = '';
    notaPendenteId.value = null;
    await queryClient.invalidateQueries({ queryKey: ['notas-entrada'] });
    await queryClient.invalidateQueries({ queryKey: ['estoque'] });
    await queryClient.invalidateQueries({ queryKey: ['produtos'] });
    emit('importado');
  } catch (e) {
    notificarErro(e);
  } finally {
    confirmando.value = false;
  }
}

function cancelarConferencia() {
  conferencia.value = null;
  xmlAtual.value = '';
  notaPendenteId.value = null;
}

function rotuloStatusEntrada(status: string) {
  if (status === 'CONFERIDA') return 'Conferida';
  if (status === 'PENDENTE') return 'Pendente de conferência';
  return status;
}

async function baixarXml(id: string, nome: string) {
  try {
    await servicoArquivos.baixar(id, nome);
  } catch (e) {
    notificarErro(e);
  }
}
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina
      v-if="!embutido"
      titulo="Notas de entrada"
      descricao="Importe XML de NF-e de compra. Nada é gravado até a confirmação."
    />

    <div
      v-if="podeImportar"
      class="rounded-lg border border-dashed border-borda p-8 text-center transition-colors"
      :class="arrastando ? 'border-destaque bg-destaque/5' : 'bg-superficie'"
      @dragover.prevent="arrastando = true"
      @dragleave.prevent="arrastando = false"
      @drop.prevent="onDrop"
    >
      <Upload class="mx-auto mb-3 size-8 text-texto-secundario" />
      <p class="text-sm text-texto">
        {{ embutido ? 'Importar XML' : 'Arraste o XML aqui ou escolha um arquivo' }}
      </p>
      <p class="mt-1 text-xs text-texto-secundario">
        Nada é gravado até a confirmação. Chave duplicada é recusada.
      </p>
      <label class="mt-3 inline-block">
        <input
          type="file"
          accept=".xml,application/xml,text/xml"
          multiple
          class="hidden"
          @change="onFileInput"
        />
        <Button as="span" variante="secundario" :carregando="processando">Selecionar XML</Button>
      </label>
    </div>
    <p v-else class="text-sm text-texto-secundario">
      Sem permissão para importar XML. Notas já conferidas permanecem visíveis.
    </p>

    <Card v-if="conferencia" class="space-y-4 p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="font-medium text-texto">Conferência · {{ conferencia.chaveAcesso }}</p>
          <p class="text-sm text-texto-secundario">
            {{ conferencia.emitente.nome }} · NF {{ conferencia.numero }}/{{ conferencia.serie }} ·
            {{ formatarMoeda(conferencia.valorTotal) }}
          </p>
        </div>
        <div class="flex gap-2">
          <Button variante="secundario" @click="cancelarConferencia">Cancelar</Button>
          <Button
            v-if="!notaPendenteId"
            variante="contorno"
            :carregando="salvandoPendente"
            :disabled="confirmando"
            @click="salvarPendente"
          >
            Salvar pendente
          </Button>
          <Button :carregando="confirmando" :disabled="!podeConfirmar()" @click="confirmar">
            Confirmar importação
          </Button>
        </div>
      </div>

      <div v-if="conferencia.fornecedor.novo" class="max-w-xs space-y-1.5">
        <Label obrigatorio>ST % do fornecedor (novo)</Label>
        <Input v-model.number="aliquotaSt" type="number" min="0" max="100" step="0.0001" />
      </div>
      <p v-else class="text-sm text-texto-secundario">
        Fornecedor já cadastrado: {{ conferencia.fornecedor.nome }}
      </p>

      <div
        v-for="item in conferencia.itens"
        :key="item.numeroItem"
        class="grid gap-3 rounded-md border border-borda p-3 sm:grid-cols-2"
      >
        <div class="sm:col-span-2">
          <p class="font-medium">Item {{ item.numeroItem }} · {{ item.codigoFornecedor }}</p>
          <p class="text-sm text-texto-secundario">
            {{ item.quantidade }} {{ item.unidade }} × {{ formatarMoeda(item.valorUnitario) }}
            <span v-if="item.ipi != null"> · IPI {{ item.ipi }}%</span>
          </p>
          <p v-if="item.produtoReconhecido" class="text-xs text-texto-secundario">
            Sugestão automática: {{ item.produtoReconhecido.nome }}
          </p>
        </div>

        <template v-if="decisoes[item.numeroItem]">
          <div class="space-y-1.5 sm:col-span-2">
            <Label>Destino do item</Label>
            <div class="flex flex-wrap gap-3 text-sm">
              <label v-if="item.produtoReconhecido" class="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  :name="`acao-${item.numeroItem}`"
                  value="reconhecido"
                  :checked="decisoes[item.numeroItem]!.acao === 'reconhecido'"
                  @change="aoMudarAcao(item.numeroItem, 'reconhecido')"
                />
                Usar sugerido
              </label>
              <label class="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  :name="`acao-${item.numeroItem}`"
                  value="vincular"
                  :checked="decisoes[item.numeroItem]!.acao === 'vincular'"
                  @change="aoMudarAcao(item.numeroItem, 'vincular')"
                />
                Vincular existente
              </label>
              <label class="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  :name="`acao-${item.numeroItem}`"
                  value="criar"
                  :checked="decisoes[item.numeroItem]!.acao === 'criar'"
                  @change="aoMudarAcao(item.numeroItem, 'criar')"
                />
                Criar produto
              </label>
            </div>
          </div>

          <div
            v-if="mostrarSeletor(decisoes[item.numeroItem]!, item)"
            class="space-y-1.5 sm:col-span-2"
          >
            <Label :obrigatorio="decisoes[item.numeroItem]!.acao === 'vincular'">Produto</Label>
            <SeletorProduto
              :model-value="decisoes[item.numeroItem]!.produtoId"
              :sugerido-id="item.produtoReconhecido?.id"
              @update:model-value="
                (id) => {
                  decisoes[item.numeroItem]!.produtoId = id;
                  if (decisoes[item.numeroItem]!.acao === 'reconhecido' && id !== item.produtoReconhecido?.id) {
                    decisoes[item.numeroItem]!.acao = 'vincular';
                  }
                }
              "
              @selecionado="(p) => aoSelecionarProduto(item.numeroItem, p)"
            />
          </div>

          <div class="space-y-1.5 sm:col-span-2">
            <Label>Descrição comercial</Label>
            <Input v-model="decisoes[item.numeroItem]!.descricaoComercial" />
          </div>
          <div class="flex items-center gap-2">
            <Switch v-model="decisoes[item.numeroItem]!.controlaEstoque" />
            <span class="text-sm">Controla estoque</span>
          </div>
          <div
            v-if="decisoes[item.numeroItem]!.precisaCustoRef && decisoes[item.numeroItem]!.controlaEstoque"
            class="space-y-1.5"
          >
            <Label obrigatorio>Custo referência do saldo</Label>
            <Input
              v-model.number="decisoes[item.numeroItem]!.custoReferenciaSaldo"
              type="number"
              min="0"
              step="0.0001"
            />
          </div>
        </template>
      </div>
    </Card>

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />
    <div v-else-if="isLoading" class="space-y-2">
      <Skeleton v-for="n in 3" :key="n" class="h-16" />
    </div>
    <EstadoVazio
      v-else-if="notas.length === 0 && !conferencia"
      titulo="Nenhuma nota de entrada"
      descricao="Importe o XML da NF-e de compra para registrar estoque e custos."
    />
    <div v-else class="space-y-2">
      <Card v-for="n in notas" :key="n.id" class="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p class="font-medium text-texto">
            {{ n.fornecedor.nomeCurto || n.fornecedor.nome }} · NF {{ n.numero }}/{{ n.serie }}
          </p>
          <p class="text-sm text-texto-secundario">
            {{ formatarData(n.emitidoEm || n.criadoEm) }} · {{ n.qtdItens }} itens ·
            {{ formatarMoeda(n.valorTotal) }}
          </p>
          <p class="text-xs text-texto-secundario">{{ n.chaveAcesso }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Badge :variante="n.status === 'PENDENTE' ? 'alerta' : 'sucesso'">
            {{ rotuloStatusEntrada(n.status) }}
          </Badge>
          <Button
            v-if="n.status === 'PENDENTE' && podeImportar"
            variante="contorno"
            tamanho="sm"
            :carregando="processando"
            @click="reabrirPendente(n.id)"
          >
            Conferir
          </Button>
          <Button
            v-if="n.arquivoXmlId"
            variante="fantasma"
            tamanho="sm"
            @click="baixarXml(n.arquivoXmlId!, `nfe-entrada-${n.numero || n.id}.xml`)"
          >
            XML
          </Button>
        </div>
      </Card>
    </div>
  </div>
</template>
