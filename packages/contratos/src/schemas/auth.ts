import { z } from 'zod';
import { PerfilUsuario, SegmentoEmpresa } from '../enums/index.js';

export const cadastrarSchema = z.object({
  nomeEmpresa: z.string().min(2, 'Informe o nome da empresa'),
  nomeFantasia: z.string().optional(),
  segmento: z.nativeEnum(SegmentoEmpresa),
  nome: z.string().min(2, 'Informe seu nome'),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
  telefone: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
});

export const entrarSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(1, 'Informe a senha'),
});

export const trocarSenhaSchema = z.object({
  senhaAtual: z.string().min(1, 'Informe a senha atual'),
  senhaNova: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres'),
});

export const criarUsuarioSchema = z.object({
  nome: z.string().min(2, 'Informe o nome'),
  email: z.string().email('E-mail inválido'),
  senhaTemporaria: z.string().min(8, 'Senha temporária inválida'),
  perfil: z.enum([
    PerfilUsuario.GESTOR,
    PerfilUsuario.VENDEDOR,
    PerfilUsuario.ATENDENTE,
  ]),
});

export const redefinirSenhaUsuarioSchema = z.object({
  senhaTemporaria: z.string().min(8, 'Senha temporária inválida'),
});

export type CadastrarInput = z.infer<typeof cadastrarSchema>;
export type EntrarInput = z.infer<typeof entrarSchema>;
export type TrocarSenhaInput = z.infer<typeof trocarSenhaSchema>;
export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>;
