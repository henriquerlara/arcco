<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Bot, Send, UserCheck, CheckCircle2, Info } from 'lucide-vue-next';
import { DirecaoMensagem, ModoAtendimento } from '@arcco/contratos';
import type { Conversa, Mensagem } from '@/types';
import Button from '@/components/ui/Button.vue';
import BadgeStatus from '@/components/compartilhados/BadgeStatus.vue';
import { formatarHora, iniciais } from '@/composables/formatadores';
import { cn } from '@/composables/cn';

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

const podeEnviar = computed(
  () => props.conversa?.modo === ModoAtendimento.HUMANO,
);

async function rolarParaFim() {
  await nextTick();
  if (areaMensagens.value) {
    areaMensagens.value.scrollTop = areaMensagens.value.scrollHeight;
  }
}

watch(() => props.mensagens.length, rolarParaFim);
watch(() => props.conversa?.id, rolarParaFim);

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
      <header class="flex items-center justify-between gap-3 border-b border-borda bg-branco px-5 py-3">
        <div class="flex items-center gap-3">
          <span
            class="flex size-10 items-center justify-center rounded-full bg-carvao text-sm font-semibold text-dourado-claro"
          >
            {{ iniciais(conversa.nomeExibicao ?? conversa.contato?.nome ?? conversa.telefone) }}
          </span>
          <div>
            <p class="text-sm font-semibold text-texto">
              {{ conversa.nomeExibicao ?? conversa.contato?.nome ?? conversa.telefone }}
            </p>
            <div class="mt-0.5 flex items-center gap-1.5">
              <BadgeStatus familia="statusConversa" :valor="conversa.status" />
              <BadgeStatus familia="modoAtendimento" :valor="conversa.modo" />
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
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
            Devolver ao bot
          </Button>
          <Button variante="contorno" tamanho="sm" @click="emit('finalizar')">
            <CheckCircle2 class="size-4" />
            Finalizar
          </Button>
        </div>
      </header>

      <div
        ref="areaMensagens"
        class="flex-1 space-y-3 overflow-y-auto bg-marfim/30 px-5 py-4"
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
                  'max-w-[70%] rounded-lg px-3.5 py-2 text-sm shadow-suave',
                  msg.direcao === DirecaoMensagem.ENVIADA
                    ? 'rounded-br-sm bg-dourado text-preto'
                    : 'rounded-bl-sm border border-borda bg-branco text-texto',
                )
              "
            >
              <p
                v-if="msg.direcao === DirecaoMensagem.ENVIADA && msg.deBot"
                class="mb-0.5 flex items-center gap-1 text-[11px] font-medium opacity-70"
              >
                <Bot class="size-3" /> Bot
              </p>
              <p class="whitespace-pre-wrap break-words">{{ msg.conteudo }}</p>
              <p
                :class="
                  cn(
                    'mt-1 text-right text-[10px]',
                    msg.direcao === DirecaoMensagem.ENVIADA
                      ? 'text-preto/50'
                      : 'text-texto-secundario',
                  )
                "
              >
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
            class="max-h-32 min-h-[42px] flex-1 resize-none rounded-md border border-borda bg-superficie px-3 py-2.5 text-sm outline-none focus:border-dourado focus:ring-2 focus:ring-ring disabled:opacity-60"
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
