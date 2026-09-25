import { Injectable, Logger } from '@nestjs/common';
import { carregarEnv } from '../../config/env';
import { Erros } from '../../common/erros/erros';

export interface MetaGraphErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
    error_data?: { details?: string };
  };
}

export interface MetaSendMessageResponse {
  messaging_product?: string;
  contacts?: Array<{ input?: string; wa_id?: string }>;
  messages?: Array<{ id: string; message_status?: string }>;
}

export interface MetaTemplateItem {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
}

@Injectable()
export class MetaGraphClient {
  private readonly logger = new Logger('MetaGraph');
  private readonly env = carregarEnv();

  configurado(): boolean {
    return Boolean(
      this.env.META_WHATSAPP_ACCESS_TOKEN &&
        this.env.META_WHATSAPP_PHONE_NUMBER_ID &&
        this.env.META_WHATSAPP_WABA_ID,
    );
  }

  phoneNumberId(): string {
    return this.env.META_WHATSAPP_PHONE_NUMBER_ID;
  }

  wabaId(): string {
    return this.env.META_WHATSAPP_WABA_ID;
  }

  testRecipient(): string {
    return this.env.META_WHATSAPP_TEST_RECIPIENT.replace(/\D/g, '');
  }

  displayPhone(): string {
    return this.env.META_WHATSAPP_DISPLAY_PHONE || this.env.META_WHATSAPP_PHONE_NUMBER_ID;
  }

  verifyToken(): string {
    return this.env.META_WHATSAPP_VERIFY_TOKEN;
  }

  private baseUrl(): string {
    const versao = this.env.META_GRAPH_API_VERSION || 'v26.0';
    return `https://graph.facebook.com/${versao}`;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.env.META_WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    };
  }

  /** Nunca loga o token. */
  private logErro(contexto: string, status: number, body: MetaGraphErrorBody) {
    const err = body.error;
    this.logger.error(
      `${contexto} status=${status} code=${err?.code ?? '?'} type=${err?.type ?? '?'} msg=${err?.message ?? 'sem mensagem'}`,
    );
  }

  mapearErroGraph(status: number, body: MetaGraphErrorBody): never {
    const err = body.error;
    const code = err?.code;
    const msg = err?.message ?? 'Erro na Graph API';
    const detalhes = err?.error_data?.details;

    if (code === 190) {
      throw Erros.naoAutenticado('Token Meta inválido ou expirado');
    }
    if (code === 131030 || code === 133010) {
      throw Erros.invalido(
        'META_DESTINATARIO_NAO_AUTORIZADO',
        'Destinatário não autorizado no ambiente de teste da Meta',
      );
    }
    if (code === 131047) {
      throw Erros.invalido(
        'META_JANELA_24H',
        'Fora da janela de 24h. Use um template aprovado para iniciar a conversa.',
      );
    }
    if (code === 132000 || code === 132001 || code === 132005 || code === 132007) {
      throw Erros.invalido('META_TEMPLATE_INVALIDO', detalhes || msg);
    }
    if (code === 4 || code === 80007 || status === 429) {
      throw Erros.conflito('META_RATE_LIMIT', 'Limite de requisições da Meta atingido. Tente em breve.');
    }
    if (code === 100) {
      throw Erros.invalido('META_PARAMETRO_INVALIDO', detalhes || msg);
    }
    throw Erros.invalido('META_GRAPH_ERRO', detalhes || msg);
  }

  async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (!this.env.META_WHATSAPP_ACCESS_TOKEN) {
      throw Erros.invalido('META_NAO_CONFIGURADA', 'META_WHATSAPP_ACCESS_TOKEN não configurado');
    }

    const url = `${this.baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
    this.logger.log(`Meta request ${method} ${path}`);

    const res = await fetch(url, {
      method,
      headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as T & MetaGraphErrorBody;

    if (!res.ok || (json as MetaGraphErrorBody).error) {
      this.logErro(`${method} ${path}`, res.status, json as MetaGraphErrorBody);
      this.mapearErroGraph(res.status, json as MetaGraphErrorBody);
    }

    this.logger.log(`Meta response ${method} ${path} ok`);
    return json;
  }

  async enviarMensagem(payload: Record<string, unknown>): Promise<MetaSendMessageResponse> {
    const phoneId = this.phoneNumberId();
    if (!phoneId) {
      throw Erros.invalido('META_PHONE_ID_AUSENTE', 'META_WHATSAPP_PHONE_NUMBER_ID não configurado');
    }
    return this.request<MetaSendMessageResponse>('POST', `/${phoneId}/messages`, payload);
  }

  async listarTemplates(): Promise<MetaTemplateItem[]> {
    const waba = this.wabaId();
    if (!waba) {
      throw Erros.invalido('META_WABA_AUSENTE', 'META_WHATSAPP_WABA_ID não configurado');
    }
    const data = await this.request<{
      data?: Array<{
        id: string;
        name: string;
        language: string;
        category: string;
        status: string;
      }>;
    }>('GET', `/${waba}/message_templates?limit=100`);

    return (data.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
    }));
  }

  async criarTemplate(entrada: {
    name: string;
    language: string;
    category: string;
    body: string;
  }) {
    const waba = this.wabaId();
    if (!waba) {
      throw Erros.invalido('META_WABA_AUSENTE', 'META_WHATSAPP_WABA_ID não configurado');
    }
    return this.request('POST', `/${waba}/message_templates`, {
      name: entrada.name,
      language: entrada.language,
      category: entrada.category,
      components: [
        {
          type: 'BODY',
          text: entrada.body,
        },
      ],
    });
  }

  async subscribeApp(): Promise<{ success?: boolean }> {
    const waba = this.wabaId();
    if (!waba) {
      throw Erros.invalido('META_WABA_AUSENTE', 'META_WHATSAPP_WABA_ID não configurado');
    }
    return this.request<{ success?: boolean }>('POST', `/${waba}/subscribed_apps`);
  }
}
