<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Ban, FileSpreadsheet, ShoppingCart } from 'lucide-vue-next';
import { PersonalizacaoComercial, PermissaoComercial } from '@arcco/contratos';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import Dialog from '@/components/ui/Dialog.vue';
import Label from '@/components/ui/Label.vue';
import Input from '@/components/ui/Input.vue';
import Textarea from '@/components/ui/Textarea.vue';
import AcoesNfeEventos from '@/modules/fiscal/AcoesNfeEventos.vue';
import {
  servicoArquivos,
  servicoNotasFiscais,
  servicoPedidos,
  type Pedido,
  type PreparacaoNfePedido,
} from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { formatarMoeda } from '@/composables/formatadores';
import { useAutenticacaoStore } from '@/stores/autenticacao';
import type { NotaFiscal } from '@/types';

const props = defineProps<{ oportunidadeId: string }>();
const emit = defineEmits<{ (e: 'atualizado'): void }>();

const auth = useAutenticacaoStore();
const ecolume = computed(
  () => auth.empresa?.personalizacaoComercial === PersonalizacaoComercial.ECOLUME,
);
const podeCancelar = computed(() =>
  auth.temPermissaoComercial(PermissaoComercial.CANCELAR_PEDIDO),
);
const podeEmitirNf = computed(() => auth.temPermissaoComercial(PermissaoComercial.EMITIR_NF));
const podeCancelarNf = computed(() =>
  auth.temPermissaoComercial(PermissaoComercial.CANCELAR_NF),
);
const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();
const rota = useRoute();
const router = useRouter();

const { data: pedidos, refetch } = useQuery({
  queryKey: computed(() => ['pedidos', props.oportunidadeId]),
  queryFn: () => servicoPedidos.listarPorOportunidade(props.oportunidadeId),
  enabled: ecolume,
});

watch(
  [() => rota.query.emitirNf, pedidos],
  async ([qid, lista]) => {
    if (!qid || typeof qid !== 'string' || !lista?.length) return;
    const ped = lista.find((p) => p.id === qid);
    if (!ped || ped.status === 'CANCELADO') return;
    await abrirEmitirNf(ped);
    const q = { ...rota.query };
    delete q.emitirNf;
    void router.replace({ query: q });
  },
  { flush: 'post' },
);

const lista = computed(() => pedidos.value ?? []);
const modalAberto = ref(false);
const alvo = ref<Pedido | null>(null);
const motivo = ref('');
const confirmado = ref(false);
const cancelando = ref(false);

/** ECOL-24 — emissão NF-e */
const modalNf = ref(false);
const prep = ref<PreparacaoNfePedido | null>(null);
const carregandoPrep = ref(false);
const emitindo = ref(false);
const linhas = reactive<
  Record<
    string,
    {
      marcado: boolean;
      quantidade: number;
      descricao: string;
      ncm: string;
      origemFiscal: string;
    }
  >
>({});
const cancelNfId = ref<string | null>(null);
const justifCancel = ref('');
const confirmCancelNf = ref(false);
const cancelandoNf = ref(false);
const checklistEmCurso = ref<string | null>(null);

function itensChecklist(p: Pedido) {
  return [...(p.checklist ?? [])]
    .filter((i) => i.aplicavel)
    .sort((a, b) => a.ordem - b.ordem);
}

function dicaChecklist(tipo: string): string | null {
  if (tipo === 'MATERIAL_SEPARADO') {
    return 'Marca ao ir para Pronto para entrega; desmarca se voltar para Separação/Confirmado.';
  }
  if (tipo === 'NF_EMITIDA') {
    return 'Marca sozinho quando a NF-e autorizada cobrir o pedido.';
  }
  if (tipo === 'COMISSAO_PAGA') {
    return 'Marca ao registrar o pagamento da comissão do parceiro.';
  }
  if (tipo === 'ENTREGUE') {
    return 'Também marca na Agenda com “Entrega final”.';
  }
  return null;
}

function checklistManual(item: { automatico: boolean; tipo: string }) {
  return !item.automatico;
}

