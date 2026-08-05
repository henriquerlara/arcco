import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Erros } from '../erros/erros';
import type { UsuarioAutenticado } from '../auth/tipos';

export const UsuarioAtual = createParamDecorator(
  (_dados: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    if (!req.usuario) throw Erros.naoAutenticado();
    return req.usuario;
  },
);
