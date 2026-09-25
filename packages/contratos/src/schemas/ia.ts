import { z } from 'zod';
import { IntencaoChatbot } from '../enums/index.js';

export const intencaoIaSchema = z.object({
  intencao: z.nativeEnum(IntencaoChatbot),
  confianca: z.number().min(0).max(1).optional(),
});

export const extracaoDadosSchema = z.object({
  nome: z.string().optional(),
  perfil: z.string().optional(),
  obraNome: z.string().optional(),
  cidade: z.string().optional(),
  necessidade: z.string().optional(),
  categoria: z.string().optional(),
  prazo: z.string().optional(),
  quantidade: z.string().optional(),
  codigoOrcamento: z.string().optional(),
  camposPersonalizados: z.record(z.unknown()).optional(),
  confianca: z.number().min(0).max(1).optional(),
});

export type IntencaoIa = z.infer<typeof intencaoIaSchema>;
export type ExtracaoDados = z.infer<typeof extracaoDadosSchema>;
