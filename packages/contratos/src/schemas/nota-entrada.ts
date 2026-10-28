import { z } from 'zod';

export const decisaoItemNotaEntradaSchema = z.object({
  numeroItem: z.number().int().positive(),
  /** criar = novo produto; vincular = produtoId existente; reconhecido = já achado por código. */
  acao: z.enum(['criar', 'vincular', 'reconhecido']),
  produtoId: z.string().uuid().optional().nullable(),
  descricaoComercial: z.string().max(500).optional().nullable(),
  controlaEstoque: z.boolean().optional(),
  /** Obrigatório quando a regra ECOL-05 exige (saldo > 0 sem custo médio). */
  custoReferenciaSaldo: z.number().min(0).optional().nullable(),
});

export const confirmarNotaEntradaSchema = z
  .object({
    /** Obrigatório quando não há `notaEntradaId` (importação direta). */
    xml: z.string().min(20).max(2_500_000).optional(),
    /** Nota PENDENTE salva antes; o XML é lido do arquivo guardado. */
    notaEntradaId: z.string().uuid().optional(),
    /** Obrigatório quando o fornecedor ainda não existe. Zero permitido. */
    aliquotaStFornecedor: z.number().min(0).max(100).optional().nullable(),
    itens: z.array(decisaoItemNotaEntradaSchema).min(1),
  })
  .refine((v) => Boolean(v.xml) || Boolean(v.notaEntradaId), {
    message: 'Informe o xml ou a notaEntradaId',
    path: ['xml'],
  });

/** Salva a conferência sem movimentar estoque (status PENDENTE). Decisões parciais são aceitas. */
export const salvarPendenteNotaEntradaSchema = z.object({
  xml: z.string().min(20).max(2_500_000),
  aliquotaStFornecedor: z.number().min(0).max(100).optional().nullable(),
  itens: z.array(decisaoItemNotaEntradaSchema).optional(),
});

export const previsualizarNotaEntradaSchema = z.object({
  xml: z.string().min(20).max(2_500_000),
});
