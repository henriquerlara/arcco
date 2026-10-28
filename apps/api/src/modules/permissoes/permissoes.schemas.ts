import { z } from 'zod';

export const definirPermissoesSchema = z.object({
  chaves: z.array(z.string().min(1).max(64)).max(80),
  conjuntoId: z.string().uuid().nullable().optional(),
});

export const criarConjuntoSchema = z.object({
  nome: z.string().trim().min(2).max(80),
  chaves: z.array(z.string().min(1).max(64)).max(80),
});

export const atualizarConjuntoSchema = z.object({
  nome: z.string().trim().min(2).max(80).optional(),
  chaves: z.array(z.string().min(1).max(64)).max(80).optional(),
});

export const aplicarConjuntoSchema = z.object({
  usuarioId: z.string().uuid(),
});

export type DefinirPermissoesInput = z.infer<typeof definirPermissoesSchema>;
export type CriarConjuntoInput = z.infer<typeof criarConjuntoSchema>;
export type AtualizarConjuntoInput = z.infer<typeof atualizarConjuntoSchema>;
export type AplicarConjuntoInput = z.infer<typeof aplicarConjuntoSchema>;
