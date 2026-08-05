import { Body, Controller, Headers, Logger, Post, Query } from '@nestjs/common';
import { carregarEnv } from '../../config/env';
import { Publico } from '../../common/decorators/publico.decorator';
import { Erros } from '../../common/erros/erros';
import { WhatsAppService } from './whatsapp.service';

interface PayloadEvolution {
  event?: string;
  instance?: string;
  data?: Record<string, unknown> | Record<string, unknown>[];
}

@Controller('webhooks')
export class WebhookController {
  private readonly env = carregarEnv();
  private readonly logger = new Logger('WebhookEvolution');

  constructor(private readonly servico: WhatsAppService) {}

  @Publico()
  @Post('evolution')
  async evolution(
    @Body() payload: PayloadEvolution,
    @Headers('x-webhook-secret') segredoHeader?: string,
    @Query('secret') segredoQuery?: string,
  ) {
    const segredo = segredoHeader ?? segredoQuery;
    if (
      this.env.EVOLUTION_WEBHOOK_SECRET &&
      segredo &&
      segredo !== this.env.EVOLUTION_WEBHOOK_SECRET
    ) {
      this.logger.warn('Webhook rejeitado: segredo invalido');
      throw Erros.naoAutenticado('Webhook nao autorizado');
    }

    const evento = String(payload.event ?? '')
      .toLowerCase()
      .replace(/_/g, '.');
    if (evento && evento !== 'messages.upsert') {
      return { ignorado: true, motivo: 'evento_nao_tratado', evento: payload.event };
    }

    const instancia = payload.instance;
    if (!instancia) {
      return { ignorado: true, motivo: 'sem_instancia' };
    }

    const itens = extrairMensagens(payload);
    // ACK imediato: se esperarmos o bot+envio, a Evolution atrasa o próximo webhook (~60s)
    // e as respostas saem fora de ordem no WhatsApp.
    void this.processarEmBackground(instancia, itens);

    return { ok: true, aceitas: itens.length };
  }

  private async processarEmBackground(
    instancia: string,
    itens: Record<string, unknown>[],
  ): Promise<void> {
    // Ordena pelo timestamp da mensagem (mais antiga primeiro)
    const ordenados = [...itens].sort(
      (a, b) => timestampMensagem(a) - timestampMensagem(b),
    );

    for (const item of ordenados) {
      try {
        await this.processarItem(instancia, item);
      } catch (erro) {
        this.logger.error(
          `Falha background webhook: ${(erro as Error).message}`,
        );
      }
    }
  }

  private async processarItem(instancia: string, item: Record<string, unknown>) {
    const chave = (item.key ?? {}) as {
      remoteJid?: string;
      remoteJidAlt?: string;
      id?: string;
      fromMe?: boolean;
      participant?: string;
      senderPn?: string;
    };

    if (!chave.remoteJid || chave.fromMe) {
      return null;
    }

    if (chave.remoteJid.endsWith('@g.us') || chave.remoteJid === 'status@broadcast') {
      return null;
    }

    const texto = extrairTexto(item.message as Record<string, unknown> | undefined);
    if (!texto.trim()) {
      return null;
    }

    const telefone = extrairTelefonePacelia(item, chave);
    if (!telefone) {
      this.logger.warn(`Webhook sem telefone resolvivel id=${chave.id ?? '?'}`);
      return null;
    }
    const destinoEnvio = chave.remoteJid.endsWith('@lid') ? chave.remoteJid : telefone;

    this.logger.log(
      `Mensagem recebida instancia=${instancia} de=${telefone.slice(0, 6)}*** destino=${destinoEnvio}`,
    );

    return this.servico.processarMensagemRecebida({
      nomeInstancia: instancia,
      telefone,
      destinoEnvio,
      nome: typeof item.pushName === 'string' ? item.pushName : undefined,
      texto,
      idExterno: chave.id ?? null,
      recebidoEm: timestampMensagem(item),
    });
  }
}

