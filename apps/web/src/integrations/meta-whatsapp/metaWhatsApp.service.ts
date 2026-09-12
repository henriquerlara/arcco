import { http } from '@/services/http';
import type { MetaWhatsAppExchangeCodePayload } from './metaWhatsApp.types';

const ORIGENS_META = new Set([
  'https://www.facebook.com',
  'https://web.facebook.com',
  'https://facebook.com',
  'https://www.facebook.com/',
  'https://business.facebook.com',
  'https://business.facebook.com/',
]);

/** Origins oficiais aceitas no postMessage do Embedded Signup. */
export function originMetaValida(origin: string): boolean {
  if (!origin) return false;
  if (ORIGENS_META.has(origin)) return true;
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'facebook.com' ||
        url.hostname.endsWith('.facebook.com') ||
        url.hostname === 'meta.com' ||
        url.hostname.endsWith('.meta.com'))
    );
  } catch {
    return false;
  }
}

/**
 * Troca futura do authorization code no backend.
 * Endpoint ainda não precisa existir — a chamada fica isolada aqui.
 */
export async function trocarCodigoMetaWhatsApp(
  payload: MetaWhatsAppExchangeCodePayload,
): Promise<unknown> {
  return http.post('/integrations/meta-whatsapp/exchange-code', payload);
}

export function montarPayloadExchange(params: {
  code: string;
  configId: string;
  redirectUri?: string;
}): MetaWhatsAppExchangeCodePayload {
  return {
    code: params.code,
    configId: params.configId,
    redirectUri: params.redirectUri ?? (typeof window !== 'undefined' ? window.location.origin : undefined),
  };
}

export function logMetaDev(mensagem: string, dados?: unknown): void {
  if (!import.meta.env.DEV) return;
  if (dados === undefined) {
    console.info(`[Meta WhatsApp] ${mensagem}`);
    return;
  }
  console.info(`[Meta WhatsApp] ${mensagem}`, dados);
}
