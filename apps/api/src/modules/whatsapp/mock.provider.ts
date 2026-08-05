import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StatusConexaoWhatsApp } from '@arcco/contratos';
import type {
  EnvioResultado,
  OpcoesEnvioTexto,
  ResultadoConexao,
  WhatsAppProvider,
} from './whatsapp.provider';

/**
 * Provedor simulado: nao envia nada de verdade, apenas registra em log e devolve ids.
 * Usado em desenvolvimento e nos endpoints de simulacao.
 */
@Injectable()
export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly nome = 'mock';
  private readonly logger = new Logger('WhatsAppMock');

  async enviarTexto(
    nomeInstancia: string,
    telefone: string,
    texto: string,
    _opcoes?: OpcoesEnvioTexto,
  ): Promise<EnvioResultado> {
    this.logger.log(`[${nomeInstancia}] -> ${telefone}: ${texto}`);
    return { idExterno: `mock_${randomUUID()}`, status: 'ENVIADA' };
  }

  async conectar(): Promise<ResultadoConexao> {
    return {
      status: StatusConexaoWhatsApp.CONECTADO,
      qrCode: null,
      numero: '5511999990000',
    };
  }

  async desconectar(): Promise<void> {
    // nada a fazer no mock
  }

  async statusConexao(): Promise<ResultadoConexao> {
    return { status: StatusConexaoWhatsApp.CONECTADO, numero: '5511999990000' };
  }
}
