import { z } from 'zod';
import { cnpjValido, digitosCnpj } from '../cnpj.js';

const cnpjSchema = z
  .string()
  .min(14, 'Informe o CNPJ')
  .transform(digitosCnpj)
  .refine(cnpjValido, 'CNPJ invalido');

export const criarFornecedorSchema = z.object({
  nome: z.string().min(2, 'Informe o nome ou razao social'),
  nomeCurto: z.string().max(60).optional().nullable(),
  cnpj: cnpjSchema,
  /** ST% obrigatório; zero permitido. Protegido por VER_CUSTOS na resposta. */
  aliquotaSt: z.number().min(0).max(100),
  contatoNome: z.string().max(120).optional().nullable(),
  telefone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  observacoes: z.string().max(2000).optional().nullable(),
  ativo: z.boolean().optional().default(true),
});

export const atualizarFornecedorSchema = criarFornecedorSchema.partial();
