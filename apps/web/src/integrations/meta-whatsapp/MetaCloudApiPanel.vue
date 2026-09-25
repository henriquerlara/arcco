<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { useRouter } from 'vue-router';
import { FileText, Plug, Send, Webhook } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Dialog from '@/components/ui/Dialog.vue';
import { servicoMetaWhatsApp } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';

const router = useRouter();
const queryClient = useQueryClient();
const { notificarErro, sucesso, info } = useNotificacao();

const enviandoTeste = ref(false);
const enviandoTexto = ref(false);
const salvandoTemplate = ref(false);
const modalTemplates = ref(false);
const modalNovoTemplate = ref(false);
const textoLivre = ref('Teste enviado pelo ARCCO');

const formTemplate = reactive({
  name: 'arcco_utilidade_teste',
  language: 'pt_BR',
  category: 'UTILITY',
  body: 'Olá! Esta é uma mensagem de utilidade enviada pelo ARCCO.',
});

const { data: status, isLoading, refetch } = useQuery({
  queryKey: ['meta-whatsapp-status'],
  queryFn: () => servicoMetaWhatsApp.status(),
});

const { data: templates, refetch: refetchTemplates } = useQuery({
  queryKey: ['meta-whatsapp-templates'],
  queryFn: () => servicoMetaWhatsApp.listarTemplates(),
  enabled: computed(() => modalTemplates.value && Boolean(status.value?.configurado)),
});

const webhookBadge = computed(() => {
  const s = status.value?.webhook?.status;
  if (s === 'configurado') return { variante: 'sucesso' as const, rotulo: 'Configurado' };
  if (s === 'erro') return { variante: 'erro' as const, rotulo: 'Erro' };
  if (s === 'aguardando') return { variante: 'alerta' as const, rotulo: 'Aguardando evento' };
  return { variante: 'neutro' as const, rotulo: 'Não configurado' };
});

async function garantirConexao() {
  try {
    await servicoMetaWhatsApp.ensureConnection();
    sucesso('Conexão Meta de teste pronta.');
    await refetch();
  } catch (e) {
    notificarErro(e);
  }
}

async function enviarHelloWorld() {
  enviandoTeste.value = true;
  try {
    const r = await servicoMetaWhatsApp.enviarTeste({ templateName: 'hello_world', languageCode: 'en_US' });
    sucesso('Template hello_world enviado pelo número de teste da Meta.');
    info('Conversa aberta', 'Você pode responder no WhatsApp do destinatário e ver a mensagem entrar no ARCCO.');
    await queryClient.invalidateQueries({ queryKey: ['conversas'] });
    if (r.conversaId) {
      await router.push({ name: 'conversas', query: { c: r.conversaId } });
    }
  } catch (e) {
    notificarErro(e);
  } finally {
    enviandoTeste.value = false;
  }
}

async function enviarTextoLivre() {
  if (!textoLivre.value.trim()) return;
  enviandoTexto.value = true;
  try {
    await servicoMetaWhatsApp.enviarTexto({ texto: textoLivre.value.trim() });
    sucesso('Texto enviado (janela de 24h).');
    await refetch();
  } catch (e) {
    notificarErro(e);
  } finally {
    enviandoTexto.value = false;
  }
}

async function abrirTemplates() {
  modalTemplates.value = true;
  await refetchTemplates();
}

