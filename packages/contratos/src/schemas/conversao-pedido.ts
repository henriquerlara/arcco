import { z } from 'zod';
import { ModeloPagamentoPedido } from '../enums/index.js';

const linhaPersonalizadaSchema = z.object({
  forma: z.string().min(1),
  valor: z.number().nonnegative(),
  vencimentoEm: z.coerce.date().optional().nullable(),
  recebido: z.boolean().optional(),
});

/**
 * ECOL-17 — confirmação do assistente de conversão.
 * Soma das linhas ≠ total: avisa, não bloqueia (§11.4).
 */
export const converterOrcamentoPedidoSchema = z
  .object({
    orcamentoId: z.string().uuid(),
    modeloPagamento: z.enum([
      ModeloPagamentoPedido.PIX_AVISTA,
      ModeloPagamentoPedido.CARTAO_CREDITO,
      ModeloPagamentoPedido.CARTAO_DEBITO,
      ModeloPagamentoPedido.SINAL_RESTANTE_ENTREGA,
      ModeloPagamentoPedido.SINAL_BOLETOS,
      ModeloPagamentoPedido.PERSONALIZADO,
    ]),
    /** Cartão crédito / boletos. */
    parcelas: z.number().int().min(1).max(48).optional(),
    /** Sinal % (1–99) para sinal+restante / sinal+boletos. Padrão 50. */
    percentualSinal: z.number().positive().max(99).optional(),
    /** Vencimentos dos boletos (além do sinal). */
    vencimentosBoletos: z.array(z.coerce.date()).optional(),
    /** Linhas livres do modelo personalizado. */
    linhasPersonalizadas: z.array(linhaPersonalizadaSchema).optional(),
    /** Outros ORC do negócio a marcar SUBSTITUIDO (nenhum por padrão). */
    orcamentosSubstituirIds: z.array(z.string().uuid()).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.modeloPagamento === ModeloPagamentoPedido.CARTAO_CREDITO && !v.parcelas) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o numero de parcelas',
        path: ['parcelas'],
      });
    }
    if (v.modeloPagamento === ModeloPagamentoPedido.SINAL_BOLETOS) {
      if (!v.parcelas || v.parcelas < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe a quantidade de boletos',
          path: ['parcelas'],
        });
      }
    }
    if (
      v.modeloPagamento === ModeloPagamentoPedido.PERSONALIZADO &&
      (!v.linhasPersonalizadas || v.linhasPersonalizadas.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe ao menos uma linha de pagamento',
        path: ['linhasPersonalizadas'],
      });
    }
  });

export const marcarPagamentoRecebidoSchema = z.object({
  recebidoEm: z.coerce.date().optional(),
});

export const marcarChecklistSchema = z.object({
  concluido: z.boolean(),
});

/** ECOL-18 — cancelamento com motivo obrigatório (§11.5). */
export const cancelarPedidoSchema = z.object({
  motivo: z.string().trim().min(3).max(2000),
  /** Confirmação explícita do cliente (UI). */
  confirmar: z.literal(true),
});
