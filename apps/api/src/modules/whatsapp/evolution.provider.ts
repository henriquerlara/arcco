import { Injectable, Logger } from '@nestjs/common';
import { StatusConexaoWhatsApp } from '@arcco/contratos';
import { carregarEnv } from '../../config/env';
import type {
  EnvioResultado,
  OpcoesEnvioTexto,
  ResultadoConexao,
  WhatsAppProvider,
} from './whatsapp.provider';

/**
 * Integração com a Evolution API (WhatsApp). Chamadas HTTP diretas via fetch.
 */
@Injectable()
export class EvolutionWhatsAppProvider implements WhatsAppProvider {
  readonly nome = 'evolution';
  private readonly logger = new Logger('WhatsAppEvolution');
  private readonly env = carregarEnv();

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      apikey: this.env.EVOLUTION_API_KEY,
    };
  }

  private url(caminho: string): string {
    return `${this.env.EVOLUTION_API_URL.replace(/\/$/, '')}${caminho}`;
  }

  private async request<T>(
    caminho: string,
    init?: RequestInit,
  ): Promise<{ ok: boolean; status: number; dados: T | null; texto: string }> {
    try {
      const resposta = await fetch(this.url(caminho), {
        ...init,
        headers: { ...this.headers(), ...(init?.headers as Record<string, string> | undefined) },
      });
      const texto = await resposta.text();
      let dados: T | null = null;
      try {
        dados = texto ? (JSON.parse(texto) as T) : null;
      } catch {
        dados = null;
      }
      return { ok: resposta.ok, status: resposta.status, dados, texto };
    } catch (erro) {
      this.logger.error(`Falha HTTP Evolution ${caminho}: ${(erro as Error).message}`);
      return { ok: false, status: 0, dados: null, texto: (erro as Error).message };
    }
  }

  /** Cria a instância na Evolution (se ainda não existir) e configura o webhook da ARCCO. */
  async garantirInstancia(nomeInstancia: string, numero?: string): Promise<void> {
    const existente = await this.request<unknown>(`/instance/connectionState/${nomeInstancia}`);
    if (!existente.ok || existente.status === 404) {
      const criar = await this.request<{ instance?: { instanceName?: string } }>(
        '/instance/create',
        {
          method: 'POST',
          body: JSON.stringify({
            instanceName: nomeInstancia,
            integration: 'WHATSAPP-BAILEYS',
            qrcode: true,
            number: numero ?? undefined,
          }),
        },
      );
      if (!criar.ok && criar.status !== 403) {
        // 403/conflict às vezes indica que já existe
        this.logger.warn(
          `Criação de instância ${nomeInstancia}: HTTP ${criar.status} ${criar.texto.slice(0, 200)}`,
        );
      }
    }

    await this.configurarWebhook(nomeInstancia);
  }

  async configurarWebhook(nomeInstancia: string): Promise<void> {
    const base = this.env.API_PUBLIC_URL.replace(/\/$/, '');
    const webhookUrl = `${base}/api/webhooks/evolution`;
    const headers: Record<string, string> = {};
    if (this.env.EVOLUTION_WEBHOOK_SECRET) {
      headers['x-webhook-secret'] = this.env.EVOLUTION_WEBHOOK_SECRET;
    }

    const resposta = await this.request(`/webhook/set/${nomeInstancia}`, {
      method: 'POST',
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          headers,
          byEvents: false,
          base64: false,
          events: [
            'MESSAGES_UPSERT',
            'CONNECTION_UPDATE',
            'QRCODE_UPDATED',
          ],
        },
      }),
    });

    if (!resposta.ok) {
      this.logger.warn(
        `Webhook ${nomeInstancia}: HTTP ${resposta.status} ${resposta.texto.slice(0, 200)}`,
      );
    } else {
      this.logger.log(`Webhook configurado para ${nomeInstancia} → ${webhookUrl}`);
    }
  }

  async enviarTexto(
    nomeInstancia: string,
    telefone: string,
    texto: string,
    _opcoes?: OpcoesEnvioTexto,
  ): Promise<EnvioResultado> {
    // Body igual Pacelia ({ number, text }). Se o cliente escreveu em @lid,
    // number DEVE ser o @lid — senão a Evolution abre outro chat (PN) e o
    // usuário não vê a resposta no fio onde digitou.
    const number = toEvolutionNumber(telefone);
    const resposta = await this.request<{ key?: { id?: string } }>(
      `/message/sendText/${encodeURIComponent(nomeInstancia)}`,
      {
        method: 'POST',
        body: JSON.stringify({ number, text: String(texto || '') }),
      },
    );
    if (!resposta.ok) {
      this.logger.error(
        `Falha ao enviar para ${number}: HTTP ${resposta.status} ${resposta.texto.slice(0, 200)}`,
      );
      return { status: 'ERRO', erro: `HTTP ${resposta.status}: ${resposta.texto.slice(0, 200)}` };
    }
    this.logger.log(
      `Mensagem aceita pela Evolution destino=${number} id=${resposta.dados?.key?.id ?? '?'}`,
    );
    return { idExterno: resposta.dados?.key?.id, status: 'ENVIADA' };
  }

  async conectar(nomeInstancia: string): Promise<ResultadoConexao> {
    await this.garantirInstancia(nomeInstancia);

    const estado = await this.statusConexao(nomeInstancia);
    if (estado.status === StatusConexaoWhatsApp.CONECTADO) {
      return estado;
    }

    const resposta = await this.request<{
      base64?: string;
      code?: string;
      qrcode?: { base64?: string };
    }>(`/instance/connect/${nomeInstancia}`, { method: 'GET' });

    if (!resposta.ok) {
      this.logger.error(`Falha ao conectar Evolution: ${resposta.texto.slice(0, 200)}`);
      return { status: StatusConexaoWhatsApp.ERRO };
    }

    const qrCode =
      resposta.dados?.base64 ??
      resposta.dados?.qrcode?.base64 ??
      resposta.dados?.code ??
      null;

    return {
      status: qrCode ? StatusConexaoWhatsApp.QR_CODE : StatusConexaoWhatsApp.CONECTANDO,
      qrCode,
    };
  }

  async desconectar(nomeInstancia: string): Promise<void> {
    // NÃO chama /instance/logout — isso apaga as keys e força QR.
    // Só encerra a conexão em memória; a sessão permanece reutilizável.
    await this.request(`/instance/connectionState/${nomeInstancia}`, { method: 'GET' });
    this.logger.warn(
      `desconectar(${nomeInstancia}): logout da Evolution desativado para preservar sessão`,
    );
  }

  async statusConexao(nomeInstancia: string): Promise<ResultadoConexao> {
    const resposta = await this.request<{
      instance?: { state?: string; ownerJid?: string; profileName?: string };
    }>(`/instance/connectionState/${nomeInstancia}`);

    if (!resposta.ok) {
      return { status: StatusConexaoWhatsApp.ERRO };
    }

    const estado = resposta.dados?.instance?.state;
    const ownerJid = resposta.dados?.instance?.ownerJid;
    const numero = ownerJid ? ownerJid.replace(/@.*/, '') : null;

    if (estado === 'open') {
      return { status: StatusConexaoWhatsApp.CONECTADO, numero };
    }
    if (estado === 'connecting') {
      return { status: StatusConexaoWhatsApp.CONECTANDO, numero };
    }
    return { status: StatusConexaoWhatsApp.DESCONECTADO, numero };
  }

  /** Busca mensagens recentes (fallback quando o webhook nao chega). */
  async buscarMensagensRecentes(nomeInstancia: string, limite = 40): Promise<
    Array<{
      key?: {
        id?: string;
        remoteJid?: string;
        remoteJidAlt?: string;
        fromMe?: boolean;
        senderPn?: string;
      };
      pushName?: string;
      message?: Record<string, unknown>;
      messageTimestamp?: number | string;
    }>
  > {
    const resposta = await this.request<{
      messages?: { records?: Array<Record<string, unknown>> };
    }>(`/chat/findMessages/${nomeInstancia}`, {
      method: 'POST',
      body: JSON.stringify({ where: {}, limit: limite }),
    });
    const records = resposta.dados?.messages?.records;
    return Array.isArray(records)
      ? (records as Array<{
          key?: {
            id?: string;
            remoteJid?: string;
            remoteJidAlt?: string;
            fromMe?: boolean;
            senderPn?: string;
          };
          pushName?: string;
          message?: Record<string, unknown>;
          messageTimestamp?: number | string;
        }>)
      : [];
  }
}

/**
 * Destino Evolution: se for @lid, mantém (mesmo chat do cliente).
 * Caso contrário, só dígitos (como Pacelia `toEvolutionNumber`).
 */
function toEvolutionNumber(phone: string): string {
  const bruto = String(phone || '').trim().replace(/^whatsapp:/i, '');
  if (bruto.includes('@lid')) return bruto;
  const raw = bruto.replace(/@.*/, '');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;
  if (digits.length >= 12 && digits.startsWith('55')) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
}
