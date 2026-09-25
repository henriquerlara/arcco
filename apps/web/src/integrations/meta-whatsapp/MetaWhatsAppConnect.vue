<script setup lang="ts">
import { computed } from 'vue';
import { BadgeCheck, Loader2, Plug, RefreshCw, ShieldAlert } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import { useMetaWhatsApp } from './useMetaWhatsApp';
import type { MetaWhatsAppUiState } from './metaWhatsApp.types';

const {
  uiState,
  mensagem,
  erro,
  sessao,
  configurado,
  podeConectar,
  conectarWhatsAppBusiness,
  prepararSdk,
  reiniciar,
} = useMetaWhatsApp();

const rotuloEstado: Record<MetaWhatsAppUiState, string> = {
  idle: 'Aguardando',
  loading_sdk: 'Carregando SDK',
  ready: 'Pronto',
  opening_meta: 'Abrindo Meta',
  onboarding: 'Onboarding',
  success: 'Autorizado',
  cancelled: 'Cancelado',
  error: 'Erro',
};

const varianteBadge = computed(() => {
  switch (uiState.value) {
    case 'success':
      return 'sucesso' as const;
    case 'error':
      return 'erro' as const;
    case 'cancelled':
      return 'alerta' as const;
    case 'onboarding':
    case 'opening_meta':
    case 'loading_sdk':
      return 'info' as const;
    default:
      return 'neutro' as const;
  }
});

const carregandoAcao = computed(
  () =>
    uiState.value === 'loading_sdk' ||
    uiState.value === 'opening_meta' ||
    uiState.value === 'onboarding',
);

const debugVisivel = computed(() => import.meta.env.DEV);

const debugSeguro = computed(() => {
  const s = sessao.value;
  return {
    uiState: uiState.value,
    connection: s.connection,
    lastEvent: s.lastEvent,
    eventos: s.embeddedEvents.length,
    temCode: Boolean(s.authorizationCode),
    exchangePayload: s.exchangePayload
      ? {
          ...s.exchangePayload,
          code: s.exchangePayload.code
            ? `${s.exchangePayload.code.slice(0, 8)}…`
            : undefined,
        }
      : null,
    loginStatus: s.rawLoginResponse?.status ?? null,
  };
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-start justify-between gap-3 rounded-md border border-borda bg-marfim/40 p-3">
      <div class="min-w-0">
        <p class="text-sm font-medium text-texto">Meta WhatsApp Cloud API</p>
        <p class="mt-0.5 text-xs text-texto-secundario">
          Provedor oficial · modo Coexistence (WhatsApp Business App)
        </p>
        <p class="mt-2 text-sm text-texto-secundario">{{ mensagem }}</p>
        <p v-if="erro && uiState === 'error'" class="mt-1 text-xs text-erro">{{ erro }}</p>
      </div>
      <Badge :variante="varianteBadge">{{ rotuloEstado[uiState] }}</Badge>
    </div>

    <p class="text-xs leading-relaxed text-texto-secundario">
      Este fluxo usa o Embedded Signup com
      <code class="rounded bg-marfim px-1 py-0.5 text-[11px]">whatsapp_business_app_onboarding</code>
      para números que já estão no WhatsApp Business App.
    </p>

    <div
      v-if="!configurado"
      class="flex items-start gap-2 rounded-md border border-alerta/30 bg-alerta/10 px-3 py-2 text-xs text-alerta"
    >
      <ShieldAlert class="mt-0.5 size-4 shrink-0" />
      <span>
        Defina <strong>VITE_META_APP_ID</strong> e
        <strong>VITE_META_WHATSAPP_CONFIG_ID</strong> no ambiente do frontend.
      </span>
    </div>

    <div class="flex flex-wrap gap-2">
      <Button
        :disabled="!podeConectar || !configurado"
        :carregando="carregandoAcao"
        @click="conectarWhatsAppBusiness"
      >
        <Plug class="size-4" />
        Conectar WhatsApp Business
      </Button>
      <Button variante="contorno" :disabled="carregandoAcao" @click="prepararSdk">
        <RefreshCw class="size-4" /> Recarregar SDK
      </Button>
      <Button
        v-if="uiState === 'success' || uiState === 'cancelled' || uiState === 'error'"
        variante="secundario"
        @click="reiniciar"
      >
        Reiniciar
      </Button>
    </div>

    <div
      v-if="uiState === 'success'"
      class="flex items-center gap-2 rounded-md border border-sucesso/30 bg-sucesso/10 px-3 py-2 text-sm text-sucesso"
    >
      <BadgeCheck class="size-4 shrink-0" />
      Conexão autorizada. O authorization code ficou em memória para o backend.
    </div>

    <div
      v-else-if="carregandoAcao"
      class="flex items-center gap-2 text-sm text-texto-secundario"
    >
      <Loader2 class="size-4 animate-spin" />
      {{ mensagem }}
    </div>

    <details v-if="debugVisivel" class="rounded-md border border-borda/80 bg-branco p-3">
      <summary class="cursor-pointer select-none text-xs font-medium text-texto-secundario">
        Debug Meta (somente desenvolvimento)
      </summary>
      <pre class="mt-2 max-h-64 overflow-auto text-[11px] leading-relaxed text-texto-secundario">{{
        JSON.stringify(debugSeguro, null, 2)
      }}</pre>
    </details>
  </div>
</template>
