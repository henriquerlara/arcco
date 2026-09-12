import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { carregarMetaSdk, lerConfigMetaPublica } from './metaWhatsApp.sdk';
import {
  logMetaDev,
  montarPayloadExchange,
  originMetaValida,
  trocarCodigoMetaWhatsApp,
} from './metaWhatsApp.service';
import type {
  MetaEmbeddedSignupPayload,
  MetaLoginResponse,
  MetaWhatsAppConnection,
  MetaWhatsAppPublicConfig,
  MetaWhatsAppSessionDraft,
  MetaWhatsAppUiState,
} from './metaWhatsApp.types';

function conexaoVazia(): MetaWhatsAppConnection {
  return {
    status: 'disconnected',
    connectionMode: 'coexistence',
  };
}

function parsearPayloadMessage(data: unknown): MetaEmbeddedSignupPayload | null {
  if (data == null) return null;
  if (typeof data === 'object') return data as MetaEmbeddedSignupPayload;
  if (typeof data !== 'string') return null;
  try {
    return JSON.parse(data) as MetaEmbeddedSignupPayload;
  } catch {
    // Alguns embeds mandam string "WA_EMBEDDED_SIGNUP:..."
    const indice = data.indexOf('{');
    if (indice < 0) return null;
    try {
      return JSON.parse(data.slice(indice)) as MetaEmbeddedSignupPayload;
    } catch {
      return null;
    }
  }
}

function extrairIds(payload: MetaEmbeddedSignupPayload): Partial<MetaWhatsAppConnection> {
  const data = payload.data ?? {};
  return {
    phoneNumberId:
      (data.phone_number_id as string | undefined) ??
      (payload.phone_number_id as string | undefined),
    wabaId: (data.waba_id as string | undefined) ?? (payload.waba_id as string | undefined),
    businessId:
      (data.business_id as string | undefined) ?? (payload.business_id as string | undefined),
  };
}

function eventoFinalizaOnboarding(payload: MetaEmbeddedSignupPayload): boolean {
  const evento = String(payload.event ?? payload.type ?? '').toUpperCase();
  return (
    evento === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' ||
    evento === 'FINISH' ||
    evento.includes('FINISH_WHATSAPP_BUSINESS_APP')
  );
}

function eventoCancelado(payload: MetaEmbeddedSignupPayload): boolean {
  const evento = String(payload.event ?? payload.type ?? '').toUpperCase();
  return evento === 'CANCEL' || evento.includes('CANCEL');
}

function eventoErro(payload: MetaEmbeddedSignupPayload): boolean {
  const evento = String(payload.event ?? payload.type ?? '').toUpperCase();
  return Boolean(payload.error) || evento === 'ERROR' || evento.includes('ERROR');
}

/**
 * Onboarding Meta WhatsApp Business App (coexistence) — isolado da Evolution.
 */
