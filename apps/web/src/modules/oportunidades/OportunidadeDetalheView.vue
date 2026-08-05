<script setup lang="ts">
import { computed, ref } from 'vue';
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
  Send,
  GitBranch,
  Check,
} from 'lucide-vue-next';
import EstadoErro from '@/components/compartilhados/EstadoErro.vue';
import ModalConfirmacao from '@/components/compartilhados/ModalConfirmacao.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import BadgeStatus from '@/components/compartilhados/BadgeStatus.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Button from '@/components/ui/Button.vue';
import Dialog from '@/components/ui/Dialog.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import {
  servicoOportunidades,
  servicoFunil,
  servicoCamposPersonalizados,
  servicoConversas,
} from '@/services';
import { formatarMoeda, formatarData, formatarDataHora } from '@/composables/formatadores';
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
const enviandoOrcamento = ref(false);
const movendoEtapaId = ref<string | null>(null);

const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ['oportunidade', id.value]),
  queryFn: () => servicoOportunidades.obter(id.value),
});
const op = computed(() => data.value);

const funilQuery = useQuery({
  queryKey: ['etapas-funil'],
  queryFn: () => servicoFunil.listar(),
  staleTime: 60_000,
});

const camposQuery = useQuery({
  queryKey: ['campos-oportunidade'],
  queryFn: () => servicoCamposPersonalizados.listar('OPORTUNIDADE'),
  staleTime: 60_000,
});

const rotuloCampo = computed(() => {
  const mapa = new Map((camposQuery.data.value ?? []).map((c) => [c.chave, c.rotulo]));
  return (chave: string) => mapa.get(chave) ?? chave;
});

const infosPedido = computed(() => {
  const dados = op.value?.dadosPersonalizados ?? {};
  return Object.entries(dados).filter(([, v]) => v !== undefined && v !== null && v !== '');
});

const temPedidoCliente = computed(
  () => Boolean(op.value?.descricao?.trim()) || infosPedido.value.length > 0,
);

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

function textoHistorico(item: HistoricoEtapaOportunidade): string {
  if (!item.etapaAnteriorNome) {
    return `Entrou em ${item.etapaNome}`;
  }
  return `${item.etapaAnteriorNome} → ${item.etapaNome}`;
}

async function irParaEtapa(etapaId: string) {
  if (!op.value || etapaId === op.value.etapaId || movendoEtapaId.value) return;
  const destino = (funilQuery.data.value ?? []).find((e) => e.id === etapaId);
  let motivoPerda: string | undefined;
  if (destino?.tipo === 'PERDIDA') {
    const motivo = window.prompt('Motivo da perda?');
    if (!motivo?.trim()) return;
    motivoPerda = motivo.trim();
  }

  movendoEtapaId.value = etapaId;
  try {
    await servicoOportunidades.mover(id.value, etapaId, motivoPerda);
    sucesso(`Etapa atualizada para ${destino?.nome ?? 'selecionada'}.`);
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ['pipeline'] });
  } catch (e) {
    notificarErro(e);
  } finally {
    movendoEtapaId.value = null;
  }
}

function montarTextoOrcamento(oportunidade: Oportunidade): string {
  const nome = oportunidade.contato?.nome?.split(' ')[0] || 'olá';
  const linhas: string[] = [
    `Olá, ${nome}! Segue o orçamento referente a: *${oportunidade.titulo}*`,
    '',
  ];

  if (oportunidade.valorEstimado != null) {
    linhas.push(`Valor estimado: *${formatarMoeda(oportunidade.valorEstimado)}*`);
  }
  if (oportunidade.codigoOrcamento) {
    linhas.push(`Código: ${oportunidade.codigoOrcamento}`);
  }

  const pedido: string[] = [];
  if (oportunidade.descricao?.trim()) {
    pedido.push(oportunidade.descricao.trim());
  }
  for (const [chave, valor] of Object.entries(oportunidade.dadosPersonalizados ?? {})) {
    if (valor === undefined || valor === null || valor === '') continue;
    pedido.push(`${rotuloCampo.value(chave)}: ${valor}`);
  }
  if (pedido.length) {
    linhas.push('', 'Resumo do pedido:', ...pedido);
  }

  linhas.push('', 'Qualquier dúvida, estou à disposição.');
  return linhas.join('\n');
}

function abrirEnviarOrcamento() {
  if (!op.value) return;
  textoOrcamento.value = montarTextoOrcamento(op.value);
  modalOrcamentoAberto.value = true;
}

