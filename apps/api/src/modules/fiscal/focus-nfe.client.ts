import { Injectable, Logger } from '@nestjs/common';
import { carregarEnv } from '../../config/env';

export interface FocusNfeEnvioResultado {
  mock: boolean;
  statusHttp: number;
  body: Record<string, unknown>;
}

/**
 * Cliente HTTP Focus NFe (Basic Auth com token).
 * Docs: https://focusnfe.com.br/doc/
 */
@Injectable()
export class FocusNfeClient {
  private readonly logger = new Logger('FocusNfe');

  configurado(): boolean {
    return Boolean(carregarEnv().FOCUS_NFE_TOKEN?.trim());
  }

  ambiente(): 'homologacao' | 'producao' {
    return carregarEnv().FOCUS_NFE_ENV;
  }

  private baseUrl(): string {
    return this.ambiente() === 'producao'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';
  }

  private headers(): Record<string, string> {
    const token = carregarEnv().FOCUS_NFE_TOKEN;
    const basic = Buffer.from(`${token}:`).toString('base64');
    return {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
    };
  }

  async emitirNfe(ref: string, payload: Record<string, unknown>): Promise<FocusNfeEnvioResultado> {
    if (!this.configurado()) {
      return {
        mock: true,
        statusHttp: 200,
        body: {
          status: 'autorizado',
          numero: String(Math.floor(1000 + Math.random() * 9000)),
          serie: '1',
          chave_nfe: `MOCK${Date.now()}${Math.floor(Math.random() * 1e10)}`.slice(0, 44),
          protocolo: `MOCK-PROT-${Date.now()}`,
          caminho_xml_nota_fiscal: null,
          caminho_danfe: null,
          mensagem: 'Emissão simulada (FOCUS_NFE_TOKEN ausente)',
        },
      };
    }

    const url = `${this.baseUrl()}/v2/nfe?ref=${encodeURIComponent(ref)}`;
    this.logger.log(`POST /v2/nfe ref=${ref}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      this.logger.error(`Focus emit falhou status=${res.status} ref=${ref}`);
    }
    return { mock: false, statusHttp: res.status, body };
  }

  async consultarNfe(ref: string): Promise<FocusNfeEnvioResultado> {
    if (!this.configurado()) {
      return {
        mock: true,
        statusHttp: 200,
        body: { status: 'autorizado', mensagem: 'Consulta mock' },
      };
    }
    const url = `${this.baseUrl()}/v2/nfe/${encodeURIComponent(ref)}`;
    const res = await fetch(url, { method: 'GET', headers: this.headers() });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { mock: false, statusHttp: res.status, body };
  }

  /** Baixa XML/DANFE a partir do caminho relativo retornado pela Focus. */
  async baixarArquivo(caminhoRelativo: string): Promise<Buffer | null> {
    if (!caminhoRelativo || !this.configurado()) return null;
    const path = caminhoRelativo.startsWith('/') ? caminhoRelativo : `/${caminhoRelativo}`;
    const url = `${this.baseUrl()}${path}`;
    try {
      const res = await fetch(url, { method: 'GET', headers: this.headers() });
      if (!res.ok) {
        this.logger.warn(`Falha ao baixar arquivo Focus status=${res.status} path=${path}`);
        return null;
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (erro) {
      this.logger.warn(`Erro download Focus: ${(erro as Error).message}`);
      return null;
    }
  }
}
