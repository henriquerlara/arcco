import { z } from 'zod';
import {
  chatbotConfigSchema,
  horarioAtendimentoSchema,
  ModeloPagamentoPedido,
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
  cnpj: z.string().optional().nullable(),
  inscricaoEstadual: z.string().optional().nullable(),
  enderecoFiscal: z
    .object({
      logradouro: z.string().optional(),
      numero: z.string().optional(),
      complemento: z.string().optional(),
      bairro: z.string().optional(),
      municipio: z.string().optional(),
      uf: z.string().length(2).optional(),
      cep: z.string().optional(),
    })
    .optional()
    .nullable(),
});

export const atualizarOnboardingSchema = z.object({
  horarioAtendimento: horarioAtendimentoSchema.optional(),
  chatbot: chatbotConfigSchema.partial().optional(),
  onboardingConcluido: z.boolean().optional(),
});

const motivoPerdaSchema = z.object({
  codigo: z.string().trim().min(1).max(40),
  rotulo: z.string().trim().min(1).max(120),
  exigeDescricao: z.boolean().default(false),
});

/** ECOL-02 — parâmetros comerciais (sem segredos de certificado/token). */
export const atualizarParametrosComerciaisSchema = z.object({
  diasOrcamentoSemMovimentacao: z.number().int().min(1).max(90).optional(),
  diasChecklistPendente: z.number().int().min(1).max(90).optional(),
  rtPadraoParceiro: z.number().min(0).max(100).optional(),
  baseRtComissao: z.literal('TOTAL_PEDIDO').optional(),
  margemPadraoGlobal: z.number().positive().max(100).nullable().optional(),
  validadeOrcamentoDias: z.number().int().min(1).max(365).nullable().optional(),
  descontoMaximoPercentual: z.number().min(0).max(100).nullable().optional(),
  modelosPagamentoHabilitados: z
    .array(z.nativeEnum(ModeloPagamentoPedido))
    .min(1)
    .optional(),
  motivosPerda: z.array(motivoPerdaSchema).min(1).max(40).optional(),
  regimeTributario: z.string().trim().max(40).nullable().optional(),
  naturezaOperacao: z.string().trim().max(120).nullable().optional(),
  cfopPadrao: z.string().trim().max(10).nullable().optional(),
  csosnPadrao: z.string().trim().max(10).nullable().optional(),
  cstPadrao: z.string().trim().max(10).nullable().optional(),
  tratamentoSt: z.string().trim().max(200).nullable().optional(),
  informacoesComplementaresNfe: z.string().trim().max(2000).nullable().optional(),
});

export type AtualizarEmpresaInput = z.infer<typeof atualizarEmpresaSchema>;
export type AtualizarOnboardingInput = z.infer<typeof atualizarOnboardingSchema>;
export type AtualizarParametrosComerciaisInput = z.infer<
  typeof atualizarParametrosComerciaisSchema
>;