export function useMetaWhatsApp() {
  const config = shallowRef<MetaWhatsAppPublicConfig | null>(lerConfigMetaPublica());
  const uiState = ref<MetaWhatsAppUiState>(config.value ? 'idle' : 'error');
  const mensagem = ref(
    config.value
      ? 'Pronto para conectar com a Meta.'
      : 'Configure VITE_META_APP_ID e VITE_META_WHATSAPP_CONFIG_ID para habilitar a Meta.',
  );
  const erro = ref<string | null>(config.value ? null : mensagem.value);

  /** Code em memória apenas durante o fluxo — nunca localStorage. */
  const authorizationCode = ref<string | null>(null);

  const sessao = ref<MetaWhatsAppSessionDraft>({
    embeddedEvents: [],
    lastEvent: null,
    connection: conexaoVazia(),
    rawLoginResponse: null,
    updatedAt: new Date().toISOString(),
  });

  const configurado = computed(() => Boolean(config.value?.appId && config.value?.configId));
  const podeConectar = computed(
    () =>
      configurado.value &&
      (uiState.value === 'ready' ||
        uiState.value === 'idle' ||
        uiState.value === 'cancelled' ||
        uiState.value === 'error' ||
        uiState.value === 'success'),
  );

  function atualizarSessao(parcial: Partial<MetaWhatsAppSessionDraft>) {
    sessao.value = {
      ...sessao.value,
      ...parcial,
      updatedAt: new Date().toISOString(),
    };
  }

  function aoMessage(evento: MessageEvent) {
    if (!originMetaValida(evento.origin)) return;

    const payload = parsearPayloadMessage(evento.data);
    if (!payload) return;

    // Ignora ruído sem event/type conhecíveis do signup
    const temSinal =
      payload.event ||
      payload.type ||
      payload.data ||
      payload.waba_id ||
      payload.phone_number_id ||
      payload.business_id;
    if (!temSinal) return;

    logMetaDev('postMessage Embedded Signup', { origin: evento.origin, payload });

    const ids = extrairIds(payload);
    const eventos = [...sessao.value.embeddedEvents, payload];
    const connection: MetaWhatsAppConnection = {
      ...sessao.value.connection,
      ...ids,
      connectionMode: 'coexistence',
      status: sessao.value.connection.status === 'connected' ? 'connected' : 'pending',
    };

    atualizarSessao({
      embeddedEvents: eventos,
      lastEvent: payload,
      connection,
    });

    if (eventoErro(payload)) {
      uiState.value = 'error';
      const msgErro =
        (payload.data?.error_message as string | undefined) ||
        (typeof payload.error === 'string' ? payload.error : null) ||
        'A Meta retornou um erro no Embedded Signup.';
      erro.value = msgErro;
      mensagem.value = 'Não foi possível concluir a integração.';
      connection.status = 'error';
      atualizarSessao({ connection });
      return;
    }

    if (eventoCancelado(payload)) {
      uiState.value = 'cancelled';
      mensagem.value = 'Cadastro cancelado.';
      authorizationCode.value = null;
      return;
    }

    if (eventoFinalizaOnboarding(payload)) {
      uiState.value = authorizationCode.value ? 'success' : 'onboarding';
      mensagem.value = authorizationCode.value
        ? 'Conexão autorizada. Dados prontos para o backend.'
        : 'Onboarding Meta finalizado. Aguardando authorization code…';
      connection.status = authorizationCode.value ? 'connected' : 'pending';
      atualizarSessao({ connection });
    } else {
      uiState.value = 'onboarding';
      mensagem.value = 'Conectando à Meta…';
    }
  }

  async function prepararSdk() {
    config.value = lerConfigMetaPublica();
    if (!config.value) {
      uiState.value = 'error';
      erro.value = 'Variáveis VITE_META_APP_ID / VITE_META_WHATSAPP_CONFIG_ID ausentes.';
      mensagem.value = erro.value;
      return;
    }

    uiState.value = 'loading_sdk';
    mensagem.value = 'Carregando SDK da Meta…';
    erro.value = null;

    try {
      await carregarMetaSdk(config.value);
      uiState.value = 'ready';
      mensagem.value = 'Pronto para conectar com a Meta.';
      logMetaDev('SDK pronto', { appId: config.value.appId, configId: config.value.configId });
    } catch (e) {
      uiState.value = 'error';
      erro.value = e instanceof Error ? e.message : 'Falha ao carregar o SDK da Meta.';
      mensagem.value = 'Não foi possível iniciar a integração.';
      logMetaDev('Falha SDK', erro.value);
    }
  }

  function processarLogin(response: MetaLoginResponse) {
    logMetaDev('FB.login response', response);
    atualizarSessao({ rawLoginResponse: response });

    if (response.status !== 'connected' || !response.authResponse) {
      uiState.value = 'cancelled';
      mensagem.value = 'Cadastro cancelado.';
      authorizationCode.value = null;
      return;
    }

    const code = response.authResponse.code;
    if (!code) {
      // Pode vir accessToken em fluxos errados — não persistimos token.
      uiState.value = 'error';
      erro.value =
        'A Meta não retornou authorization code (response_type=code). Verifique o Embedded Signup / config_id.';
      mensagem.value = 'Não foi possível iniciar a integração.';
      logMetaDev('Resposta sem code', response.authResponse);
      return;
    }

    if (!config.value) return;

    authorizationCode.value = code;
    const exchangePayload = montarPayloadExchange({
      code,
      configId: config.value.configId,
    });

    atualizarSessao({
      authorizationCode: code,
      exchangePayload,
      connection: {
        ...sessao.value.connection,
        status: 'pending',
        connectionMode: 'coexistence',
      },
    });

    uiState.value = 'success';
    mensagem.value = 'Conexão autorizada.';
    logMetaDev('Authorization code capturado (somente memória)', {
      codePreview: `${code.slice(0, 8)}…`,
      exchangePayload: { ...exchangePayload, code: `${code.slice(0, 8)}…` },
    });
  }

  async function conectarWhatsAppBusiness() {
    if (!config.value) {
      await prepararSdk();
      if (!config.value) return;
    }

    try {
      uiState.value = 'opening_meta';
      mensagem.value = 'Abrindo o fluxo oficial da Meta…';
      erro.value = null;
      authorizationCode.value = null;

      const fb = await carregarMetaSdk(config.value);

      fb.login(processarLogin, {
        config_id: config.value.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      });

      uiState.value = 'onboarding';
      mensagem.value = 'Conectando à Meta…';
    } catch (e) {
      uiState.value = 'error';
      erro.value = e instanceof Error ? e.message : 'Falha ao abrir FB.login';
      mensagem.value = 'Não foi possível iniciar a integração.';
      logMetaDev('Erro ao abrir login', erro.value);
    }
  }

  /**
   * Envio opcional ao backend quando o endpoint existir.
   * Não é chamado automaticamente nesta etapa.
   */
  async function enviarCodigoAoBackend(): Promise<boolean> {
    const payload = sessao.value.exchangePayload;
    if (!payload?.code) {
      erro.value = 'Não há authorization code para enviar.';
      return false;
    }
    try {
      await trocarCodigoMetaWhatsApp(payload);
      mensagem.value = 'Código enviado ao backend.';
      sessao.value.connection = { ...sessao.value.connection, status: 'connected' };
      return true;
    } catch (e) {
      // Endpoint pode ainda não existir — esperado nesta etapa.
      const msg = e instanceof Error ? e.message : 'Falha ao chamar o backend';
      logMetaDev('exchange-code (pendente no backend)', msg);
      erro.value = msg;
      return false;
    }
  }

  function reiniciar() {
    authorizationCode.value = null;
    atualizarSessao({
      authorizationCode: undefined,
      exchangePayload: undefined,
      embeddedEvents: [],
      lastEvent: null,
      rawLoginResponse: null,
      connection: conexaoVazia(),
    });
    erro.value = null;
    uiState.value = configurado.value ? 'ready' : 'error';
    mensagem.value = configurado.value
      ? 'Pronto para conectar com a Meta.'
      : 'Configure as variáveis da Meta.';
  }

  onMounted(() => {
    window.addEventListener('message', aoMessage);
    void prepararSdk();
  });

  onUnmounted(() => {
    window.removeEventListener('message', aoMessage);
    authorizationCode.value = null;
  });

  return {
    config,
    uiState,
    mensagem,
    erro,
    sessao,
    authorizationCode,
    configurado,
    podeConectar,
    prepararSdk,
    conectarWhatsAppBusiness,
    enviarCodigoAoBackend,
    reiniciar,
  };
}
