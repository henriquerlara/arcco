import { z } from 'zod';
import {
  chatbotConfigSchema,
  horarioAtendimentoSchema,
  SegmentoEmpresa,
} from '@arcco/contratos';

export const atualizarEmpresaSchema = z.object({
  nome: z.string().min(2).optional(),
  nomeFantasia: z.string().optional().nullable(),
  segmento: z.nativeEnum(SegmentoEmpresa).optional(),
  telefone: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  logoArquivoId: z.string().uuid().optional().nullable(),
});

export const atualizarOnboardingSchema = z.object({
  horarioAtendimento: horarioAtendimentoSchema.optional(),
  chatbot: chatbotConfigSchema.partial().optional(),
  onboardingConcluido: z.boolean().optional(),
});

export type AtualizarEmpresaInput = z.infer<typeof atualizarEmpresaSchema>;
export type AtualizarOnboardingInput = z.infer<typeof atualizarOnboardingSchema>;
