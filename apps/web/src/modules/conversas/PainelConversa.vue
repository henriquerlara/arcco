<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Bot, FileText, Send, UserCheck, CheckCircle2, Info, Check, CheckCheck } from 'lucide-vue-next';
import { DirecaoMensagem, ModoAtendimento } from '@arcco/contratos';
import type { Conversa, Mensagem } from '@/types';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import BadgeStatus from '@/components/compartilhados/BadgeStatus.vue';
import { formatarHora, formatarTelefone, iniciais } from '@/composables/formatadores';
import { cn } from '@/composables/cn';
import { servicoArquivos } from '@/services';

const props = defineProps<{
  conversa: Conversa | null;
  mensagens: Mensagem[];
  carregando?: boolean;
  enviando?: boolean;
}>();

const emit = defineEmits<{
  (e: 'enviar', texto: string): void;
  (e: 'assumir'): void;
  (e: 'devolver-bot'): void;
  (e: 'finalizar'): void;
}>();

const texto = ref('');
const areaMensagens = ref<HTMLElement | null>(null);
const previewsImagem = ref<Record<string, string>>({});
const abrindoArquivoId = ref<string | null>(null);

const podeEnviar = computed(
  () => props.conversa?.modo === ModoAtendimento.HUMANO,
);

const ehMeta = computed(
  () => String(props.conversa?.conexao?.provedor ?? '').toUpperCase() === 'META',
);

const ROTULO_INTENCAO: Record<string, string> = {
  VENDAS: 'Vendas',
  NOVO_ORCAMENTO: 'Novo orçamento',
  NEGOCIAR_ORCAMENTO: 'Negociar',
  AJUSTAR_ORCAMENTO: 'Ajuste',
  FINANCEIRO: 'Financeiro',
  ENTREGA: 'Entrega',
  SAC: 'SAC',
  POS_VENDA: 'Pós-venda',
  FALAR_COM_PESSOA: 'Humano',
  DUVIDA: 'Dúvida',
  ACOMPANHAR_SOLICITACAO: 'Acompanhar',
  OUTRO: 'Outro',
};

function rotuloIntencao(valor?: string | null): string | null {
  if (!valor) return null;
  return ROTULO_INTENCAO[valor] ?? valor;
}

function rotuloStatus(status: string, enviada: boolean): string | null {
  if (!enviada) return null;
  if (status === 'ERRO') return 'Falha no envio';
  if (status === 'PROCESSANDO') return 'Enviando…';
  if (status === 'LIDA') return 'Lida';
  if (status === 'ENTREGUE') return 'Entregue';
  if (status === 'ENVIADA') return 'Enviada';
  return null;
}

async function rolarParaFim() {
  await nextTick();
  if (areaMensagens.value) {
    areaMensagens.value.scrollTop = areaMensagens.value.scrollHeight;
  }
}

watch(() => props.mensagens.length, rolarParaFim);
watch(() => props.conversa?.id, rolarParaFim);

watch(
  () => props.mensagens,
  async (mensagens) => {
    for (const msg of mensagens) {
      if (msg.tipo !== 'IMAGEM' || !msg.arquivoId || previewsImagem.value[msg.arquivoId]) continue;
      try {
        const blob = await servicoArquivos.blob(msg.arquivoId);
        previewsImagem.value[msg.arquivoId] = URL.createObjectURL(blob);
      } catch {
        /* preview opcional */
      }
    }
  },
  { immediate: true },
);

async function abrirArquivo(msg: Mensagem) {
  if (!msg.arquivoId || abrindoArquivoId.value) return;
  abrindoArquivoId.value = msg.arquivoId;
  try {
    await servicoArquivos.abrir(msg.arquivoId);
  } finally {
    abrindoArquivoId.value = null;
  }
}

function enviar() {
  const valor = texto.value.trim();
  if (!valor) return;
  emit('enviar', valor);
  texto.value = '';
}

function aoTeclar(evento: KeyboardEvent) {
  if (evento.key === 'Enter' && !evento.shiftKey) {
    evento.preventDefault();
    enviar();
  }
}
</script>

