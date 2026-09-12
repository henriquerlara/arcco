<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  ArrowLeft,
  Trash2,
  User,
  Building2,
  Calendar,
  Flag,
  MessageSquare,
  MessagesSquare,
  Send,
  GitBranch,
  Check,
  CircleCheck,
  CircleX,
  Paperclip,
  X,
} from 'lucide-vue-next';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import ModalConfirmacao from '@/components/compartilhados/ModalConfirmacao.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import BadgeStatus from '@/components/compartilhados/BadgeStatus.vue';
import Badge from '@/components/ui/Badge.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Button from '@/components/ui/Button.vue';
import Dialog from '@/components/ui/Dialog.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Input from '@/components/ui/Input.vue';
import {
  servicoOportunidades,
  servicoFunil,
  servicoCamposPersonalizados,
  servicoConversas,
  servicoArquivos,
} from '@/services';
import PainelOrcamento from './PainelOrcamento.vue';
import { formatarMoeda, formatarData, formatarDataHora, parsearMoeda } from '@/composables/formatadores';
import { lerAjustes } from '@/composables/ajustes';
import { useNotificacao } from '@/composables/useNotificacao';
import type {
  EtapaFunil,
  HistoricoEtapaOportunidade,
  Oportunidade,
  OrigemHistoricoEtapa,
} from '@/types';

const ROTULO_ORIGEM: Record<OrigemHistoricoEtapa, string> = {
  CRIACAO: 'Criação',
  MANUAL: 'Manual',
  CHATBOT: 'Chatbot',
  ORCAMENTO_WHATSAPP: 'Orçamento WhatsApp',
};

function rotuloOrigem(origem: string): string {
  return ROTULO_ORIGEM[origem as OrigemHistoricoEtapa] ?? origem;
}

type EstadoPasso = 'feita' | 'atual' | 'futura';

interface PassoProcesso {
  etapa: EtapaFunil;
  estado: EstadoPasso;
  chegada?: HistoricoEtapaOportunidade;
}

const rota = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();

const id = computed(() => rota.params.id as string);
const confirmarExclusao = ref(false);
const excluindo = ref(false);
const modalOrcamentoAberto = ref(false);
const textoOrcamento = ref('');
const valorOrcamento = ref('');
const arquivoOrcamento = ref<File | null>(null);
const inputArquivoOrcamento = ref<HTMLInputElement | null>(null);
const enviandoOrcamento = ref(false);
const movendoEtapaId = ref<string | null>(null);
const modalPerdaAberto = ref(false);
const motivoPerda = ref('');
const etapaPerdaPendenteId = ref<string | null>(null);
const valorNegocio = ref('');
const salvandoValor = ref(false);
const abrindoConversa = ref(false);

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['oportunidade', id.value]),
  queryFn: () => servicoOportunidades.obter(id.value),
});
const op = computed(() => data.value);

/** Orçamento vigente ou, se não houver, o mais recente — fonte dos itens/valor na tela. */
const orcamentoResumo = computed(() => {
  const lista = op.value?.orcamentos ?? [];
  if (!lista.length) return null;
  return lista.find((o) => o.vigente) ?? lista[0] ?? null;
});

const arquivosQuery = useQuery({
  queryKey: computed(() => ['arquivos', 'oportunidade', id.value]),
  queryFn: () => servicoArquivos.listar(undefined, id.value),
  enabled: computed(() => Boolean(id.value)),
});

const abrindoArquivoId = ref<string | null>(null);

