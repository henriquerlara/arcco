/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_NAME: string;
  /** Meta App ID público (Embedded Signup). Nunca colocar App Secret aqui. */
  readonly VITE_META_APP_ID?: string;
  /** Config ID do WhatsApp Embedded Signup (Meta Developers). */
  readonly VITE_META_WHATSAPP_CONFIG_ID?: string;
  /** Versão da Graph API para FB.init (opcional, padrão v21.0). */
  readonly VITE_META_GRAPH_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}
