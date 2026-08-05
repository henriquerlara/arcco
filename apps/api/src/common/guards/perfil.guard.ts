import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { PERFIS_CHAVE } from '../decorators/perfis.decorator';
import { Erros } from '../erros/erros';
import type { PerfilUsuario } from '@arcco/contratos';

@Injectable()
export class PerfilGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const perfis = this.reflector.getAllAndOverride<PerfilUsuario[]>(PERFIS_CHAVE, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!perfis || perfis.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const usuario = req.usuario;
    if (!usuario) throw Erros.naoAutenticado();
    if (!perfis.includes(usuario.perfil)) throw Erros.semPermissao();
    return true;
  }
}
