import { TipoMensagem } from '@arcco/contratos';

export interface MidiaDetectada {
  tipo: TipoMensagem;
  nome: string;
  mime: string;
  caption?: string;
}

/** Desembrulha envelopes Baileys (ephemeral, view-once, documentWithCaption). */
export function desempacotarMensagem(
  message?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!message) return undefined;
  const nested =
    (message.ephemeralMessage as { message?: Record<string, unknown> } | undefined)?.message ??
    (message.viewOnceMessage as { message?: Record<string, unknown> } | undefined)?.message ??
    (message.viewOnceMessageV2 as { message?: Record<string, unknown> } | undefined)?.message ??
    (message.documentWithCaptionMessage as { message?: Record<string, unknown> } | undefined)
      ?.message;
  if (nested) return desempacotarMensagem(nested);
  return message;
}

export function extrairMidia(message?: Record<string, unknown>): MidiaDetectada | null {
  const m = desempacotarMensagem(message);
  if (!m) return null;

  const doc = m.documentMessage as
    | { fileName?: string; mimetype?: string; caption?: string; title?: string }
    | undefined;
  if (doc) {
    return {
      tipo: TipoMensagem.DOCUMENTO,
      nome: doc.fileName || doc.title || 'documento.pdf',
      mime: doc.mimetype || 'application/octet-stream',
      caption: doc.caption,
    };
  }

  const image = m.imageMessage as { mimetype?: string; caption?: string } | undefined;
  if (image) {
    const png = image.mimetype?.includes('png');
    return {
      tipo: TipoMensagem.IMAGEM,
      nome: png ? 'imagem.png' : 'imagem.jpg',
      mime: image.mimetype || 'image/jpeg',
      caption: image.caption,
    };
  }

  const sticker = m.stickerMessage as { mimetype?: string } | undefined;
  if (sticker) {
    return {
      tipo: TipoMensagem.IMAGEM,
      nome: 'sticker.webp',
      mime: sticker.mimetype || 'image/webp',
    };
  }

  const audio = m.audioMessage as { mimetype?: string } | undefined;
  if (audio) {
    return {
      tipo: TipoMensagem.AUDIO,
      nome: 'audio.ogg',
      mime: audio.mimetype || 'audio/ogg',
    };
  }

  const video = m.videoMessage as { mimetype?: string; caption?: string } | undefined;
  if (video) {
    return {
      tipo: TipoMensagem.DOCUMENTO,
      nome: 'video.mp4',
      mime: video.mimetype || 'video/mp4',
      caption: video.caption,
    };
  }

  return null;
}

export function extrairTextoEvolution(message?: Record<string, unknown>): string {
  const m = desempacotarMensagem(message);
  if (!m) return '';

  const list = m.listResponseMessage as
    | { singleSelectReply?: { selectedRowId?: string; selectedId?: string }; title?: string }
    | undefined;
  if (list?.singleSelectReply?.selectedRowId) return list.singleSelectReply.selectedRowId;
  if (list?.singleSelectReply?.selectedId) return list.singleSelectReply.selectedId;
  if (list?.title) return list.title;

  const buttons = m.buttonsResponseMessage as {
    selectedButtonId?: string;
    selectedDisplayText?: string;
  } | undefined;
  if (buttons?.selectedButtonId) return buttons.selectedButtonId;
  if (buttons?.selectedDisplayText) return buttons.selectedDisplayText;

  const template = m.templateButtonReplyMessage as
    | { selectedId?: string; selectedDisplayText?: string }
    | undefined;
  if (template?.selectedId) return template.selectedId;
  if (template?.selectedDisplayText) return template.selectedDisplayText;

  if (typeof m.conversation === 'string') return m.conversation;

  const extended = m.extendedTextMessage as { text?: string } | undefined;
  if (extended?.text) return extended.text;

  const image = m.imageMessage as { caption?: string } | undefined;
  if (image?.caption) return image.caption;
  const doc = m.documentMessage as { caption?: string } | undefined;
  if (doc?.caption) return doc.caption;
  const video = m.videoMessage as { caption?: string } | undefined;
  if (video?.caption) return video.caption;

  return '';
}

/** Texto para o chatbot/CRM: caption, senão o nome do arquivo. */
export function textoOuNomeArquivo(message?: Record<string, unknown>): string {
  const texto = extrairTextoEvolution(message).trim();
  if (texto) return texto;
  const midia = extrairMidia(message);
  return midia?.nome ?? '';
}