async function abrirArquivoPedido(arquivoId: string) {
  if (abrindoArquivoId.value) return;
  abrindoArquivoId.value = arquivoId;
  try {
    await servicoArquivos.abrir(arquivoId);
  } catch (erro) {
    notificarErro(erro);
  } finally {
    abrindoArquivoId.value = null;
  }
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const emEtapaOrcamento = computed(
  () => op.value?.etapa?.chaveSistema === 'QUALIFICACAO',
);
const emNegociacao = computed(
  () => op.value?.etapa?.chaveSistema === 'NEGOCIACAO',
);

const funilQuery = useQuery({
  queryKey: ['etapas-funil'],
  queryFn: () => servicoFunil.listar(),
  staleTime: 60_000,
});

const etapaGanha = computed(
  () => (funilQuery.data.value ?? []).find((e) => e.ativo && e.tipo === 'GANHA'),
);
const etapaPerdida = computed(
  () => (funilQuery.data.value ?? []).find((e) => e.ativo && e.tipo === 'PERDIDA'),
);

const camposQuery = useQuery({
  queryKey: ['campos-oportunidade'],
  queryFn: () => servicoCamposPersonalizados.listar('OPORTUNIDADE'),
  staleTime: 60_000,
});

const ROTULOS_INFO_BOT: Record<string, string> = {
  tipo_solicitacao: 'Tipo de solicitação',
  codigo_orcamento: 'Código do orçamento',
  ajuste_solicitado: 'O que deve mudar',
  ajuste_status: 'Status do ajuste',
  cpf: 'CPF',
  cadastro: 'Cadastro',
  endereco_obra: 'Endereço da obra',
  possui_projeto: 'Possui projeto/lista?',
  arquivo_lista: 'Arquivo/lista',
};

const rotuloCampo = computed(() => {
  const mapa = new Map((camposQuery.data.value ?? []).map((c) => [c.chave, c.rotulo]));
  return (chave: string) => mapa.get(chave) ?? ROTULOS_INFO_BOT[chave] ?? chave;
});

const ORDEM_INFO_BOT = [
  'tipo_solicitacao',
  'codigo_orcamento',
  'ajuste_solicitado',
  'ajuste_status',
  'cpf',
  'cadastro',
  'endereco_obra',
  'possui_projeto',
  'arquivo_lista',
];

const infosPedido = computed(() => {
  const dados = op.value?.dadosPersonalizados ?? {};
  const entradas = Object.entries(dados).filter(
    ([chave, v]) =>
      chave !== 'arquivo_id' &&
      chave !== 'arquivo_lista' &&
      chave !== 'orcamento_arquivo_id' &&
      chave !== 'ajustes' &&
      chave !== 'ajuste_status' &&
      chave !== 'ajuste_solicitado' &&
      v !== undefined &&
      v !== null &&
      v !== '',
  );
  return entradas.sort(([a], [b]) => {
    const ia = ORDEM_INFO_BOT.indexOf(a);
    const ib = ORDEM_INFO_BOT.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
});

const ehPedidoAjuste = computed(() =>
  String(op.value?.dadosPersonalizados?.tipo_solicitacao ?? '')
    .toLowerCase()
    .includes('ajuste'),
);

const ajustesPedido = computed(() =>
  lerAjustes(op.value?.dadosPersonalizados, op.value?.descricao),
);

const arquivosPedido = computed(() => {
  const dados = op.value?.dadosPersonalizados ?? {};
  const idLista = dados.arquivo_id != null ? String(dados.arquivo_id) : '';
  const idOrcamento = dados.orcamento_arquivo_id != null ? String(dados.orcamento_arquivo_id) : '';
  const nomeLista = String(dados.arquivo_lista ?? '').trim();

  type Item = { id: string; nome: string; tamanho: number; tipo: 'lista' | 'orcamento' };
  const mapa = new Map<string, Item>();

  const classificar = (arquivo: {
    id: string;
    nome: string;
    tamanho: number;
    entidade?: string | null;
    enviadoPorId?: string | null;
  }): 'lista' | 'orcamento' => {
    if (arquivo.entidade === 'ORCAMENTO' || arquivo.id === idOrcamento) return 'orcamento';
    if (arquivo.entidade === 'LISTA_MATERIAIS' || arquivo.id === idLista) return 'lista';
    if (arquivo.enviadoPorId) return 'orcamento';
    return 'lista';
  };

  for (const arquivo of arquivosQuery.data.value ?? []) {
    mapa.set(arquivo.id, {
      id: arquivo.id,
      nome: arquivo.nome,
      tamanho: arquivo.tamanho,
      tipo: classificar(arquivo),
    });
  }
  if (idLista && !mapa.has(idLista)) {
    mapa.set(idLista, { id: idLista, nome: nomeLista || 'Arquivo', tamanho: 0, tipo: 'lista' });
  }
  if (idOrcamento && !mapa.has(idOrcamento)) {
    mapa.set(idOrcamento, { id: idOrcamento, nome: 'Orçamento', tamanho: 0, tipo: 'orcamento' });
  }

  const vistos = new Set<string>();
  const unicos: Item[] = [];
  for (const item of mapa.values()) {
    const chave = `${item.tipo}|${item.nome}|${item.tamanho}`;
    if (vistos.has(item.id) || vistos.has(chave)) continue;
    vistos.add(item.id);
    vistos.add(chave);
    unicos.push(item);
  }
  return unicos;
});

const textoListaMateriais = computed(() => {
  const dados = op.value?.dadosPersonalizados ?? {};
  const texto = String(dados.arquivo_lista ?? dados.lista_materiais ?? '').trim();
  if (!texto) return '';
  const idLista = dados.arquivo_id != null ? String(dados.arquivo_id).trim() : '';
  if (idLista) return '';
  const nomesArquivo = arquivosPedido.value
    .filter((item) => item.tipo === 'lista')
    .map((item) => item.nome);
  if (nomesArquivo.includes(texto)) return '';
  return texto;
});

const gruposArquivosPedido = computed(() =>
  [
    {
      tipo: 'lista',
      titulo: 'Lista de materiais',
      itens: arquivosPedido.value.filter((item) => item.tipo === 'lista'),
      texto: textoListaMateriais.value,
    },
  ].filter((grupo) => grupo.itens.length > 0 || Boolean(grupo.texto)),
);

const temPedidoCliente = computed(
  () =>
    Boolean(op.value?.descricao?.trim()) ||
    infosPedido.value.length > 0 ||
    ajustesPedido.value.length > 0 ||
    arquivosPedido.value.some((item) => item.tipo === 'lista') ||
    Boolean(textoListaMateriais.value),
);

const todosAjustesCorrigidos = computed(
  () =>
    ehPedidoAjuste.value &&
    ajustesPedido.value.length > 0 &&
    ajustesPedido.value.every((item) => item.status === 'corrigido'),
);

const marcandoAjusteId = ref<string | null>(null);

function formatarValorCampo(_chave: string, valor: unknown): string {
  return String(valor ?? '');
}

async function marcarAjusteCorrigido(ajusteId: string) {
  if (!op.value || marcandoAjusteId.value) return;
  marcandoAjusteId.value = ajusteId;
  try {
    await servicoOportunidades.marcarAjusteCorrigido(op.value.id, ajusteId);
    sucesso('Ajuste marcado como corrigido.');
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    await queryClient.invalidateQueries({ queryKey: ['atividades'] });
  } catch (e) {
    notificarErro(e);
  } finally {
    marcandoAjusteId.value = null;
  }
}

/** Chegada mais recente em cada etapa (para data no stepper). */
const chegadaPorEtapa = computed(() => {
  const mapa = new Map<string, HistoricoEtapaOportunidade>();
  for (const item of op.value?.historicoEtapas ?? []) {
    mapa.set(item.etapaId, item);
  }
  return mapa;
});

/**
 * Linha do tempo do funil: etapas abertas em ordem + etapa atual se for ganha/perdida.
 * Feitas = ordem menor que a atual; atual destacada; futuras apagadas.
 */
const passosProcesso = computed<PassoProcesso[]>(() => {
  const etapas = (funilQuery.data.value ?? []).filter((e) => e.ativo);
  const atual = op.value?.etapa;
  if (!atual) return [];

  const abertas = etapas
    .filter((e) => e.tipo === 'ABERTA')
    .sort((a, b) => a.ordem - b.ordem);
  const finais = etapas
    .filter((e) => e.tipo === 'GANHA' || e.tipo === 'PERDIDA')
    .sort((a, b) => a.ordem - b.ordem);

  const lista: EtapaFunil[] = [...abertas, ...finais];

  return lista.map((etapa) => {
    let estado: EstadoPasso = 'futura';
    if (etapa.id === atual.id) estado = 'atual';
    else if (atual.tipo === 'ABERTA' && etapa.tipo === 'ABERTA' && etapa.ordem < atual.ordem) {
      estado = 'feita';
    } else if (
      (atual.tipo === 'GANHA' || atual.tipo === 'PERDIDA') &&
      etapa.tipo === 'ABERTA'
    ) {
      estado = 'feita';
    }
    return {
      etapa,
      estado,
      chegada: chegadaPorEtapa.value.get(etapa.id),
    };
  });
});

async function irParaEtapa(etapaId: string, motivoInformado?: string) {
  if (!op.value || etapaId === op.value.etapaId || movendoEtapaId.value) return;
  const destino = (funilQuery.data.value ?? []).find((e) => e.id === etapaId);
  let motivo: string | undefined;
  if (destino?.tipo === 'PERDIDA') {
    const texto = motivoInformado?.trim() ?? '';
    if (!texto) {
      etapaPerdaPendenteId.value = etapaId;
      motivoPerda.value = '';
      modalPerdaAberto.value = true;
      return;
    }
    motivo = texto;
  }

  movendoEtapaId.value = etapaId;
  try {
    await servicoOportunidades.mover(id.value, etapaId, motivo);
    sucesso(`Etapa atualizada para ${destino?.nome ?? 'selecionada'}.`);
    modalPerdaAberto.value = false;
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ['pipeline'] });
  } catch (e) {
    notificarErro(e);
  } finally {
    movendoEtapaId.value = null;
  }
}

async function confirmarPerda() {
  const etapaId = etapaPerdaPendenteId.value ?? etapaPerdida.value?.id;
  if (!etapaId) return;
  if (!motivoPerda.value.trim()) {
    notificarErro(new Error('Informe o motivo da perda.'));
    return;
  }
  await irParaEtapa(etapaId, motivoPerda.value);
}

function pedirDesfechoPerdido() {
  if (!etapaPerdida.value) {
    notificarErro(new Error('Não há etapa de perdido no funil.'));
    return;
  }
  etapaPerdaPendenteId.value = etapaPerdida.value.id;
  motivoPerda.value = '';
  modalPerdaAberto.value = true;
}

function montarTextoOrcamento(oportunidade: Oportunidade, valor?: number | null): string {
  const nome = oportunidade.contato?.nome?.split(' ')[0] || 'olá';
  const linhas: string[] = [
    `Olá, ${nome}! Segue o orçamento referente ao pedido *${oportunidade.codigo}*`,
    '',
  ];

  const valorFinal = valor ?? oportunidade.valorEstimado;
  if (valorFinal != null) {
    linhas.push(`Valor: *${formatarMoeda(valorFinal)}*`);
  }
  if (oportunidade.codigoOrcamento) {
    linhas.push(`Código: ${oportunidade.codigoOrcamento}`);
  }

  const pedido: string[] = [];
  if (oportunidade.descricao?.trim()) {
    pedido.push(oportunidade.descricao.trim());
  }
  for (const [chave, valorCampo] of Object.entries(oportunidade.dadosPersonalizados ?? {})) {
    if (chave === 'arquivo_id') continue;
    if (valorCampo === undefined || valorCampo === null || valorCampo === '') continue;
    pedido.push(`${rotuloCampo.value(chave)}: ${valorCampo}`);
  }
  if (pedido.length) {
    linhas.push('', 'Resumo do pedido:', ...pedido);
  }

  linhas.push('', 'Qualquer dúvida, estou à disposição.');
  return linhas.join('\n');
}

watch(
  [op, () => rota.query.enviarOrcamento],
  ([oportunidade, flag]) => {
    if (!oportunidade || flag !== '1' || modalOrcamentoAberto.value) return;
    if (oportunidade.etapa?.chaveSistema !== 'QUALIFICACAO') {
      const query = { ...rota.query };
      delete query.enviarOrcamento;
      void router.replace({ query });
      return;
    }
    abrirEnviarOrcamento();
    const query = { ...rota.query };
    delete query.enviarOrcamento;
    void router.replace({ query });
  },
);

function formatarValorDigitado(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

watch(
  () => op.value?.valorEstimado,
  (valor) => {
    if (salvandoValor.value) return;
    valorNegocio.value = valor != null ? formatarValorDigitado(valor) : '';
  },
  { immediate: true },
);

const valorNegocioAlterado = computed(() => {
  const novo = parsearMoeda(valorNegocio.value);
  const atual = op.value?.valorEstimado ?? null;
  return novo != null && novo !== atual;
});

async function abrirConversa() {
  if (abrindoConversa.value) return;
  abrindoConversa.value = true;
  try {
    const conversa = await servicoConversas.porOportunidade(id.value);
    await router.push({ name: 'conversas', query: { conversa: conversa.id } });
  } catch (e) {
    notificarErro(e, 'Nenhuma conversa WhatsApp ligada a este negócio.');
  } finally {
    abrindoConversa.value = false;
  }
}

async function salvarValorNegocio() {
  const valor = parsearMoeda(valorNegocio.value);
  if (!valor) {
    notificarErro(new Error('Informe um valor válido.'));
    return;
  }
  if (valor === op.value?.valorEstimado) return;
  salvandoValor.value = true;
  try {
    await servicoOportunidades.atualizar(id.value, { valorEstimado: valor });
    sucesso('Valor do negócio atualizado.');
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ['pipeline'] });
  } catch (e) {
    notificarErro(e);
  } finally {
    salvandoValor.value = false;
  }
}

