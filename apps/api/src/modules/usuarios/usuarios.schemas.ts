import { z } from 'zod';
import { PerfilUsuario } from '@arcco/contratos';

export const atualizarUsuarioSchema = z.object({
  nome: z.string().min(2).optional(),
  perfil: z
    .enum([PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR, PerfilUsuario.ATENDENTE])
    .optional(),
  ativo: z.boolean().optional(),
});

export type AtualizarUsuarioInput = z.infer<typeof atualizarUsuarioSchema>;
export type RedefinirSenhaInput = { senhaTemporaria: string };
