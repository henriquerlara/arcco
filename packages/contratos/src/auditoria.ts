import { z } from 'zod';

/**
 * Tipos da seção 16.3. Os que ainda não têm fluxo no produto ficam reservados
 * para as tarefas seguintes. A consulta é a ECOL-27b.
 */
export const TipoAuditoria = {
  ALTERACAO_PRECO: 'ALTERACAO_PRECO',
  ALTERACAO_PARAMETRO_COMERCIAL: 'ALTERACAO_PARAMETRO_COMERCIAL',
  ENTRADA_ESTOQUE: 'ENTRADA_ESTOQUE',
  SAIDA_ESTOQUE: 'SAIDA_ESTOQUE',
  AJUSTE_ESTOQUE: 'AJUSTE_ESTOQUE',
  IMPORTACAO_XML: 'IMPORTACAO_XML',
  CONVERSAO_PEDIDO: 'CONVERSAO_PEDIDO',
  CANCELAMENTO_PEDIDO: 'CANCELAMENTO_PEDIDO',
  ALTERACAO_COMISSAO: 'ALTERACAO_COMISSAO',
  ALTERACAO_ST_FORNECEDOR: 'ALTERACAO_ST_FORNECEDOR',
  EMISSAO_NF: 'EMISSAO_NF',
  CANCELAMENTO_NF: 'CANCELAMENTO_NF',
  CARTA_CORRECAO_NF: 'CARTA_CORRECAO_NF',
  ENVIO_EMAIL_NF: 'ENVIO_EMAIL_NF',
  ALTERACAO_PERMISSAO: 'ALTERACAO_PERMISSAO',
  EXCLUSAO_ORCAMENTO: 'EXCLUSAO_ORCAMENTO',
} as const;

export type TipoAuditoria = (typeof TipoAuditoria)[keyof typeof TipoAuditoria];

export const TIPOS_AUDITORIA = Object.values(TipoAuditoria);

const CATALOGO = new Set<string>(TIPOS_AUDITORIA);

/** Reservados sem fluxo de gravação ainda. */
export const TIPOS_AUDITORIA_RESERVADOS = [] as const;

/** Rótulos curtos para a consulta administrativa (ECOL-27b). */
export const ROTULO_TIPO_AUDITORIA: Record<TipoAuditoria, string> = {
  ALTERACAO_PRECO: 'Alteração de preço',
  ALTERACAO_PARAMETRO_COMERCIAL: 'Parâmetro comercial',
  ENTRADA_ESTOQUE: 'Entrada de estoque',
  SAIDA_ESTOQUE: 'Saída de estoque',
  AJUSTE_ESTOQUE: 'Ajuste de estoque',
  IMPORTACAO_XML: 'Importação de NF-e',
  CONVERSAO_PEDIDO: 'Conversão em pedido',
  CANCELAMENTO_PEDIDO: 'Cancelamento de pedido',
  ALTERACAO_COMISSAO: 'Alteração de comissão',
  ALTERACAO_ST_FORNECEDOR: 'Alteração de ST%',
  EMISSAO_NF: 'Emissão de NF-e',
  CANCELAMENTO_NF: 'Cancelamento de NF-e',
  CARTA_CORRECAO_NF: 'Carta de correção (CC-e)',
  ENVIO_EMAIL_NF: 'Envio de DANFE/XML por e-mail',
  ALTERACAO_PERMISSAO: 'Alteração de permissão',
  EXCLUSAO_ORCAMENTO: 'Exclusão de orçamento',
};

/** Origem do registro na consulta mesclada (dois bancos, sem TX distribuída). */
export const OrigemAuditoria = {
  OPERACIONAL: 'OPERACIONAL',
  PLATAFORMA: 'PLATAFORMA',
} as const;

export type OrigemAuditoria = (typeof OrigemAuditoria)[keyof typeof OrigemAuditoria];

export const consultarAuditoriaQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
  usuarioId: z.string().uuid().optional(),
  tipo: z
    .string()
    .optional()
    .refine((v) => v === undefined || v === '' || CATALOGO.has(v), {
      message: 'Tipo de auditoria desconhecido',
    }),
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
});

export type ConsultarAuditoriaQuery = z.infer<typeof consultarAuditoriaQuerySchema>;

const CHAVES_SECRETAS = new Set([
  'senha',
  'senhahash',
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'certificado',
  'senhacertificado',
  'secret',
  'clientsecret',
  'apikey',
  'authorization',
  'focustoken',
  'focus_nfe_token',
  'chaveprivada',
]);

export function tipoAuditoriaConhecido(tipo: string): tipo is TipoAuditoria {
  return CATALOGO.has(tipo);
}

function chaveSecreta(campo: string): boolean {
  return CHAVES_SECRETAS.has(campo.toLowerCase().replace(/[^a-z0-9_]/g, ''));
}

/** Remove senha, token, certificado e demais segredos antes de persistir o log. */
export function redigirSegredos<T>(valor: T): T {
  return limpar(valor) as T;
}

function limpar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map((item) => limpar(item));
  if (!valor || typeof valor !== 'object') return valor;
  if (valor instanceof Date) return valor;
  const saida: Record<string, unknown> = {};
  for (const [campo, conteudo] of Object.entries(valor as Record<string, unknown>)) {
    if (chaveSecreta(campo)) continue;
    saida[campo] = limpar(conteudo);
  }
  return saida;
}