async function enviarOrcamento() {
  const texto = textoOrcamento.value.trim();
  if (!texto) {
    notificarErro(new Error('Informe o texto do orçamento.'));
    return;
  }

  enviandoOrcamento.value = true;
  try {
    const conversa = await servicoConversas.porOportunidade(id.value);
    await servicoConversas.enviar(conversa.id, texto);
    sucesso('Orçamento enviado pelo WhatsApp.');
    modalOrcamentoAberto.value = false;
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ['pipeline'] });
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
          <h1 class="text-2xl font-semibold tracking-tight text-texto">{{ op.titulo }}</h1>
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
            tamanho="icone"
            title="Enviar orçamento"
            aria-label="Enviar orçamento"
            @click="abrirEnviarOrcamento"
          >
            <Send class="size-4" />
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
                <div v-if="op.descricao?.trim()">
                  <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-texto-secundario">
                    O que precisa orçar
                  </p>
                  <p class="whitespace-pre-wrap text-sm text-texto">{{ op.descricao }}</p>
                </div>
                <dl v-if="infosPedido.length" class="grid gap-3 sm:grid-cols-2">
                  <div v-for="[chave, valor] in infosPedido" :key="chave">
                    <dt class="text-xs text-texto-secundario">{{ rotuloCampo(chave) }}</dt>
                    <dd class="text-sm font-medium text-texto">{{ valor }}</dd>
                  </div>
                </dl>
              </template>
              <p v-else class="text-sm text-texto-secundario">
                Ainda não há detalhes do pedido. Quando o bot (ou o time) coletar a necessidade e os
                campos do orçamento, eles aparecem aqui para o vendedor montar a proposta.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <GitBranch class="size-4 text-dourado-hover" />
                Processo
              </CardTitle>
            </CardHeader>
            <CardContent class="space-y-6">
              <p class="text-xs text-texto-secundario">
                Clique em uma etapa para mover o negócio. Bot e envio de orçamento também avançam
                sozinhos.
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
                  <button
                    type="button"
                    class="min-w-0 flex-1 rounded-md pt-0.5 text-left transition-colors disabled:cursor-default"
                    :class="
                      passo.estado === 'atual'
                        ? 'cursor-default'
                        : 'hover:bg-marfim/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    "
                    :disabled="passo.estado === 'atual' || movendoEtapaId === passo.etapa.id"
                    :aria-current="passo.estado === 'atual' ? 'step' : undefined"
                    @click="irParaEtapa(passo.etapa.id)"
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
                      <span
                        v-else-if="movendoEtapaId === passo.etapa.id"
                        class="ml-2 text-xs font-normal text-texto-secundario"
                      >
                        movendo…
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
                      Pendente — clique para avançar
                    </p>
                  </button>
                </li>
              </ol>

              <div v-if="(op.historicoEtapas?.length ?? 0) > 1" class="border-t border-borda pt-4">
                <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-texto-secundario">
                  Histórico de mudanças
                </p>
                <ul class="space-y-2">
                  <li
                    v-for="item in op.historicoEtapas"
                    :key="item.id"
                    class="text-sm text-texto"
                  >
                    <span class="font-medium">{{ textoHistorico(item) }}</span>
                    <span class="text-texto-secundario">
                      · {{ formatarDataHora(item.criadoEm) }}
                      · {{ ROTULO_ORIGEM[item.origem] ?? item.origem }}
                    </span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card class="h-fit">
          <CardHeader><CardTitle>Detalhes</CardTitle></CardHeader>
          <CardContent class="space-y-3 text-sm">
            <p v-if="op.valorEstimado" class="text-lg font-semibold text-dourado-hover">
              {{ formatarMoeda(op.valorEstimado) }}
            </p>
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
            <p v-if="op.codigoOrcamento" class="text-xs text-texto-secundario">
              Orçamento: {{ op.codigoOrcamento }}
            </p>
          </CardContent>
        </Card>
      </div>
    </template>

    <Dialog
      v-model="modalOrcamentoAberto"
      titulo="Enviar orçamento"
      descricao="Revise a mensagem e envie pelo WhatsApp da conversa ligada a esta oportunidade."
      tamanho="lg"
    >
      <div class="space-y-1.5">
        <Label>Mensagem</Label>
        <Textarea v-model="textoOrcamento" class="min-h-56 font-mono text-sm" />
      </div>
      <template #rodape>
        <Button variante="secundario" @click="modalOrcamentoAberto = false">Cancelar</Button>
        <Button :carregando="enviandoOrcamento" @click="enviarOrcamento">
          <Send class="size-4" /> Enviar no WhatsApp
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