function timestampMensagem(item: Record<string, unknown>): number {
  const raw = item.messageTimestamp ?? item.messageTimestampMs;
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : 0;
  if (!Number.isFinite(n) || n <= 0) return Date.now();
  // Evolution às vezes manda segundos, às vezes ms
  return n < 1e12 ? n * 1000 : n;
}

/** Mesmo critério da Pacelia: data[] | data.messages[] | data com key/message. */
function extrairMensagens(payload: PayloadEvolution): Record<string, unknown>[] {
  const data = payload.data;
  if (!data) return [];
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const messages = (data as { messages?: unknown }).messages;
  if (Array.isArray(messages)) return messages as Record<string, unknown>[];
  if ((data as { key?: unknown }).key || (data as { message?: unknown }).message) {
    return [data as Record<string, unknown>];
  }
  return [];
}

/**
 * Igual Pacelia `parseMessage` + `phoneFromJid`:
 * se remoteJid é @lid e existe remoteJidAlt, troca pelo Alt; depois só dígitos.
 */
function extrairTelefonePacelia(
  item: Record<string, unknown>,
  chave: {
    remoteJid?: string;
    remoteJidAlt?: string;
    participant?: string;
    senderPn?: string;
  },
): string {
  let remoteJid = chave.remoteJid ?? '';
  const alt =
    chave.remoteJidAlt ??
    chave.senderPn ??
    (typeof item.senderPn === 'string' ? item.senderPn : undefined) ??
    (typeof item.sender_pn === 'string' ? item.sender_pn : undefined);

  if (remoteJid.includes('@lid') && typeof alt === 'string' && alt.length > 0) {
    remoteJid = alt;
  }

  const local = String(remoteJid).split('@')[0] ?? '';
  const digitos = local.replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.length >= 12 && digitos.startsWith('55')) return digitos;
  if (digitos.length >= 10 && digitos.length <= 11) return `55${digitos}`;
  return digitos;
}

function extrairTexto(message?: Record<string, unknown>): string {
  if (!message) return '';

  const list = message.listResponseMessage as
    | { singleSelectReply?: { selectedRowId?: string; selectedId?: string }; title?: string }
    | undefined;
  if (list?.singleSelectReply?.selectedRowId) return list.singleSelectReply.selectedRowId;
  if (list?.singleSelectReply?.selectedId) return list.singleSelectReply.selectedId;
  if (list?.title) return list.title;

  const buttons = message.buttonsResponseMessage as {
    selectedButtonId?: string;
    selectedDisplayText?: string;
  } | undefined;
  if (buttons?.selectedButtonId) return buttons.selectedButtonId;
  if (buttons?.selectedDisplayText) return buttons.selectedDisplayText;

  const template = message.templateButtonReplyMessage as
    | { selectedId?: string; selectedDisplayText?: string }
    | undefined;
  if (template?.selectedId) return template.selectedId;
  if (template?.selectedDisplayText) return template.selectedDisplayText;

  if (typeof message.conversation === 'string') return message.conversation;

  const extended = message.extendedTextMessage as { text?: string } | undefined;
  if (extended?.text) return extended.text;

  const ephemeral = message.ephemeralMessage as { message?: Record<string, unknown> } | undefined;
  if (ephemeral?.message) return extrairTexto(ephemeral.message);

  const viewOnce = message.viewOnceMessage as { message?: Record<string, unknown> } | undefined;
  if (viewOnce?.message) return extrairTexto(viewOnce.message);

  const viewOnceV2 = message.viewOnceMessageV2 as { message?: Record<string, unknown> } | undefined;
  if (viewOnceV2?.message) return extrairTexto(viewOnceV2.message);

  const image = message.imageMessage as { caption?: string } | undefined;
  if (image?.caption) return image.caption;
  const doc = message.documentMessage as { caption?: string } | undefined;
  if (doc?.caption) return doc.caption;

  return '';
}
