import type { FacebookSdk, MetaWhatsAppPublicConfig } from './metaWhatsApp.types';

const SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';
const DEFAULT_GRAPH_VERSION = 'v21.0';

let carregando: Promise<FacebookSdk> | null = null;
let inicializadoComAppId: string | null = null;

export function lerConfigMetaPublica(): MetaWhatsAppPublicConfig | null {
  const appId = String(import.meta.env.VITE_META_APP_ID ?? '').trim();
  const configId = String(import.meta.env.VITE_META_WHATSAPP_CONFIG_ID ?? '').trim();
  if (!appId || !configId) return null;
  return {
    appId,
    configId,
    apiVersion: String(import.meta.env.VITE_META_GRAPH_VERSION ?? DEFAULT_GRAPH_VERSION).trim(),
  };
}

function scriptJaNoDom(): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
}

function obterFb(): FacebookSdk | null {
  return typeof window !== 'undefined' && window.FB ? window.FB : null;
}

/**
 * Carrega o Facebook JS SDK uma única vez e chama FB.init com o App ID público.
 * Nunca recebe App Secret.
 */
export function carregarMetaSdk(config: MetaWhatsAppPublicConfig): Promise<FacebookSdk> {
  const fbExistente = obterFb();
  if (fbExistente && inicializadoComAppId === config.appId) {
    return Promise.resolve(fbExistente);
  }

  if (carregando) return carregando;

  carregando = new Promise<FacebookSdk>((resolve, reject) => {
    const version = config.apiVersion || DEFAULT_GRAPH_VERSION;

    const concluirInit = () => {
      const fb = obterFb();
      if (!fb) {
        carregando = null;
        reject(new Error('Facebook SDK carregado, mas window.FB está indisponível.'));
        return;
      }
      try {
        fb.init({
          appId: config.appId,
          cookie: true,
          xfbml: false,
          version,
        });
        inicializadoComAppId = config.appId;
        resolve(fb);
      } catch (erro) {
        carregando = null;
        reject(erro instanceof Error ? erro : new Error('Falha ao inicializar FB.init'));
      }
    };

    if (obterFb()) {
      concluirInit();
      return;
    }

    const anterior = window.fbAsyncInit;
    window.fbAsyncInit = () => {
      try {
        anterior?.();
      } catch {
        /* ignora init anterior com falha */
      }
      concluirInit();
    };

    if (scriptJaNoDom()) {
      // Script já no DOM — espera fbAsyncInit ou FB pronto.
      const prazo = window.setTimeout(() => {
        if (obterFb()) concluirInit();
        else {
          carregando = null;
          reject(new Error('Timeout aguardando o Facebook SDK.'));
        }
      }, 12_000);
      const checar = window.setInterval(() => {
        if (obterFb()) {
          window.clearInterval(checar);
          window.clearTimeout(prazo);
          concluirInit();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      carregando = null;
      reject(new Error('Não foi possível carregar o Facebook SDK.'));
    };
    document.body.appendChild(script);
  });

  return carregando;
}
