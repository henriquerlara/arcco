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
});

export const configuracoesEmpresaSchema = z.object({
  horarioAtendimento: horarioAtendimentoSchema,
  chatbot: chatbotConfigSchema,
  onboardingConcluido: z.boolean().optional().default(false),
});

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
  },
  onboardingConcluido: false,
});
