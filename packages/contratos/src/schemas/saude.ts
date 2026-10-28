import { z } from 'zod';
import { StatusConsulta } from '../enums/index.js';

const hora = z.string().regex(/^\d{2}:\d{2}$/, 'Use o horário no formato HH:mm');

export const criarPacienteSchema = z.object({
  nome: z.string().min(2, 'Informe o nome do paciente'),
  telefone: z.string().min(8, 'Informe o telefone'),
  cpf: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  nascimento: z.string().optional(),
  convenio: z.string().optional(),
  numeroCarteira: z.string().optional(),
  observacoes: z.string().optional(),
});

export const criarProfissionalSchema = z.object({
  nome: z.string().min(2, 'Informe o nome do profissional'),
  especialidade: z.string().min(2, 'Informe a especialidade'),
});

export const criarConsultaSchema = z.object({
  pacienteId: z.string().uuid(),
  profissionalId: z.string().uuid(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a data no formato AAAA-MM-DD'),
  hora,
  convenio: z.string().optional(),
  numeroCarteira: z.string().optional(),
  observacoes: z.string().optional(),
});

export const atualizarConsultaSchema = z.object({
  status: z.nativeEnum(StatusConsulta),
});

export const criarMedicamentoSchema = z.object({
  nome: z.string().min(2, 'Informe o medicamento'),
  apresentacao: z.string().optional(),
  estoque: z.number().int().min(0).default(0),
  estoqueMinimo: z.number().int().min(0).default(5),
});

export const ajustarEstoqueMedicamentoSchema = z.object({
  estoque: z.number().int().min(0),
});

export const atualizarConfiguracaoClinicaSchema = z.object({
  duracaoSlotMinutos: z.number().int().min(10).max(120),
  horizonteDias: z.number().int().min(1).max(180),
});

export type CriarPacienteInput = z.infer<typeof criarPacienteSchema>;
export type CriarProfissionalInput = z.infer<typeof criarProfissionalSchema>;
export type CriarConsultaInput = z.infer<typeof criarConsultaSchema>;
export type CriarMedicamentoInput = z.infer<typeof criarMedicamentoSchema>;
