import type { ExtracaoDados, IntencaoIa } from '@arcco/contratos';

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface ContextoIa {
  segmento?: string;
  historico?: { autor: 'cliente' | 'bot' | 'atendente'; texto: string }[];
  camposDesejados?: { chave: string; rotulo: string }[];
}

export interface AIProvider {
  classificarIntencao(texto: string, contexto?: ContextoIa): Promise<IntencaoIa>;
  extrairDados(texto: string, contexto?: ContextoIa): Promise<ExtracaoDados>;
  resumirConversa(mensagens: string[]): Promise<{ resumo: string; pontosChave?: string[] }>;
}
