import type { PerfilUsuario } from '@arcco/contratos';

export interface UsuarioAutenticado {
  id: string;
  empresaId: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  versaoSessao: number;
  deveTrocarSenha: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    usuario?: UsuarioAutenticado;
  }
}
