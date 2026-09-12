import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  extracaoDadosSchema,
  intencaoIaSchema,
  type ExtracaoDados,
  type IntencaoIa,
} from '@arcco/contratos';
import { carregarEnv } from '../../config/env';
import type { AIProvider, ContextoIa } from './ia.provider';
import { classificarIntencaoRegras } from './regras-intencao';

/**
 * Provedor de IA usando a OpenAI. Faz fallback para regras quando a chamada falha,
 * garantindo que o chatbot nunca fique sem resposta.
 */
@Injectable()
export class OpenAIProvider implements AIProvider {
  private readonly logger = new Logger('OpenAIProvider');
  private readonly env = carregarEnv();
  private readonly cliente = new OpenAI({ apiKey: this.env.OPENAI_API_KEY });

  private async json(prompt: string, sistema: string): Promise<unknown> {
    const resposta = await this.cliente.chat.completions.create({
      model: this.env.OPENAI_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sistema },
        { role: 'user', content: prompt },
      ],
    });
    const conteudo = resposta.choices[0]?.message?.content ?? '{}';
    return JSON.parse(conteudo);
  }

  async classificarIntencao(texto: string, contexto?: ContextoIa): Promise<IntencaoIa> {
    try {
      const bruto = await this.json(
        `Mensagem do cliente: "${texto}"`,
        `Voce classifica intencoes de atendimento de uma empresa do segmento ${
          contexto?.segmento ?? 'construcao'
        }. Responda JSON {"intencao": "<uma das: VENDAS, NOVO_ORCAMENTO, NEGOCIAR_ORCAMENTO, AJUSTAR_ORCAMENTO, DUVIDA, ACOMPANHAR_SOLICITACAO, FINANCEIRO, ENTREGA, SAC, POS_VENDA, FALAR_COM_PESSOA, OUTRO>", "confianca": 0..1}.`,
      );
      const parsed = intencaoIaSchema.safeParse(bruto);
      if (parsed.success) return parsed.data;
    } catch (erro) {
      this.logger.warn(`Falha na OpenAI (intencao), usando regras: ${(erro as Error).message}`);
    }
    return classificarIntencaoRegras(texto);
  }

  async extrairDados(texto: string, contexto?: ContextoIa): Promise<ExtracaoDados> {
    try {
      const campos = (contexto?.camposDesejados ?? [])
        .map((c) => `${c.chave} (${c.rotulo})`)
        .join(', ');
      const bruto = await this.json(
        `Mensagem: "${texto}". Campos desejados: ${campos || 'nenhum'}`,
        'Extraia dados estruturados da mensagem. Responda JSON com chaves possiveis: nome, perfil, obraNome, cidade, necessidade, categoria, prazo, quantidade, codigoOrcamento, camposPersonalizados (objeto), confianca (0..1). Omita o que nao encontrar.',
      );
      const parsed = extracaoDadosSchema.safeParse(bruto);
      if (parsed.success) return parsed.data;
    } catch (erro) {
      this.logger.warn(`Falha na OpenAI (extracao): ${(erro as Error).message}`);
    }
    return { confianca: 0 };
  }

  async resumirConversa(mensagens: string[]): Promise<{ resumo: string; pontosChave?: string[] }> {
    try {
      const bruto = (await this.json(
        `Conversa:\n${mensagens.join('\n')}`,
        'Resuma a conversa. Responda JSON {"resumo": "...", "pontosChave": ["..."]}',
      )) as { resumo?: string; pontosChave?: string[] };
      return { resumo: bruto.resumo ?? '', pontosChave: bruto.pontosChave ?? [] };
    } catch {
      return { resumo: mensagens.slice(-6).join(' | ').slice(0, 500) };
    }
  }
}