async function alternarChecklist(
  p: Pedido,
  item: { id: string; concluido: boolean; automatico: boolean; tipo: string },
) {
  if (p.status === 'CANCELADO' || !checklistManual(item) || checklistEmCurso.value) return;
  checklistEmCurso.value = item.id;
  try {
    await servicoPedidos.marcarChecklist(p.id, item.id, !item.concluido);
    sucesso(item.concluido ? 'Item reaberto no checklist.' : 'Item concluído no checklist.');
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ['pipeline-ecolume'] });
    emit('atualizado');
  } catch (e) {
    notificarErro(e);
  } finally {
    checklistEmCurso.value = null;
  }
}

function abrirCancelar(p: Pedido) {
  if (p.status === 'CANCELADO') return;
  alvo.value = p;
  motivo.value = '';
  confirmado.value = false;
  modalAberto.value = true;
}

async function confirmarCancelamento() {
  if (!alvo.value || !confirmado.value || motivo.value.trim().length < 3) return;
  cancelando.value = true;
  try {
    const ped = await servicoPedidos.cancelar(alvo.value.id, {
      motivo: motivo.value.trim(),
      confirmar: true,
    });
    if (ped.alertaPagamentosRecebidos) {
      sucesso(
        `Pedido ${ped.numero} cancelado. ${ped.alertaPagamentosRecebidos.mensagem}`,
      );
    } else {
      sucesso(`Pedido ${ped.numero} cancelado`);
    }
    modalAberto.value = false;
    await refetch();
    void queryClient.invalidateQueries({ queryKey: ['orcamentos', props.oportunidadeId] });
    emit('atualizado');
  } catch (e) {
    notificarErro(e);
  } finally {
    cancelando.value = false;
  }
}

async function abrirEmitirNf(p: Pedido) {
  if (p.status === 'CANCELADO') return;
  alvo.value = p;
  prep.value = null;
  modalNf.value = true;
  carregandoPrep.value = true;
  try {
    const dados = await servicoNotasFiscais.prepararPedido(p.id);
    prep.value = dados;
    for (const key of Object.keys(linhas)) delete linhas[key];
    for (const item of dados.itens) {
      linhas[item.itemPedidoId] = {
        marcado: item.quantidadeDisponivel > 0,
        quantidade: item.quantidadeDisponivel,
        descricao: item.nomeFiscalPadrao,
        ncm: item.ncm ?? '',
        origemFiscal: item.origemFiscal ?? '',
      };
    }
  } catch (e) {
    notificarErro(e);
    modalNf.value = false;
  } finally {
    carregandoPrep.value = false;
  }
}

const itensParaEnvio = computed(() => {
  if (!prep.value) return [];
  return prep.value.itens
    .filter((i) => {
      const l = linhas[i.itemPedidoId];
      return l?.marcado && l.quantidade > 0 && i.quantidadeDisponivel > 0;
    })
    .map((i) => {
      const l = linhas[i.itemPedidoId]!;
      return {
        itemPedidoId: i.itemPedidoId,
        quantidade: Number(l.quantidade),
        descricao: l.descricao.trim() || i.nomeFiscalPadrao,
        ...(i.avulso
          ? {
              ncm: l.ncm.trim(),
              origemFiscal: l.origemFiscal.trim(),
            }
          : {}),
      };
    });
});

async function confirmarEmissao() {
  if (!alvo.value || !itensParaEnvio.value.length) return;
  emitindo.value = true;
  try {
    const nf = await servicoNotasFiscais.emitirPedido(alvo.value.id, {
      itens: itensParaEnvio.value,
    });
    const mock = Boolean(nf.respostaFocus?._mock);
    sucesso(
      mock
        ? `NF-e simulada (${nf.status})${nf.numero ? ` · nº ${nf.numero}` : ''}`
        : `NF-e ${nf.status}${nf.numero ? ` · nº ${nf.numero}` : ''}`,
    );
    const dados = await servicoNotasFiscais.prepararPedido(alvo.value.id);
    prep.value = dados;
    await refetch();
    void queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] });
    emit('atualizado');
  } catch (e) {
    notificarErro(e);
  } finally {
    emitindo.value = false;
  }
}

async function recarregarPrep() {
  if (!alvo.value) return;
  try {
    prep.value = await servicoNotasFiscais.prepararPedido(alvo.value.id);
  } catch (e) {
    notificarErro(e);
  }
}

