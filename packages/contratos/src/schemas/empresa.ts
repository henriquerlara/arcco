import { z } from 'zod';

const intervaloHorarioSchema = z.object({
  inicio: z.string().regex(/^\d{2}:\d{2}$/),
  fim: z.string().regex(/^\d{2}:\d{2}$/),
});

export const horarioAtendimentoSchema = z.object({
  segunda: z.array(intervaloHorarioSchema).default([]),
  terca: z.array(intervaloHorarioSchema).default([]),
  quarta: z.array(intervaloHorarioSchema).default([]),
  quinta: z.array(intervaloHorarioSchema).default([]),
  sexta: z.array(intervaloHorarioSchema).default([]),
  sabado: z.array(intervaloHorarioSchema).default([]),
  domingo: z.array(intervaloHorarioSchema).default([]),
});

export const chatbotConfigSchema = z.object({
  ativo: z.boolean().default(true),
  nome: z.string().default('Assistente ARCCO'),
  mensagemInicial: z.string().default(''),
  mensagemForaHorario: z.string().default(''),
  mensagemTransferencia: z.string().default(''),
  mensagemFinal: z.string().default(''),
  /** Trecho configurável da pergunta de Novo Orçamento (ex.: "a lista de materiais"). */
  textoPerguntaProjeto: z.string().default('a lista de materiais'),
});

/**
 * Personalização comercial por empresa. Ausência da chave equivale a PADRAO.
 * Não deriva do segmento: iluminação sem esta chave continua no produto compartilhado.
 */
export const PersonalizacaoComercial = {
  PADRAO: 'PADRAO',
  ECOLUME: 'ECOLUME',
} as const;
export type PersonalizacaoComercial =
  (typeof PersonalizacaoComercial)[keyof typeof PersonalizacaoComercial];

export const personalizacaoComercialSchema = z
  .enum([PersonalizacaoComercial.PADRAO, PersonalizacaoComercial.ECOLUME])
  .default(PersonalizacaoComercial.PADRAO);

const motivoPerdaConfigSchema = z.object({
  codigo: z.string().trim().min(1).max(40),
  rotulo: z.string().trim().min(1).max(120),
  exigeDescricao: z.boolean().default(false),
});

/**
 * ECOL-02 — campos opcionais no JSON de empresa.
 * passthrough preserva chaves futuras / já gravadas sem wipe.
 */
export const configuracoesEmpresaSchema = z
  .object({
    horarioAtendimento: horarioAtendimentoSchema,
    chatbot: chatbotConfigSchema,
    onboardingConcluido: z.boolean().optional().default(false),
    /** Dias corridos até o follow-up automático após enviar orçamento. */
    diasFollowUpOrcamento: z.number().int().min(1).max(30).optional().default(3),
    personalizacaoComercial: personalizacaoComercialSchema,
    // ECOL-02
    diasOrcamentoSemMovimentacao: z.number().int().min(1).max(90).optional(),
    diasChecklistPendente: z.number().int().min(1).max(90).optional(),
    rtPadraoParceiro: z.number().min(0).max(100).optional(),
    baseRtComissao: z.literal('TOTAL_PEDIDO').optional(),
    margemPadraoGlobal: z.number().positive().max(100).nullable().optional(),
    validadeOrcamentoDias: z.number().int().min(1).max(365).nullable().optional(),
    /** Sem default: null/ausente = desconto bloqueado sem VER_CUSTOS. */
    descontoMaximoPercentual: z.number().min(0).max(100).nullable().optional(),
    modelosPagamentoHabilitados: z.array(z.string()).optional(),
    motivosPerda: z.array(motivoPerdaConfigSchema).optional(),
    regimeTributario: z.string().max(40).nullable().optional(),
    naturezaOperacao: z.string().max(120).nullable().optional(),
    cfopPadrao: z.string().max(10).nullable().optional(),
    csosnPadrao: z.string().max(10).nullable().optional(),
    cstPadrao: z.string().max(10).nullable().optional(),
    tratamentoSt: z.string().max(200).nullable().optional(),
    informacoesComplementaresNfe: z.string().max(2000).nullable().optional(),
  })
  .passthrough();

export type HorarioAtendimento = z.infer<typeof horarioAtendimentoSchema>;
export type ChatbotConfig = z.infer<typeof chatbotConfigSchema>;
export type ConfiguracoesEmpresa = z.infer<typeof configuracoesEmpresaSchema>;

export const configuracoesEmpresaPadrao = (): ConfiguracoesEmpresa => ({
  horarioAtendimento: {
    segunda: [{ inicio: '08:00', fim: '18:00' }],
    terca: [{ inicio: '08:00', fim: '18:00' }],
    quarta: [{ inicio: '08:00', fim: '18:00' }],
    quinta: [{ inicio: '08:00', fim: '18:00' }],
    sexta: [{ inicio: '08:00', fim: '18:00' }],
    sabado: [],
    domingo: [],
  },
  chatbot: {
    ativo: true,
    nome: 'Assistente ARCCO',
    mensagemInicial: '',
    mensagemForaHorario:
      'Nosso atendimento humano está fechado neste momento, mas posso registrar sua solicitação. A equipe continuará o atendimento no próximo período disponível.',
    mensagemTransferencia:
      'Vou transferir você para um de nossos atendentes. Em instantes alguém da equipe continuará por aqui.',
    mensagemFinal:
      'Obrigado! Sua solicitação foi registrada. Nossa equipe recebeu as informações e continuará o atendimento por aqui.',
    textoPerguntaProjeto: 'a lista de materiais',
  },
  onboardingConcluido: false,
  diasFollowUpOrcamento: 3,
  personalizacaoComercial: PersonalizacaoComercial.PADRAO,
});
