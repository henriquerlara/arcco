import { z } from 'zod';
import { StatusPedido } from '../enums/index.js';

/** Leitura — criação pública de pedido fica na ECOL-17 (conversão completa). */
export const itemPedidoSchema = z.object({
  id: z.string().uuid(),
  produtoId: z.string().uuid().nullable(),
  nome: z.string(),
  unidade: z.string(),
  quantidade: z.number(),
  precoUnitario: z.number(),
  desconto: z.number(),
  totalLinha: z.number(),
  ordem: z.number().int(),
  codigoInterno: z.string().nullable().optional(),
});

export const pedidoSchema = z.object({
  id: z.string().uuid(),
  empresaId: z.string().uuid(),
  oportunidadeId: z.string().uuid(),
  orcamentoId: z.string().uuid(),
  numero: z.string(),
  status: z.enum([
    StatusPedido.CONFIRMADO,
    StatusPedido.FINALIZADO,
    StatusPedido.CANCELADO,
  ]),
  observacoes: z.string().nullable().optional(),
  descontoValor: z.number(),
  descontoTipo: z.enum(['VALOR', 'PERCENTUAL']).optional(),
  descontoPercentual: z.number().nullable().optional(),
  subtotal: z.number(),
  total: z.number(),
  criadoPorId: z.string().uuid().nullable().optional(),
  criadoEm: z.coerce.date(),
  itens: z.array(itemPedidoSchema).optional(),
});
