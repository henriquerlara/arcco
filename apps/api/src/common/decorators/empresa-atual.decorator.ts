import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Erros } from '../erros/erros';

/**
 * Retorna o empresaId do usuario autenticado. NUNCA use empresaId vindo do corpo
 * ou query do frontend — sempre derive da sessao.
 */
export const EmpresaAtual = createParamDecorator(
  (_dados: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    if (!req.usuario) throw Erros.naoAutenticado();
    return req.usuario.empresaId;
  },
);
