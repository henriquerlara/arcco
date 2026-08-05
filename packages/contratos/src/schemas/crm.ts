import { z } from 'zod';
import {
  PrioridadeOportunidade,
  StatusObra,
  TipoAtividade,
  TipoContato,
  TipoEtapaFunil,
  EntidadeCampoPersonalizado,
  TipoCampoPersonalizado,
} from '../enums/index.js';

export const paginacaoQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
  busca: z.string().optional(),
});

export const criarContatoSchema = z.object({
  nome: z.string().min(2, 'Informe o nome'),
  telefone: z.string().min(8, 'Informe o telefone'),
  email: z.string().email().optional().or(z.literal('')),
  tipo: z.nativeEnum(TipoContato).default(TipoContato.OUTRO),
  empresaNome: z.string().optional(),
  origem: z.string().optional(),
  observacoes: z.string().optional(),
  responsavelId: z.string().uuid().optional().nullable(),
  dadosPersonalizados: z.record(z.unknown()).optional().default({}),
});

export const atualizarContatoSchema = criarContatoSchema.partial();

export const criarObraSchema = z.object({
  nome: z.string().min(2, 'Informe o nome da obra'),
  identificacao: z.string().optional(),
  tipo: z.string().optional(),
  status: z.nativeEnum(StatusObra).default(StatusObra.PLANEJAMENTO),
  endereco: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  previsao: z.coerce.date().optional().nullable(),
  observacoes: z.string().optional(),
  dadosPersonalizados: z.record(z.unknown()).optional().default({}),
});

export const atualizarObraSchema = criarObraSchema.partial();

export const vincularContatoObraSchema = z.object({
  contatoId: z.string().uuid(),
  papel: z.string().min(1, 'Informe o papel'),
});

export const criarCategoriaSchema = z.object({
  nome: z.string().min(2),
  descricao: z.string().optional(),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional().default(true),
});

export const atualizarCategoriaSchema = criarCategoriaSchema.partial();

export const criarEtapaFunilSchema = z.object({
  nome: z.string().min(2),
  ordem: z.number().int(),
  tipo: z.nativeEnum(TipoEtapaFunil).default(TipoEtapaFunil.ABERTA),
  ativo: z.boolean().optional().default(true),
});

export const atualizarEtapaFunilSchema = criarEtapaFunilSchema.partial();

export const reordenarEtapasSchema = z.object({
  etapas: z.array(
    z.object({
      id: z.string().uuid(),
      ordem: z.number().int(),
    }),
  ),
});

export const excluirEtapaSchema = z.object({
  etapaDestinoId: z.string().uuid(),
});

export const criarOportunidadeSchema = z.object({
  titulo: z.string().min(2),
  contatoId: z.string().uuid(),
  obraId: z.string().uuid().optional().nullable(),
  categoriaId: z.string().uuid().optional().nullable(),
  etapaId: z.string().uuid().optional(),
  responsavelId: z.string().uuid().optional().nullable(),
  descricao: z.string().optional(),
  origem: z.string().optional(),
  prioridade: z.nativeEnum(PrioridadeOportunidade).default(PrioridadeOportunidade.MEDIA),
  valorEstimado: z.number().optional().nullable(),
  previsaoFechamento: z.coerce.date().optional().nullable(),
  proximaAcao: z.string().optional().nullable(),
  dataProximaAcao: z.coerce.date().optional().nullable(),
  codigoOrcamento: z.string().optional().nullable(),
  dadosPersonalizados: z.record(z.unknown()).optional().default({}),
});

export const atualizarOportunidadeSchema = criarOportunidadeSchema.partial().extend({
  motivoPerda: z.string().optional().nullable(),
});

export const moverOportunidadeSchema = z.object({
  etapaId: z.string().uuid(),
  motivoPerda: z.string().optional(),
});

export const criarAtividadeSchema = z
  .object({
    oportunidadeId: z.string().uuid().optional().nullable(),
    contatoId: z.string().uuid().optional().nullable(),
    obraId: z.string().uuid().optional().nullable(),
    responsavelId: z.string().uuid().optional(),
    tipo: z.nativeEnum(TipoAtividade),
    titulo: z.string().min(2),
    descricao: z.string().optional(),
    vencimento: z.coerce.date(),
  })
  .refine(
    (d) => d.oportunidadeId || d.contatoId || d.obraId,
    { message: 'Relacione a atividade a uma oportunidade, contato ou obra' },
  );

export const atualizarAtividadeSchema = z.object({
  tipo: z.nativeEnum(TipoAtividade).optional(),
  titulo: z.string().min(2).optional(),
  descricao: z.string().optional().nullable(),
  vencimento: z.coerce.date().optional(),
  responsavelId: z.string().uuid().optional(),
  oportunidadeId: z.string().uuid().optional().nullable(),
  contatoId: z.string().uuid().optional().nullable(),
  obraId: z.string().uuid().optional().nullable(),
  concluida: z.boolean().optional(),
});

export const criarCampoPersonalizadoSchema = z.object({
  entidade: z.nativeEnum(EntidadeCampoPersonalizado),
  chave: z
    .string()
    .min(2)
    .regex(/^[a-z0-9_]+$/, 'Use apenas letras minúsculas, números e _'),
  rotulo: z.string().min(2),
  descricao: z.string().optional(),
  tipo: z.nativeEnum(TipoCampoPersonalizado),
  obrigatorio: z.boolean().default(false),
  opcoes: z.array(z.string()).optional().nullable(),
  ordem: z.number().int().default(0),
  ativo: z.boolean().default(true),
  usarNoChatbot: z.boolean().default(false),
  textoPergunta: z.string().optional().nullable(),
  mostrarNoResumo: z.boolean().default(true),
  permitirFiltro: z.boolean().default(false),
});

export const atualizarCampoPersonalizadoSchema = criarCampoPersonalizadoSchema.partial();

export const estadoBotSchema = z.object({
  fluxo: z.string().optional(),
  etapa: z.string().optional(),
  dadosColetados: z.record(z.unknown()).optional().default({}),
  ultimaPergunta: z.string().optional(),
  tentativas: z.number().int().default(0),
  /** JID WhatsApp para envio (@lid preferencial) — não faz parte do fluxo do bot */
  jidEnvio: z.string().optional(),
});

export type EstadoBot = z.infer<typeof estadoBotSchema>;

export const paginacaoRespostaSchema = z.object({
  pagina: z.number(),
  porPagina: z.number(),
  total: z.number(),
  totalPaginas: z.number(),
});

export function criarRespostaPaginada<T>(
  dados: T[],
  total: number,
  pagina: number,
  porPagina: number,
) {
  return {
    dados,
    paginacao: {
      pagina,
      porPagina,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
    },
  };
}
