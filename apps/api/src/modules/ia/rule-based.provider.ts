import { Injectable } from '@nestjs/common';
import type { ExtracaoDados, IntencaoIa } from '@arcco/contratos';
import type { AIProvider, ContextoIa } from './ia.provider';
import { classificarIntencaoRegras } from './regras-intencao';

/**
 * Provedor de IA baseado em regras (sem chamadas externas). Padrao do MVP.
 */
@Injectable()
export class RuleBasedAIProvider implements AIProvider {
  async classificarIntencao(texto: string): Promise<IntencaoIa> {
    return classificarIntencaoRegras(texto);
  }

  async extrairDados(texto: string): Promise<ExtracaoDados> {
    const dados: ExtracaoDados = { confianca: 0.3 };

    const cidade = /(?:em|na cidade de|cidade)\s+([A-Za-zÀ-ú\s]{3,30})/i.exec(texto);
    if (cidade?.[1]) dados.cidade = cidade[1].trim();

    const quantidade = /(\d+(?:[.,]\d+)?)\s*(m3|m²|m2|metros|unidades|un|pe[çc]as|pontos)/i.exec(texto);
    if (quantidade) dados.quantidade = quantidade[0].trim();

    const codigo = /\b(OP-\d{3,}|ORC-?\d{2,})\b/i.exec(texto);
    if (codigo?.[1]) dados.codigoOrcamento = codigo[1].toUpperCase();

    const prazo = /(hoje|amanh[aã]|semana que vem|urgente|\d+\s*dias)/i.exec(texto);
    if (prazo?.[1]) dados.prazo = prazo[1];

    return dados;
  }

  async resumirConversa(mensagens: string[]): Promise<{ resumo: string; pontosChave?: string[] }> {
    const resumo = mensagens.slice(-6).join(' | ').slice(0, 500);
    return { resumo: resumo || 'Sem mensagens', pontosChave: [] };
  }

  // ContextoIa e aceito na interface mas ignorado neste provedor.
  protected usar(_ctx?: ContextoIa): void {
    void _ctx;
  }
}