async function baixarDoc(id: string, nome: string) {
  try {
    await servicoArquivos.baixar(id, nome);
  } catch (e) {
    notificarErro(e);
  }
}

async function confirmarCancelNf(nf: NotaFiscal) {
  if (!confirmCancelNf.value || justifCancel.value.trim().length < 15) return;
  cancelandoNf.value = true;
  try {
    const r = await servicoNotasFiscais.cancelar(nf.id, {
      justificativa: justifCancel.value.trim(),
      confirmar: true,
    });
    sucesso(r.limitacao ? 'NF-e cancelada (simulação local, sem token Focus)' : 'NF-e cancelada');
    cancelNfId.value = null;
    justifCancel.value = '';
    confirmCancelNf.value = false;
    if (alvo.value) {
      prep.value = await servicoNotasFiscais.prepararPedido(alvo.value.id);
    }
    await refetch();
    emit('atualizado');
  } catch (e) {
    notificarErro(e);
  } finally {
    cancelandoNf.value = false;
  }
}

function linha(id: string) {
  const l = linhas[id];
  if (!l) {
    linhas[id] = {
      marcado: false,
      quantidade: 0,
      descricao: '',
      ncm: '',
      origemFiscal: '',
    };
  }
  return linhas[id]!;
}

function rotuloStatus(status: string) {
  const mapa: Record<string, string> = {
    CONFIRMADO: 'Confirmado',
    FINALIZADO: 'Finalizado',
    CANCELADO: 'Cancelado',
  };
  return mapa[status] ?? status;
}

function rotuloNf(status: string) {
  const mapa: Record<string, string> = {
    PROCESSANDO: 'Processando',
    AUTORIZADA: 'Autorizada',
    REJEITADA: 'Rejeitada',
    CANCELADA: 'Cancelada',
    RASCUNHO: 'Rascunho',
  };
  return mapa[status] ?? status;
}
</script>

