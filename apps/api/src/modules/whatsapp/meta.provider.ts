import { Injectable, Logger } from '@nestjs/common';
import {
  type EnvioResultado,
  type MenuInterativoEnvio,
  type MidiaParaEnvio,
  type OpcoesEnvioTexto,
  type ResultadoConexao,
  type WhatsAppProvider,
} from './whatsapp.provider';
import { MetaGraphClient } from './meta.graph';

/**
 * Provider Meta Cloud API.
 * `nomeInstancia` é ignorado — usa PHONE_NUMBER_ID do ambiente / conexão.
 */
@Injectable()
export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly nome = 'meta';
  private readonly logger = new Logger('MetaWhatsApp');

  constructor(private readonly graph: MetaGraphClient) {}

  private normalizarDestino(telefone: string): string {
    return telefone.replace(/\D/g, '');
  }

  async enviarTexto(
    _nomeInstancia: string,
    telefone: string,
    texto: string,
    _opcoes?: OpcoesEnvioTexto,
  ): Promise<EnvioResultado> {
    try {
      const to = this.normalizarDestino(telefone);
      const res = await this.graph.enviarMensagem({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: texto, preview_url: false },
      });
      const id = res.messages?.[0]?.id;
      this.logger.log(`Texto enviado wamid=${id ?? '?'}`);
      return { idExterno: id, status: 'ENVIADA' };
    } catch (erro) {
      const msg = (erro as Error).message;
      this.logger.error(`Falha envio texto: ${msg}`);
      return { status: 'ERRO', erro: msg };
    }
  }

  /**
   * Envia menu como reply buttons (2–3 opções) ou list message (≥4).
   */
  async enviarInterativo(
    _nomeInstancia: string,
    telefone: string,
    menu: MenuInterativoEnvio,
  ): Promise<EnvioResultado> {
    try {
      const to = this.normalizarDestino(telefone);
      const body = menu.body.slice(0, 1024);
      const opcoes = menu.opcoes.slice(0, 10);

      let payload: Record<string, unknown>;
      if (opcoes.length <= 3) {
        payload = {
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: body },
            action: {
              buttons: opcoes.map((o) => ({
                type: 'reply',
                reply: {
                  id: o.id.slice(0, 256),
                  title: o.titulo.slice(0, 20),
                },
              })),
            },
          },
        };
      } else {
        payload = {
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive: {
            type: 'list',
            body: { text: body },
            action: {
              button: (menu.botaoLista || 'Ver opções').slice(0, 20),
              sections: [
                {
                  title: 'Opções',
                  rows: opcoes.map((o) => ({
                    id: o.id.slice(0, 200),
                    title: o.titulo.slice(0, 24),
                    ...(o.descricao
                      ? { description: o.descricao.slice(0, 72) }
                      : {}),
                  })),
                },
              ],
            },
          },
        };
      }

      const res = await this.graph.enviarMensagem(payload);
      const id = res.messages?.[0]?.id;
      this.logger.log(
        `Interativo (${opcoes.length <= 3 ? 'button' : 'list'}) wamid=${id ?? '?'}`,
      );
      return { idExterno: id, status: 'ENVIADA' };
    } catch (erro) {
      const msg = (erro as Error).message;
      this.logger.error(`Falha envio interativo: ${msg}`);
      return { status: 'ERRO', erro: msg };
    }
  }

  /** Texto curto do menu no CRM (sem descrições longas). */
  textoMenuParaRegistro(menu: MenuInterativoEnvio): string {
    return [
      menu.body,
      ...menu.opcoes.map((o) => `${o.id} ${o.titulo}`),
    ].join('\n');
  }

  async enviarTemplate(
    telefone: string,
    nome: string,
    languageCode = 'en_US',
  ): Promise<EnvioResultado> {
    try {
      const to = this.normalizarDestino(telefone);
      const res = await this.graph.enviarMensagem({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: nome,
          language: { code: languageCode },
        },
      });
      const id = res.messages?.[0]?.id;
      this.logger.log(`Template ${nome} enviado wamid=${id ?? '?'}`);
      return { idExterno: id, status: 'ENVIADA' };
    } catch (erro) {
      const msg = (erro as Error).message;
      this.logger.error(`Falha envio template: ${msg}`);
      return { status: 'ERRO', erro: msg };
    }
  }

  async enviarMidia(
    _nomeInstancia: string,
    telefone: string,
    midia: MidiaParaEnvio,
  ): Promise<EnvioResultado> {
    // Upload de mídia Cloud API fica para etapa seguinte — evita regressão.
    this.logger.warn('Envio de mídia Meta ainda não implementado; use texto/template');
    void telefone;
    void midia;
    return {
      status: 'ERRO',
      erro: 'Envio de mídia pela Meta Cloud API ainda não está disponível nesta etapa',
    };
  }

  async conectar(_nomeInstancia: string): Promise<ResultadoConexao> {
    if (!this.graph.configurado()) {
      return { status: 'ERRO', numero: null };
    }
    return {
      status: 'CONECTADO',
      numero: this.graph.displayPhone(),
      qrCode: null,
    };
  }

  async desconectar(_nomeInstancia: string): Promise<void> {
    // Cloud API via system token: desconectar só marca status local.
  }

  async statusConexao(_nomeInstancia: string): Promise<ResultadoConexao> {
    if (!this.graph.configurado()) {
      return { status: 'DESCONECTADO', numero: null };
    }
    return {
      status: 'CONECTADO',
      numero: this.graph.displayPhone(),
      qrCode: null,
    };
  }
}