function irParaOrcamento() {
  document.getElementById('painel-orcamento')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function abrirEnviarOrcamento() {
  if (!op.value) return;
  valorOrcamento.value =
    op.value.valorEstimado != null ? formatarValorDigitado(op.value.valorEstimado) : '';
  arquivoOrcamento.value = null;
  textoOrcamento.value = montarTextoOrcamento(op.value);
  modalOrcamentoAberto.value = true;
}

watch(valorOrcamento, (bruto) => {
  if (!modalOrcamentoAberto.value) return;
  const n = parsearMoeda(bruto);
  if (n == null) return;
  const linha = `Valor: *${formatarMoeda(n)}*`;
  const atual = textoOrcamento.value;
  if (/Valor: \*[^*]+\*/.test(atual)) {
    textoOrcamento.value = atual.replace(/Valor: \*[^*]+\*/, linha);
    return;
  }
  const partes = atual.split('\n');
  const idx = partes.findIndex((p) => p.trim() === '');
  if (idx >= 0) {
    partes.splice(idx + 1, 0, linha);
    textoOrcamento.value = partes.join('\n');
  } else {
    textoOrcamento.value = `${atual}\n\n${linha}`;
  }
});

function aoEscolherArquivo(evento: Event) {
  const input = evento.target as HTMLInputElement;
  arquivoOrcamento.value = input.files?.[0] ?? null;
}

function limparArquivoOrcamento() {
  arquivoOrcamento.value = null;
  if (inputArquivoOrcamento.value) inputArquivoOrcamento.value.value = '';
}

async function enviarOrcamento() {
  const texto = textoOrcamento.value.trim();
  const valor = parsearMoeda(valorOrcamento.value);
  if (!valor) {
    notificarErro(new Error('Informe o valor do orçamento.'));
    return;
  }
  if (!texto) {
    notificarErro(new Error('Informe o texto do orçamento.'));
    return;
  }

  enviandoOrcamento.value = true;
  try {
    let arquivoId: string | undefined;
    if (arquivoOrcamento.value) {
      const salvo = await servicoArquivos.enviar(
        arquivoOrcamento.value,
        'ORCAMENTO',
        id.value,
      );
      arquivoId = salvo.id;
    }
    await servicoConversas.enviarOrcamento(id.value, { texto, valorEstimado: valor, arquivoId });
    sucesso('Orçamento enviado. Oportunidade avançou para Negociação.');
    modalOrcamentoAberto.value = false;
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    await queryClient.invalidateQueries({ queryKey: ['arquivos', 'oportunidade', id.value] });
  } catch (e) {
    notificarErro(e);
  } finally {
    enviandoOrcamento.value = false;
  }
}

async function excluir() {
  excluindo.value = true;
  try {
    await servicoOportunidades.excluir(id.value);
    sucesso('Oportunidade excluída.');
    await queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    await router.back();
  } catch (e) {
    notificarErro(e);
  } finally {
    excluindo.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <button
      class="inline-flex items-center gap-1.5 text-sm text-texto-secundario hover:text-texto"
      @click="router.back()"
    >
      <ArrowLeft class="size-4" /> Voltar
    </button>

    <EstadoErro v-if="isError" :erro="error" @tentar-novamente="refetch()" />
    <div v-else-if="isLoading" class="space-y-4">
      <Skeleton class="h-24 w-full" />
      <Skeleton class="h-64 w-full" />
    </div>

    <template v-else-if="op">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-texto">{{ op.codigo }}</h1>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <BadgeStatus familia="prioridade" :valor="op.prioridade" />
            <span
              v-if="op.etapa"
              class="rounded-sm bg-marfim px-2 py-0.5 text-xs font-medium text-texto"
            >
              {{ op.etapa.nome }}
            </span>
            <span v-if="op.categoria" class="text-sm text-texto-secundario">{{ op.categoria.nome }}</span>
            <span v-if="op.origem" class="text-sm text-texto-secundario">· Origem: {{ op.origem }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Button
            variante="contorno"
            title="Abrir conversa"
            aria-label="Abrir conversa"
            :disabled="abrindoConversa"
            :carregando="abrindoConversa"
            @click="abrirConversa"
          >
            <MessagesSquare class="size-4" />
            Abrir conversa
          </Button>
          <Button
            v-if="emEtapaOrcamento"
            variante="primario"
            title="Montar e enviar orçamento"
            aria-label="Montar e enviar orçamento"
            @click="irParaOrcamento"
          >
            <Send class="size-4" />
            Orçamento
          </Button>
          <Button variante="contorno" tamanho="icone" @click="confirmarExclusao = true">
            <Trash2 class="size-4 text-erro" />
          </Button>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <div class="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <MessageSquare class="size-4 text-dourado-hover" />
                Pedido do cliente
              </CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
              <template v-if="temPedidoCliente">
                <div v-if="ehPedidoAjuste && ajustesPedido.length" class="space-y-2">
                  <p class="text-xs font-semibold uppercase tracking-wide text-texto-secundario">
                    O que deve mudar
                  </p>
                  <ul class="space-y-2">
                    <li
                      v-for="(item, indice) in ajustesPedido"
                      :key="item.id || indice"
                      class="rounded-lg border border-borda bg-marfim/40 p-3"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <p class="text-[11px] font-medium text-texto-secundario">
                            Pedido {{ indice + 1 }}
                          </p>
                          <p class="mt-1 whitespace-pre-wrap text-sm text-texto">{{ item.texto }}</p>
                        </div>
                        <Badge :variante="item.status === 'corrigido' ? 'sucesso' : 'alerta'">
                          {{ item.status === 'corrigido' ? 'Corrigido' : 'Pendente' }}
                        </Badge>
                      </div>
                      <Button
                        v-if="item.status !== 'corrigido'"
                        class="mt-3"
                        variante="primario"
                        tamanho="sm"
                        :carregando="marcandoAjusteId === item.id"
                        @click="marcarAjusteCorrigido(item.id)"
                      >
                        <Check class="size-4" /> Marcar como corrigido
                      </Button>
                    </li>
                  </ul>
                  <p v-if="todosAjustesCorrigidos" class="text-xs text-sucesso">
                    Todos os ajustes foram marcados como corrigidos.
                  </p>
                </div>
                <div v-else-if="op.descricao?.trim()">
                  <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-texto-secundario">
                    Informações
                  </p>
                  <p class="whitespace-pre-wrap text-sm text-texto">{{ op.descricao }}</p>
                </div>
                <dl v-if="infosPedido.length" class="grid gap-3 sm:grid-cols-2">
                  <div v-for="[chave, valor] in infosPedido" :key="chave">
                    <dt class="text-xs text-texto-secundario">{{ rotuloCampo(chave) }}</dt>
                    <dd class="text-sm font-medium text-texto">{{ formatarValorCampo(chave, valor) }}</dd>
                  </div>
                </dl>
                <div v-for="grupo in gruposArquivosPedido" :key="grupo.tipo" class="space-y-2">
                  <p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-texto-secundario">
                    <Paperclip class="size-3.5" />
                    {{ grupo.titulo }}
                  </p>
                  <p
                    v-if="grupo.texto"
                    class="whitespace-pre-wrap rounded-md border border-borda bg-marfim/60 px-3 py-2 text-sm text-texto"
                  >
                    {{ grupo.texto }}
                  </p>
                  <ul v-if="grupo.itens.length" class="space-y-1.5">
                    <li v-for="arquivo in grupo.itens" :key="arquivo.id">
                      <button
                        type="button"
                        class="superficie-interativa flex w-full items-center justify-between gap-3 rounded-md border border-borda bg-marfim/60 px-3 py-2 text-left text-dourado-hover"
                        :disabled="abrindoArquivoId === arquivo.id"
                        @click="abrirArquivoPedido(arquivo.id)"
                      >
                        <span class="min-w-0 truncate text-sm font-medium underline decoration-dourado/50 underline-offset-2">
                          {{ arquivo.nome }}
                        </span>
                        <span class="shrink-0 text-xs text-texto-secundario">
                          {{ arquivo.tamanho ? formatarTamanho(arquivo.tamanho) : 'Abrir' }}
                        </span>
                      </button>
                    </li>
                  </ul>
                </div>
              </template>
              <p v-else class="text-sm text-texto-secundario">
                Ainda não há detalhes do pedido. Quando o bot (ou o time) coletar a necessidade e os
                campos do orçamento, eles aparecem aqui para o vendedor montar a proposta.
              </p>
            </CardContent>
          </Card>

          <div id="painel-orcamento">
            <PainelOrcamento
              :oportunidade-id="op.id"
              :codigo-pedido="op.codigo"
              :pode-enviar="emEtapaOrcamento || emNegociacao"
              @atualizado="refetch()"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <GitBranch class="size-4 text-dourado-hover" />
                Jornada do negócio
              </CardTitle>
            </CardHeader>
            <CardContent class="space-y-6">
              <div
                v-if="emNegociacao"
                class="rounded-lg border border-dourado/35 bg-dourado/8 p-4"
              >
                <p class="text-sm font-semibold text-texto">Como ficou a proposta?</p>
                <p class="mt-1 text-sm text-texto-secundario">
                  Depois do orçamento, registre o desfecho para avançar a linha do tempo.
                </p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <Button
                    v-if="etapaGanha"
                    variante="primario"
                    :disabled="!!movendoEtapaId"
                    :carregando="movendoEtapaId === etapaGanha.id"
                    @click="irParaEtapa(etapaGanha.id)"
                  >
                    <CircleCheck class="size-4" />
                    {{ etapaGanha.nome }}
                  </Button>
                  <Button
                    v-if="etapaPerdida"
                    variante="contorno"
                    :disabled="!!movendoEtapaId"
                    :carregando="movendoEtapaId === etapaPerdida.id"
                    @click="pedirDesfechoPerdido"
                  >
                    <CircleX class="size-4" />
                    {{ etapaPerdida.nome }}
                  </Button>
                </div>
              </div>
              <p v-else class="text-sm text-texto-secundario">
                O progresso é atualizado pelas ações realizadas. Você trabalha; a ARCCO registra a história.
              </p>
              <ol v-if="passosProcesso.length" class="relative">
                <li
                  v-for="(passo, indice) in passosProcesso"
                  :key="passo.etapa.id"
                  class="relative flex gap-3 pb-6 last:pb-0"
                >
                  <div class="flex flex-col items-center">
                    <span
                      class="flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold"
                      :class="{
                        'border-dourado bg-dourado text-preto': passo.estado === 'feita',
                        'border-dourado bg-branco text-dourado-hover ring-4 ring-dourado/20':
                          passo.estado === 'atual',
                        'border-borda bg-branco text-texto-secundario': passo.estado === 'futura',
                      }"
                    >
                      <Check v-if="passo.estado === 'feita'" class="size-3.5" />
                      <template v-else>{{ indice + 1 }}</template>
                    </span>
                    <span
                      v-if="indice < passosProcesso.length - 1"
                      class="mt-1 w-0.5 flex-1"
                      :class="passo.estado === 'feita' ? 'bg-dourado' : 'bg-borda'"
                    />
                  </div>
                  <div
                    class="min-w-0 flex-1 pt-0.5"
                    :aria-current="passo.estado === 'atual' ? 'step' : undefined"
                  >
                    <p
                      class="text-sm font-medium"
                      :class="
                        passo.estado === 'futura' ? 'text-texto-secundario' : 'text-texto'
                      "
                    >
                      {{ passo.etapa.nome }}
                      <span
                        v-if="passo.estado === 'atual'"
                        class="ml-2 text-xs font-normal text-dourado-hover"
                      >
                        agora
                      </span>
                    </p>
                    <p v-if="passo.chegada && passo.estado !== 'futura'" class="mt-0.5 text-xs text-texto-secundario">
                      {{ formatarDataHora(passo.chegada.criadoEm) }}
                      · {{ ROTULO_ORIGEM[passo.chegada.origem] ?? passo.chegada.origem }}
                    </p>
                    <p
                      v-else-if="passo.estado === 'futura'"
                      class="mt-0.5 text-xs text-dourado-hover"
                    >
                      Próxima etapa possível
                    </p>
                  </div>
                </li>
              </ol>

              <div v-if="op.eventos?.length" class="border-t border-borda pt-5">
                <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-texto-secundario">
                  Atividade recente
                </p>
                <ul class="space-y-4">
                  <li
                    v-for="item in op.eventos"
                    :key="item.id"
                    class="relative border-l-2 border-dourado/35 pl-4 text-sm text-texto"
                  >
                    <span class="absolute -left-[5px] top-1 size-2 rounded-full bg-dourado" />
                    <p class="font-medium">{{ item.titulo }}</p>
                    <p v-if="item.descricao" class="mt-0.5 text-xs text-texto-secundario">{{ item.descricao }}</p>
                    <p class="mt-1 text-[11px] text-texto-secundario">
                      {{ formatarDataHora(item.criadoEm) }} · {{ rotuloOrigem(item.origem) }}
                    </p>
                  </li>
                </ul>
              </div>

              <details class="border-t border-borda pt-4 text-xs text-texto-secundario">
                <summary class="cursor-pointer select-none hover:text-texto">Corrigir etapa manualmente</summary>
                <p class="mt-2">Use somente para corrigir uma informação incorreta.</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <Button
                    v-for="passo in passosProcesso"
                    :key="passo.etapa.id"
                    variante="contorno"
                    tamanho="sm"
                    :disabled="passo.estado === 'atual' || !!movendoEtapaId"
                    :carregando="movendoEtapaId === passo.etapa.id"
                    @click="irParaEtapa(passo.etapa.id)"
                  >
                    {{ passo.etapa.nome }}
                  </Button>
                </div>
              </details>
            </CardContent>
          </Card>
        </div>

        <Card class="h-fit">
          <CardHeader><CardTitle>Detalhes</CardTitle></CardHeader>
          <CardContent class="space-y-3 text-sm">
            <div class="space-y-1">
              <p class="text-xs font-medium uppercase tracking-wide text-texto-secundario">
                Pedido
              </p>
              <p class="font-medium text-texto">{{ op.codigo }}</p>
            </div>

            <template v-if="orcamentoResumo">
              <div class="space-y-1">
                <p class="text-xs font-medium uppercase tracking-wide text-texto-secundario">
                  Orçamento
                </p>
                <p class="font-medium text-texto">
                  {{ orcamentoResumo.numero }}
                  <span class="font-normal text-texto-secundario">
                    · v{{ orcamentoResumo.versao }}
                    <template v-if="orcamentoResumo.vigente"> · vigente</template>
                  </span>
                </p>
              </div>

              <div class="space-y-1.5">
                <p class="text-xs font-medium uppercase tracking-wide text-texto-secundario">
                  Itens do orçamento
                </p>
                <ul class="divide-y divide-borda/70 rounded-sm border border-borda/70">
                  <li
                    v-for="item in orcamentoResumo.itens"
                    :key="item.id"
                    class="flex items-start justify-between gap-2 px-2.5 py-2"
                  >
                    <div class="min-w-0">
                      <p class="truncate text-texto">{{ item.nome }}</p>
                      <p class="text-xs text-texto-secundario">
                        {{ item.quantidade }} {{ item.unidade }}
                        · {{ formatarMoeda(item.precoUnitario) }}
                      </p>
                    </div>
                    <p class="shrink-0 font-medium text-texto">
                      {{ formatarMoeda(item.totalLinha) }}
                    </p>
                  </li>
                </ul>
                <div class="flex items-baseline justify-between pt-1">
                  <span class="text-texto-secundario">Total</span>
                  <span class="text-base font-semibold text-texto">
                    {{ formatarMoeda(orcamentoResumo.total) }}
                  </span>
                </div>
                <p class="text-xs text-texto-secundario">
                  Valor e quantidades vêm do orçamento (atualizam ao salvar/enviar).
                </p>
              </div>
            </template>

            <div v-else class="space-y-1.5">
              <Label for="valor-negocio">Valor do negócio</Label>
              <div class="flex gap-2">
                <Input
                  id="valor-negocio"
                  v-model="valorNegocio"
                  placeholder="0,00"
                  inputmode="decimal"
                  autocomplete="off"
                  @keydown.enter.prevent="salvarValorNegocio"
                />
                <Button
                  variante="primario"
                  class="h-10 shrink-0"
                  :disabled="!valorNegocioAlterado || salvandoValor"
                  :carregando="salvandoValor"
                  @click="salvarValorNegocio"
                >
                  Salvar
                </Button>
              </div>
              <p class="text-xs text-texto-secundario">
                Sem orçamento ainda — informe o valor manualmente ou crie um orçamento.
              </p>
            </div>

            <RouterLink
              v-if="op.contato"
              :to="`/app/contatos/${op.contato.id}`"
              class="flex items-center gap-2 hover:text-dourado-hover"
            >
              <User class="size-4 text-texto-secundario" /> {{ op.contato.nome }}
            </RouterLink>
            <RouterLink
              v-if="op.obra"
              :to="`/app/obras/${op.obra.id}`"
              class="flex items-center gap-2 hover:text-dourado-hover"
            >
              <Building2 class="size-4 text-texto-secundario" /> {{ op.obra.nome }}
            </RouterLink>
            <p v-if="op.responsavel" class="flex items-center gap-2">
              <Flag class="size-4 text-texto-secundario" /> {{ op.responsavel.nome }}
            </p>
            <p v-if="op.previsaoFechamento" class="flex items-center gap-2">
              <Calendar class="size-4 text-texto-secundario" />
              Previsão: {{ formatarData(op.previsaoFechamento) }}
            </p>
          </CardContent>
        </Card>
      </div>
    </template>

    <Dialog
      v-model="modalOrcamentoAberto"
      titulo="Enviar orçamento"
      descricao="Informe o valor, anexe o PDF se quiser e envie pelo WhatsApp. O negócio avança para Negociação e o valor aparece no card."
      tamanho="lg"
    >
      <div class="space-y-4">
        <div class="space-y-1.5">
          <Label>Valor do orçamento</Label>
          <Input
            v-model="valorOrcamento"
            placeholder="0,00"
            inputmode="decimal"
            autocomplete="off"
          />
          <p class="text-xs text-texto-secundario">Esse valor é o que aparece no card do pipeline.</p>
        </div>
        <div class="space-y-1.5">
          <Label>Arquivo (PDF ou imagem)</Label>
          <input
            ref="inputArquivoOrcamento"
            type="file"
            accept="application/pdf,image/*"
            class="hidden"
            @change="aoEscolherArquivo"
          />
          <div class="flex items-center gap-2">
            <Button
              variante="contorno"
              tamanho="sm"
              type="button"
              @click="inputArquivoOrcamento?.click()"
            >
              <Paperclip class="size-4" />
              {{ arquivoOrcamento ? 'Trocar arquivo' : 'Anexar arquivo' }}
            </Button>
            <span v-if="arquivoOrcamento" class="flex min-w-0 items-center gap-1.5 text-sm text-texto">
              <span class="truncate">{{ arquivoOrcamento.name }}</span>
              <button type="button" class="text-texto-secundario hover:text-erro" @click="limparArquivoOrcamento">
                <X class="size-3.5" />
              </button>
            </span>
            <span v-else class="text-xs text-texto-secundario">Opcional</span>
          </div>
        </div>
        <div class="space-y-1.5">
          <Label>Mensagem</Label>
          <Textarea v-model="textoOrcamento" class="min-h-56 font-mono text-sm" />
        </div>
      </div>
      <template #rodape>
        <Button variante="secundario" @click="modalOrcamentoAberto = false">Cancelar</Button>
        <Button :carregando="enviandoOrcamento" @click="enviarOrcamento">
          <Send class="size-4" /> Enviar no WhatsApp
        </Button>
      </template>
    </Dialog>

    <Dialog
      v-model="modalPerdaAberto"
      :titulo="etapaPerdida?.nome ?? 'Perdido'"
      :descricao="`Informe o motivo para mover o negócio para ${etapaPerdida?.nome ?? 'perdido'}.`"
    >
      <div class="space-y-1.5">
        <Label for="motivo-perda">Motivo</Label>
        <Textarea id="motivo-perda" v-model="motivoPerda" placeholder="Ex.: preço, prazo, fechou com outro..." />
      </div>
      <template #rodape>
        <Button variante="secundario" @click="modalPerdaAberto = false">Cancelar</Button>
        <Button
          variante="perigo"
          :carregando="!!movendoEtapaId"
          @click="confirmarPerda"
        >
          {{ etapaPerdida?.nome ?? 'Registrar' }}
        </Button>
      </template>
    </Dialog>

    <ModalConfirmacao
      v-model="confirmarExclusao"
      titulo="Excluir oportunidade?"
      descricao="Esta ação não poderá ser desfeita."
      texto-confirmar="Excluir"
      perigo
      :carregando="excluindo"
      @confirmar="excluir"
    />
  </div>
</template>
