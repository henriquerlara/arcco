<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { useRouter } from 'vue-router';
import {
  MessageCircle,
  Plug,
  PlugZap,
  QrCode,
  Send,
  RefreshCw,
} from 'lucide-vue-next';
import { StatusConexaoWhatsApp } from '@arcco/contratos';
import CabecalhoPagina from '@/components/layout/CabecalhoPagina.vue';
import NavConfiguracoes from './NavConfiguracoes.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Button from '@/components/ui/Button.vue';
import BadgeStatus from '@/components/compartilhados/BadgeStatus.vue';
import Skeleton from '@/components/compartilhados/Skeleton.vue';
import { servicoWhatsApp } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import type { StatusWhatsApp } from '@/types';

const router = useRouter();
const queryClient = useQueryClient();
const { notificarErro, sucesso, info } = useNotificacao();

const conectando = ref(false);
const simulando = ref(false);
const statusLocal = ref<StatusWhatsApp | null>(null);

const { data, isLoading, refetch } = useQuery({
  queryKey: ['whatsapp-status'],
  queryFn: () => servicoWhatsApp.status(),
  refetchInterval: (query) => {
    const atual = query.state.data;
    if (!atual || atual.status === StatusConexaoWhatsApp.CONECTADO) return 8000;
    if (
      atual.qrCode ||
      atual.status === StatusConexaoWhatsApp.QR_CODE ||
      atual.status === StatusConexaoWhatsApp.CONECTANDO
    ) {
      return 3000;
    }
    return 8000;
  },
});

const status = computed<StatusWhatsApp | null>(() => statusLocal.value ?? data.value ?? null);
const conectado = computed(() => status.value?.status === StatusConexaoWhatsApp.CONECTADO);
const ehMock = computed(() => (status.value?.provedor ?? '').toUpperCase() === 'MOCK');
const mostrarQr = computed(
  () =>
    Boolean(status.value?.qrCode) &&
    status.value?.status !== StatusConexaoWhatsApp.CONECTADO,
);

const imagemQr = computed(() => {
  const qr = status.value?.qrCode;
  if (!qr) return null;
  return qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`;
});

const simulador = reactive({
  telefone: '5511999990000',
  nome: 'Cliente Teste',
  texto: 'Olá! Preciso de um orçamento de porcelanato para minha obra.',
});

async function conectar() {
  conectando.value = true;
  try {
    const resultado = await servicoWhatsApp.conectar();
    statusLocal.value = resultado;
    queryClient.setQueryData(['whatsapp-status'], resultado);
    if (resultado.qrCode) {
      info('QR Code gerado', 'Abra o WhatsApp no celular e escaneie o código.');
    } else if (resultado.status === StatusConexaoWhatsApp.CONECTADO) {
      sucesso('WhatsApp já conectado.');
      statusLocal.value = null;
    } else {
      info('Conectando…', 'Aguarde ou clique em Atualizar para obter o QR Code.');
    }
  } catch (e) {
    notificarErro(e);
  } finally {
    conectando.value = false;
  }
}

async function atualizar() {
  try {
    const atual = await refetch();
    if (atual.data) {
      statusLocal.value = atual.data.status === StatusConexaoWhatsApp.CONECTADO ? null : atual.data;
    }
  } catch (e) {
    notificarErro(e);
  }
}

async function desconectar() {
  try {
    await servicoWhatsApp.desconectar();
    statusLocal.value = null;
    sucesso('WhatsApp desconectado.');
    await refetch();
  } catch (e) {
    notificarErro(e);
  }
}

async function simular() {
  if (!simulador.telefone || !simulador.texto.trim()) return;
  simulando.value = true;
  try {
    const { conversaId } = await servicoWhatsApp.simularMensagem({ ...simulador });
    sucesso('Mensagem simulada recebida!', 'Abrindo a conversa gerada.');
    await router.push({ name: 'conversas', query: { c: conversaId } });
  } catch (e) {
    notificarErro(e);
  } finally {
    simulando.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <CabecalhoPagina titulo="Configurações" descricao="Gerencie os dados e o funcionamento da sua conta." />
    <NavConfiguracoes />

    <div class="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <MessageCircle class="size-5 text-sucesso" /> Conexão do WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div v-if="isLoading && !status"><Skeleton class="h-24 w-full" /></div>
          <template v-else>
            <div class="flex items-center justify-between rounded-md border border-borda bg-marfim/40 p-3">
              <div>
                <p class="text-sm font-medium text-texto">Status atual</p>
                <p class="text-xs text-texto-secundario">
                  Provedor: {{ status?.provedor ?? '—' }}
                  <span v-if="status?.numero"> · {{ status.numero }}</span>
                </p>
              </div>
              <BadgeStatus familia="statusWhatsapp" :valor="status?.status ?? 'DESCONECTADO'" />
            </div>

            <div
              v-if="mostrarQr"
              class="flex flex-col items-center gap-3 rounded-md border border-dashed border-borda p-6"
            >
              <img
                v-if="imagemQr"
                :src="imagemQr"
                alt="QR Code do WhatsApp"
                class="size-52 rounded-md border border-borda bg-branco p-2"
              />
              <QrCode v-else class="size-16 text-texto-secundario" />
              <p class="text-center text-sm text-texto-secundario">
                Abra o WhatsApp → Aparelhos conectados → Conectar um aparelho e escaneie este QR Code.
              </p>
              <p class="text-center text-xs text-texto-secundario">
                O status atualiza automaticamente a cada poucos segundos.
              </p>
            </div>

            <div
              v-else-if="status?.status === StatusConexaoWhatsApp.CONECTANDO"
              class="rounded-md border border-borda bg-marfim/30 p-4 text-sm text-texto-secundario"
            >
              Aguardando QR Code da Evolution… Clique em <strong>Conectar</strong> ou
              <strong>Atualizar</strong>.
            </div>

            <div class="flex flex-wrap gap-2">
              <Button v-if="!conectado" :carregando="conectando" @click="conectar">
                <Plug class="size-4" />
                {{ mostrarQr ? 'Gerar novo QR' : 'Conectar' }}
              </Button>
              <Button v-else variante="secundario" @click="desconectar">
                <PlugZap class="size-4" /> Desconectar
              </Button>
              <Button variante="contorno" @click="atualizar">
                <RefreshCw class="size-4" /> Atualizar
              </Button>
            </div>
          </template>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2"><Send class="size-5 text-info" /> Simulador de mensagem</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <p class="text-sm text-texto-secundario">
            Use o simulador para testar o fluxo do chatbot sem depender de uma conexão real.
            <span v-if="!ehMock" class="text-alerta">
              Disponível no modo de provedor <strong>MOCK</strong>.
            </span>
          </p>
          <form class="space-y-4" @submit.prevent="simular">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-1.5">
                <Label obrigatorio>Telefone do cliente</Label>
                <Input v-model="simulador.telefone" placeholder="5511999990000" />
              </div>
              <div class="space-y-1.5">
                <Label>Nome</Label>
                <Input v-model="simulador.nome" />
              </div>
            </div>
            <div class="space-y-1.5">
              <Label obrigatorio>Mensagem recebida</Label>
              <Textarea v-model="simulador.texto" :rows="3" />
            </div>
            <Button
              :carregando="simulando"
              :disabled="!ehMock || !simulador.telefone || !simulador.texto.trim()"
              @click="simular"
            >
              <Send class="size-4" /> Simular recebimento
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