<template>
  <Card v-if="ecolume && lista.length">
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <ShoppingCart class="size-4 text-dourado-hover" />
        Pedidos
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      <div
        v-for="p in lista"
        :key="p.id"
        class="rounded-md border border-borda p-3"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium text-texto">{{ p.numero }}</p>
              <Badge :variante="p.status === 'CANCELADO' ? 'alerta' : 'sucesso'">
                {{ rotuloStatus(p.status) }}
              </Badge>
            </div>
            <p class="mt-1 text-sm text-texto-secundario">
              {{ formatarMoeda(p.total) }}
              <template v-if="p.valorRecebido != null">
                · Recebido {{ formatarMoeda(p.valorRecebido) }}
              </template>
            </p>
            <p
              v-if="p.status === 'CANCELADO' && p.motivoCancelamento"
              class="mt-1 text-xs text-texto-secundario"
            >
              Motivo: {{ p.motivoCancelamento }}
              <template v-if="p.canceladoEm">
                · {{ new Date(p.canceladoEm).toLocaleString('pt-BR') }}
              </template>
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              v-if="podeEmitirNf && p.status !== 'CANCELADO'"
              variante="contorno"
              tamanho="sm"
              @click="abrirEmitirNf(p)"
            >
              <FileSpreadsheet class="size-4" /> Emitir NF-e
            </Button>
            <Button
              v-if="podeCancelar && p.status !== 'CANCELADO'"
              variante="contorno"
              tamanho="sm"
              @click="abrirCancelar(p)"
            >
              <Ban class="size-4" /> Cancelar pedido
            </Button>
          </div>
        </div>

        <div
          v-if="itensChecklist(p).length && p.status !== 'CANCELADO'"
          class="mt-3 border-t border-borda pt-3"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-texto-secundario">
            Checklist do pedido
          </p>
          <p class="mt-1 text-xs text-texto-secundario">
            Marque aqui o que já foi feito. Com tudo concluído, o pedido vai para Finalizado.
          </p>
          <ul class="mt-2 space-y-2">
            <li
              v-for="item in itensChecklist(p)"
              :key="item.id"
              class="flex items-start gap-2 rounded-md border border-borda/70 bg-marfim/40 px-2.5 py-2"
            >
              <input
                type="checkbox"
                class="mt-0.5 size-4 shrink-0 rounded border-borda"
                :checked="item.concluido"
                :disabled="
                  !checklistManual(item) ||
                  checklistEmCurso === item.id ||
                  p.status === 'CANCELADO'
                "
                :aria-label="item.rotulo"
                @change="alternarChecklist(p, item)"
              />
              <div class="min-w-0 flex-1">
                <p
                  class="text-sm font-medium"
                  :class="item.concluido ? 'text-texto-secundario line-through' : 'text-texto'"
                >
                  {{ item.rotulo }}
                </p>
                <p v-if="dicaChecklist(item.tipo)" class="mt-0.5 text-[11px] text-texto-secundario">
                  {{ dicaChecklist(item.tipo) }}
                </p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </CardContent>
  </Card>

  <Dialog
    v-model="modalAberto"
    titulo="Cancelar pedido"
    tamanho="md"
  >
    <div v-if="alvo" class="space-y-3">
      <p class="text-sm text-texto-secundario">
        {{ alvo.numero }} · {{ formatarMoeda(alvo.total) }}. O estoque será estornado e a
        comissão cancelada. Pagamentos recebidos não são reembolsados automaticamente.
      </p>
      <p
        v-if="(alvo.valorRecebido ?? 0) > 0"
        class="rounded border border-alerta/40 bg-alerta/10 px-2 py-1.5 text-sm text-alerta"
      >
        Há {{ formatarMoeda(alvo.valorRecebido!) }} já recebidos — conciliação/devolução manual.
      </p>
      <div class="space-y-1.5">
        <Label obrigatorio>Motivo</Label>
        <Textarea v-model="motivo" :rows="3" placeholder="Informe o motivo do cancelamento" />
      </div>
      <label class="flex items-start gap-2 text-sm text-texto">
        <input v-model="confirmado" type="checkbox" class="mt-1" />
        Confirmo o cancelamento deste pedido e o estorno de estoque.
      </label>
      <div class="flex justify-end gap-2">
        <Button variante="secundario" :disabled="cancelando" @click="modalAberto = false">
          Voltar
        </Button>
        <Button
          :carregando="cancelando"
          :disabled="!confirmado || motivo.trim().length < 3"
          @click="confirmarCancelamento"
        >
          Confirmar cancelamento
        </Button>
      </div>
    </div>
  </Dialog>

  <Dialog v-model="modalNf" titulo="Emitir NF-e do pedido" tamanho="lg">
    <div v-if="carregandoPrep" class="text-sm text-texto-secundario">Preparando…</div>
    <div v-else-if="prep" class="space-y-4">
      <p class="text-sm text-texto-secundario">
        {{ prep.numero }} · preços e quantidades do pedido. Descrição editável só nesta nota.
      </p>
      <p
        v-if="!prep.emissaoRealHabilitada"
        class="rounded border border-alerta/40 bg-alerta/10 px-2 py-1.5 text-xs text-alerta"
      >
        Emissão real bloqueada (P3 e/ou certificado Focus). Sem token, o envio usa mock local —
        não é homologação Sefaz.
      </p>
      <ul v-if="prep.pendencias.length" class="space-y-1 rounded border border-borda p-2 text-xs">
        <li v-for="(pen, i) in prep.pendencias" :key="i" class="text-texto-secundario">
          <span class="font-medium text-texto">{{ pen.codigo }}</span>
          — {{ pen.mensagem }} · corrigir em: {{ pen.onde }}
        </li>
      </ul>

      <div class="max-h-72 space-y-3 overflow-y-auto">
        <div
          v-for="item in prep.itens"
          :key="item.itemPedidoId"
          class="rounded border border-borda p-2 text-sm"
        >
          <label class="flex items-start gap-2">
            <input
              v-model="linha(item.itemPedidoId).marcado"
              type="checkbox"
              class="mt-1"
              :disabled="item.quantidadeDisponivel <= 0"
            />
            <div class="min-w-0 flex-1 space-y-1.5">
              <p class="font-medium text-texto">
                {{ item.nome }}
                <span class="text-xs font-normal text-texto-secundario">
                  · disp. {{ item.quantidadeDisponivel }}/{{ item.quantidadeVendida }}
                  {{ item.unidade }}
                </span>
              </p>
              <div class="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>Qtd. nesta NF</Label>
                  <Input
                    v-model.number="linha(item.itemPedidoId).quantidade"
                    type="number"
                    :min="0"
                    :max="item.quantidadeDisponivel"
                    step="0.0001"
                  />
                </div>
                <div>
                  <Label>Descrição na NF</Label>
                  <Input v-model="linha(item.itemPedidoId).descricao" maxlength="120" />
                </div>
              </div>
              <template v-if="item.avulso">
                <div class="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label obrigatorio>NCM (avulso)</Label>
                    <Input v-model="linha(item.itemPedidoId).ncm" maxlength="10" />
                  </div>
                  <div>
                    <Label obrigatorio>Origem</Label>
                    <Input v-model="linha(item.itemPedidoId).origemFiscal" maxlength="1" />
                  </div>
                </div>
              </template>
              <p v-else class="text-xs text-texto-secundario">
                NCM {{ item.ncm || '—' }} · CEST {{ item.cest || '—' }} · origem
                {{ item.origemFiscal || '—' }}
                <template v-if="item.codigoInterno"> · {{ item.codigoInterno }}</template>
              </p>
            </div>
          </label>
        </div>
      </div>

      <div v-if="prep.notas.length" class="space-y-2">
        <p class="text-xs font-semibold text-texto-secundario">Notas deste pedido</p>
        <div
          v-for="nf in prep.notas"
          :key="nf.id"
          class="rounded border border-borda p-2 text-xs"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span>
              {{ rotuloNf(nf.status) }}
              <template v-if="nf.numero"> · nº {{ nf.numero }}/{{ nf.serie }}</template>
              <template v-if="nf.respostaFocus?._mock"> (simulação)</template>
            </span>
            <div class="flex flex-wrap gap-1">
              <Button
                v-if="nf.arquivoPdfId"
                variante="fantasma"
                tamanho="sm"
                @click="baixarDoc(nf.arquivoPdfId!, `danfe-${nf.numero || nf.id}.pdf`)"
              >
                DANFE
              </Button>
              <Button
                v-if="nf.arquivoXmlId"
                variante="fantasma"
                tamanho="sm"
                @click="baixarDoc(nf.arquivoXmlId!, `nfe-${nf.numero || nf.id}.xml`)"
              >
                XML
              </Button>
              <Button
                v-if="podeCancelarNf && nf.status === 'AUTORIZADA'"
                variante="fantasma"
                tamanho="sm"
                @click="
                  cancelNfId = nf.id;
                  justifCancel = '';
                  confirmCancelNf = false;
                "
              >
                Cancelar NF
              </Button>
            </div>
          </div>
          <p v-if="nf.mensagemErro" class="mt-1 text-texto-secundario">{{ nf.mensagemErro }}</p>
          <div
            v-if="cancelNfId === nf.id"
            class="mt-2 space-y-2 rounded border border-borda bg-superficie p-2"
          >
            <Label obrigatorio>Justificativa (≥15)</Label>
            <Textarea v-model="justifCancel" :rows="2" />
            <label class="flex items-center gap-2">
              <input v-model="confirmCancelNf" type="checkbox" />
              Confirmo o cancelamento fiscal
            </label>
            <Button
              tamanho="sm"
              :carregando="cancelandoNf"
              :disabled="!confirmCancelNf || justifCancel.trim().length < 15"
              @click="confirmarCancelNf(nf)"
            >
              Confirmar
            </Button>
          </div>
          <AcoesNfeEventos
            v-if="nf.status === 'AUTORIZADA'"
            class="mt-2"
            :nota-id="nf.id"
            :status="nf.status"
            :email-padrao="prep.emailDestinatarioPadrao"
            :eventos="nf.eventos"
            :simulado="Boolean(nf.respostaFocus?._mock) || prep.emailDanfeReal === false"
            @atualizado="recarregarPrep"
          />
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <Button variante="secundario" :disabled="emitindo" @click="modalNf = false">Fechar</Button>
        <Button
          :carregando="emitindo"
          :disabled="!itensParaEnvio.length || prep.statusPedido === 'CANCELADO'"
          @click="confirmarEmissao"
        >
          Enviar NF-e
        </Button>
      </div>
    </div>
  </Dialog>
</template>