<template>
  <section class="flex h-full flex-col bg-superficie">
    <template v-if="conversa">
      <header class="flex items-center justify-between gap-3 border-b border-borda bg-branco px-3 py-3 pl-12 md:px-5">
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-full bg-carvao text-sm font-semibold text-dourado-claro"
          >
            {{ iniciais(conversa.nomeExibicao ?? conversa.contato?.nome ?? conversa.telefone) }}
          </span>
          <div>
            <p class="text-sm font-semibold text-texto">
              {{ conversa.nomeExibicao ?? conversa.contato?.nome ?? formatarTelefone(conversa.telefone) }}
            </p>
            <div class="mt-0.5 flex flex-wrap items-center gap-1.5">
              <BadgeStatus familia="statusConversa" :valor="conversa.status" />
              <BadgeStatus familia="modoAtendimento" :valor="conversa.modo" />
              <Badge v-if="rotuloIntencao(conversa.intencaoAtual ?? conversa.intencao)" variante="neutro">
                {{ rotuloIntencao(conversa.intencaoAtual ?? conversa.intencao) }}
              </Badge>
              <Badge v-if="ehMeta" variante="info">WhatsApp Oficial</Badge>
            </div>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <Button
            v-if="conversa.modo !== ModoAtendimento.HUMANO"
            variante="primario"
            tamanho="sm"
            @click="emit('assumir')"
          >
            <UserCheck class="size-4" />
            Assumir
          </Button>
          <Button
            v-else
            variante="secundario"
            tamanho="sm"
            @click="emit('devolver-bot')"
          >
            <Bot class="size-4" />
            <span class="hidden lg:inline">Devolver ao bot</span>
          </Button>
          <Button variante="contorno" tamanho="sm" @click="emit('finalizar')">
            <CheckCircle2 class="size-4" />
            <span class="hidden lg:inline">Finalizar</span>
          </Button>
        </div>
      </header>

      <div
        ref="areaMensagens"
        class="area-mensagens flex-1 space-y-3 overflow-y-auto bg-marfim/30 px-4 py-5 md:px-6"
      >
        <div v-if="carregando" class="py-10 text-center text-sm text-texto-secundario">
          Carregando mensagens…
        </div>
        <template v-else>
          <div
            v-for="msg in mensagens"
            :key="msg.id"
            :class="
              cn(
                'flex',
                msg.tipo === 'SISTEMA'
                  ? 'justify-center'
                  : msg.direcao === DirecaoMensagem.ENVIADA
                    ? 'justify-end'
                    : 'justify-start',
              )
            "
          >
            <div
              v-if="msg.tipo === 'SISTEMA'"
              class="flex items-center gap-1.5 rounded-full bg-borda/60 px-3 py-1 text-xs text-texto-secundario"
            >
              <Info class="size-3.5" />
              {{ msg.conteudo }}
            </div>
            <div
              v-else
              :class="
                cn(
                  'max-w-[82%] rounded-md px-3.5 py-2.5 text-sm md:max-w-[70%]',
                  msg.direcao === DirecaoMensagem.ENVIADA
                    ? 'rounded-br-none bg-carvao text-marfim'
                    : 'rounded-bl-sm border border-borda bg-branco text-texto',
                )
              "
            >
              <p
                v-if="msg.direcao === DirecaoMensagem.ENVIADA && (msg.remetente === 'bot' || msg.deBot)"
                class="mb-0.5 flex items-center gap-1 text-[11px] font-medium opacity-70"
              >
                <Bot class="size-3" /> Bot
              </p>
              <p
                v-else-if="msg.direcao === DirecaoMensagem.ENVIADA && msg.remetente === 'atendente'"
                class="mb-0.5 flex items-center gap-1 text-[11px] font-medium opacity-70"
              >
                <UserCheck class="size-3" /> Atendente
              </p>
              <img
                v-if="msg.tipo === 'IMAGEM' && msg.arquivoId && previewsImagem[msg.arquivoId]"
                :src="previewsImagem[msg.arquivoId]"
                :alt="msg.conteudo"
                class="mb-2 max-h-56 w-full rounded-md object-contain"
              />
              <button
                v-if="msg.arquivoId"
                type="button"
                class="mb-1 flex w-full items-center gap-2 rounded-md border border-current/15 bg-black/5 px-2.5 py-1.5 text-left text-xs font-medium hover:bg-black/10"
                @click="abrirArquivo(msg)"
              >
                <FileText class="size-3.5 shrink-0" />
                <span class="min-w-0 truncate">{{ msg.conteudo || 'Abrir arquivo' }}</span>
              </button>
              <p
                v-else-if="msg.conteudo"
                class="whitespace-pre-wrap break-words"
              >
                {{ msg.conteudo }}
              </p>
              <p
                :class="
                  cn(
                    'mt-1 text-right text-[10px]',
                    msg.direcao === DirecaoMensagem.ENVIADA
                      ? 'text-marfim/45'
                      : 'text-texto-secundario',
                  )
                "
              >
                <span
                  v-if="rotuloStatus(msg.status, msg.direcao === DirecaoMensagem.ENVIADA)"
                  :class="
                    cn(
                      'mr-1.5 inline-flex items-center gap-0.5',
                      msg.status === 'ERRO' && 'text-erro',
                      msg.status === 'LIDA' && 'text-dourado-claro',
                    )
                  "
                >
                  <CheckCheck v-if="msg.status === 'LIDA' || msg.status === 'ENTREGUE'" class="size-3" />
                  <Check v-else-if="msg.status === 'ENVIADA'" class="size-3" />
                  {{ rotuloStatus(msg.status, true) }}
                </span>
                {{ formatarHora(msg.criadoEm) }}
              </p>
            </div>
          </div>
        </template>
      </div>

      <footer class="border-t border-borda bg-branco px-4 py-3">
        <div
          v-if="!podeEnviar"
          class="mb-2 rounded-md bg-marfim px-3 py-2 text-xs text-texto-secundario"
        >
          Assuma a conversa para responder manualmente. Enquanto estiver com o bot, as
          respostas são automáticas.
        </div>
        <div class="flex items-end gap-2">
          <textarea
            v-model="texto"
            rows="1"
            :disabled="!podeEnviar || enviando"
            placeholder="Escreva uma mensagem…"
            class="max-h-32 min-h-[42px] flex-1 resize-none rounded-md border border-borda bg-superficie px-3 py-2.5 text-sm outline-none focus:border-carvao focus:ring-2 focus:ring-carvao/10 disabled:opacity-60"
            @keydown="aoTeclar"
          />
          <Button
            :disabled="!podeEnviar || !texto.trim()"
            :carregando="enviando"
            tamanho="icone"
            @click="enviar"
          >
            <Send class="size-4" />
          </Button>
        </div>
      </footer>
    </template>

    <div v-else class="flex flex-1 flex-col items-center justify-center gap-2 text-center text-texto-secundario">
      <div class="flex size-16 items-center justify-center rounded-full bg-marfim text-dourado-hover">
        <Send class="size-7" />
      </div>
      <p class="text-sm">Selecione uma conversa para começar</p>
    </div>
  </section>
</template>

<style scoped>
.area-mensagens {
  background-image:
    linear-gradient(rgba(8, 47, 52, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(8, 47, 52, 0.025) 1px, transparent 1px);
  background-size: 36px 36px;
}
</style>
