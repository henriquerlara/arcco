import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { carregarEnv } from '../../config/env';
import { EvolutionWhatsAppProvider } from './evolution.provider';
import { WhatsAppService } from './whatsapp.service';
import { extrairMidia, textoOuNomeArquivo } from './midia-evolution';

type MsgEvo = {
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
};

/**
 * Fallback quando o webhook da Evolution atrasa.
 * Só puxa inbound novas, em ordem cronológica, sem marcar ID antes de ter texto.
 */
@Injectable()
export class EvolutionPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('EvolutionPoller');
  private readonly env = carregarEnv();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly processados = new Set<string>();
  private ligado = false;
  private ocupado = false;

  constructor(
    private readonly evolution: EvolutionWhatsAppProvider,
    private readonly whatsapp: WhatsAppService,
  ) {}

  onModuleInit() {
    if (this.env.WHATSAPP_PROVIDER !== 'evolution') return;
    this.ligado = true;
    void this.aquecer().finally(() => {
      this.timer = setInterval(() => {
        void this.tick();
      }, 800);
      this.logger.log('Poller Evolution ativo (a cada 0.8s)');
    });
  }

  private async aquecer() {
    try {
      const conexoes = await this.whatsapp.listarConexoesAtivasEvolution();
      for (const nome of conexoes) {
        const msgs = await this.evolution.buscarMensagensRecentes(nome, 80);
        for (const msg of msgs) {
          const id = msg.key?.id;
          if (id) this.processados.add(id);
        }
      }
      this.logger.log(`Poller aquecido com ${this.processados.size} ids`);
    } catch (erro) {
      this.logger.warn(`Aquecimento poller: ${(erro as Error).message}`);
    }
  }

  onModuleDestroy() {
    this.ligado = false;
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (!this.ligado || this.ocupado) return;
    this.ocupado = true;
    try {
      const conexoes = await this.whatsapp.listarConexoesAtivasEvolution();
      for (const nome of conexoes) {
        await this.puxarInstancia(nome);
      }
    } catch (erro) {
      this.logger.warn(`Poller falhou: ${(erro as Error).message}`);
    } finally {
      this.ocupado = false;
    }
  }

  private async puxarInstancia(nomeInstancia: string) {
    const msgs = await this.evolution.buscarMensagensRecentes(nomeInstancia, 40);
    const candidatas = msgs
      .filter((msg) => {
        const id = msg.key?.id;
        if (!id || msg.key?.fromMe) return false;
        if (this.processados.has(id)) return false;
        const telefone = telefoneDeMensagem(msg);
        const texto = textoOuNomeArquivo(msg.message);
        const midia = extrairMidia(msg.message);
        return Boolean(telefone && (texto || midia));
      })
      .sort((a, b) => epochMs(a.messageTimestamp) - epochMs(b.messageTimestamp));

    for (const msg of candidatas) {
      const id = msg.key!.id!;
      this.processados.add(id);
      if (this.processados.size > 3000) {
        const primeiro = this.processados.values().next().value as string;
        this.processados.delete(primeiro);
      }

      const telefone = telefoneDeMensagem(msg);
      const texto = textoOuNomeArquivo(msg.message);
      const midia = extrairMidia(msg.message);
      const remoteJid = msg.key?.remoteJid;

      this.logger.log(`Poller capturou msg ${id.slice(0, 8)}… de=${telefone.slice(0, 6)}***`);
      try {
        await this.whatsapp.processarMensagemRecebida({
          nomeInstancia,
          telefone,
          destinoEnvio: remoteJid?.endsWith('@lid') ? remoteJid : telefone,
          nome: msg.pushName,
          texto: texto || midia?.nome || '',
          idExterno: id,
          recebidoEm: epochMs(msg.messageTimestamp),
          midia: midia
            ? {
                tipo: midia.tipo,
                nome: midia.nome,
                mime: midia.mime,
                caption: midia.caption,
                itemEvo: msg as Record<string, unknown>,
              }
            : undefined,
        });
      } catch (erro) {
        this.logger.error(`Poller nao processou ${id}: ${(erro as Error).message}`);
        this.processados.delete(id);
      }
    }
  }
}

function epochMs(raw: number | string | undefined): number {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : 0;
  if (!Number.isFinite(n) || n <= 0) return Date.now();
  return n < 1e12 ? n * 1000 : n;
}

function telefoneDeMensagem(msg: MsgEvo): string {
  let jid = msg.key?.remoteJid ?? '';
  const alt = msg.key?.remoteJidAlt ?? msg.key?.senderPn;
  if (jid.includes('@lid') && alt) jid = alt;
  if (jid.endsWith('@g.us') || jid === 'status@broadcast') return '';
  const digitos = jid.split('@')[0]?.replace(/\D/g, '') ?? '';
  if (!digitos) return '';
  if (digitos.length >= 12 && digitos.startsWith('55')) return digitos;
  if (digitos.length >= 10 && digitos.length <= 11) return `55${digitos}`;
  return digitos;
}

