/** Tipos públicos da integração Meta WhatsApp Cloud API (frontend). */

export type MetaWhatsAppUiState =
  | 'idle'
  | 'loading_sdk'
  | 'ready'
  | 'opening_meta'
  | 'onboarding'
  | 'success'
  | 'cancelled'
  | 'error';

export type MetaWhatsAppConnectionStatus =
  | 'disconnected'
  | 'pending'
  | 'connected'
  | 'error';

export type MetaWhatsAppConnectionMode = 'coexistence' | 'cloud_api_only';

/** Conexão futura por tenant — preparada para multiempresa. */
export interface MetaWhatsAppConnection {
  tenantId?: string;
  businessId?: string;
  wabaId?: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  status: MetaWhatsAppConnectionStatus;
  connectionMode?: MetaWhatsAppConnectionMode;
}

export interface MetaWhatsAppPublicConfig {
  appId: string;
  configId: string;
  apiVersion?: string;
}

/** Payload preparado para o backend trocar o code por token. */
export interface MetaWhatsAppExchangeCodePayload {
  code: string;
  redirectUri?: string;
  configId: string;
}

export type MetaEmbeddedSignupEventName =
  | 'FINISH'
  | 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
  | 'CANCEL'
  | 'ERROR'
  | string;

export interface MetaEmbeddedSignupPayload {
  event?: MetaEmbeddedSignupEventName;
  type?: string;
  data?: {
    phone_number_id?: string;
    waba_id?: string;
    business_id?: string;
    current_step?: string;
    error_message?: string;
    error_id?: string;
    [chave: string]: unknown;
  };
  /** Campos soltos que a Meta às vezes envia no root. */
  phone_number_id?: string;
  waba_id?: string;
  business_id?: string;
  status?: string;
  error?: unknown;
  [chave: string]: unknown;
}

export interface MetaLoginAuthResponse {
  code?: string;
  accessToken?: string;
  userID?: string;
  expiresIn?: number;
  signedRequest?: string;
  graphDomain?: string;
  data_access_expiration_time?: number;
}

export interface MetaLoginResponse {
  status: 'connected' | 'not_authorized' | 'unknown' | string;
  authResponse?: MetaLoginAuthResponse | null;
}

export interface MetaWhatsAppSessionDraft {
  authorizationCode?: string;
  exchangePayload?: MetaWhatsAppExchangeCodePayload;
  embeddedEvents: MetaEmbeddedSignupPayload[];
  lastEvent?: MetaEmbeddedSignupPayload | null;
  connection: MetaWhatsAppConnection;
  rawLoginResponse?: MetaLoginResponse | null;
  updatedAt: string;
}

/** Tipagem mínima do Facebook JS SDK usada neste fluxo. */
export interface FacebookSdk {
  init: (params: {
    appId: string;
    cookie?: boolean;
    xfbml?: boolean;
    version: string;
  }) => void;
  login: (
    callback: (response: MetaLoginResponse) => void,
    options?: Record<string, unknown>,
  ) => void;
  getLoginStatus?: (callback: (response: MetaLoginResponse) => void) => void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

export {};