async function criarTemplate() {
  salvandoTemplate.value = true;
  try {
    await servicoMetaWhatsApp.criarTemplate({ ...formTemplate });
    sucesso('Template enviado para análise da Meta.');
    modalNovoTemplate.value = false;
    await refetchTemplates();
  } catch (e) {
    notificarErro(e);
  } finally {
    salvandoTemplate.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-start justify-between gap-3 rounded-md border border-borda bg-marfim/40 p-3">
      <div class="min-w-0 space-y-1">
        <p class="text-sm font-medium text-texto">WhatsApp Oficial · Cloud API (teste)</p>
        <p class="text-xs text-texto-secundario">
          Provider Meta · modo Cloud API · remetente = número de teste da Meta
        </p>
        <p v-if="status?.configurado" class="text-xs text-texto-secundario">
          Número:
          <span class="font-medium text-texto">{{ status.displayPhoneNumber || '—' }}</span>
          · WABA
          <span class="font-medium text-texto">{{ status.wabaId || '—' }}</span>
        </p>
        <p v-if="status?.testRecipient" class="text-xs text-texto-secundario">
          Destinatário de teste autorizado:
          <span class="font-medium text-texto">{{ status.testRecipient }}</span>
        </p>
      </div>
      <Badge :variante="status?.configurado ? 'sucesso' : 'alerta'">
        {{ status?.configurado ? 'Conectado (teste)' : 'Não configurado' }}
      </Badge>
    </div>

    <div v-if="isLoading" class="text-sm text-texto-secundario">Carregando status Meta…</div>

    <div
      v-else-if="!status?.configurado"
      class="rounded-md border border-alerta/30 bg-alerta/10 px-3 py-2 text-xs text-alerta"
    >
      Configure no backend:
      <code class="mx-0.5">META_WHATSAPP_ACCESS_TOKEN</code>,
      <code class="mx-0.5">PHONE_NUMBER_ID</code>,
      <code class="mx-0.5">WABA_ID</code> e
      <code class="mx-0.5">TEST_RECIPIENT</code>.
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-2 text-xs text-texto-secundario">
        <Webhook class="size-3.5" />
        Webhook:
        <Badge :variante="webhookBadge.variante">{{ webhookBadge.rotulo }}</Badge>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button variante="contorno" tamanho="sm" @click="garantirConexao">
          <Plug class="size-4" /> Ativar conexão teste
        </Button>
        <Button tamanho="sm" :carregando="enviandoTeste" @click="enviarHelloWorld">
          <Send class="size-4" /> Enviar mensagem de teste
        </Button>
        <Button variante="contorno" tamanho="sm" @click="abrirTemplates">
          <FileText class="size-4" /> Ver templates
        </Button>
        <Button variante="contorno" tamanho="sm" @click="refetch()">
          Atualizar status
        </Button>
      </div>

      <div class="space-y-2 rounded-md border border-borda p-3">
        <Label>Texto livre (só após janela de 24h / resposta do cliente)</Label>
        <Textarea v-model="textoLivre" :rows="2" />
        <Button
          variante="secundario"
          tamanho="sm"
          :carregando="enviandoTexto"
          @click="enviarTextoLivre"
        >
          Enviar texto
        </Button>
      </div>
    </template>

    <p class="text-xs leading-relaxed text-texto-secundario">
      O Embedded Signup / Coexistence continua disponível abaixo para o futuro. Nesta etapa o envio
      real usa System User Token + número de teste da Meta (Cloud API).
    </p>

    <Dialog v-model="modalTemplates" titulo="Templates da WABA" tamanho="lg">
      <div class="space-y-3">
        <div class="flex justify-end">
          <Button tamanho="sm" @click="modalNovoTemplate = true">Novo template</Button>
        </div>
        <ul v-if="templates?.length" class="divide-y divide-borda rounded-md border border-borda">
          <li
            v-for="t in templates"
            :key="t.id"
            class="flex items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <div>
              <p class="font-medium text-texto">{{ t.name }}</p>
              <p class="text-xs text-texto-secundario">
                {{ t.language }} · {{ t.category }}
              </p>
            </div>
            <Badge variante="neutro">{{ t.status }}</Badge>
          </li>
        </ul>
        <p v-else class="text-sm text-texto-secundario">Nenhum template retornado.</p>
      </div>
    </Dialog>

    <Dialog v-model="modalNovoTemplate" titulo="Criar template">
      <form class="space-y-3" @submit.prevent="criarTemplate">
        <div class="space-y-1.5">
          <Label obrigatorio>Nome</Label>
          <Input v-model="formTemplate.name" placeholder="arcco_utilidade_teste" />
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label>Idioma</Label>
            <Input v-model="formTemplate.language" />
          </div>
          <div class="space-y-1.5">
            <Label>Categoria</Label>
            <Input v-model="formTemplate.category" />
          </div>
        </div>
        <div class="space-y-1.5">
          <Label obrigatorio>Corpo</Label>
          <Textarea v-model="formTemplate.body" :rows="3" />
        </div>
        <div class="flex justify-end gap-2">
          <Button variante="secundario" type="button" @click="modalNovoTemplate = false">
            Cancelar
          </Button>
          <Button type="submit" :carregando="salvandoTemplate">Enviar para Meta</Button>
        </div>
      </form>
    </Dialog>
  </div>
</template>
