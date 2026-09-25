import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { JwtService, COOKIE_ACCESS } from '../auth/jwt.service';
import { PUBLICO_CHAVE } from '../decorators/publico.decorator';
import { Erros } from '../erros/erros';
import type { PerfilUsuario } from '@arcco/contratos';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PlatformPrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(PUBLICO_CHAVE, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (publico) return true;

    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const token = this.extrairToken(req);
    if (!token) throw Erros.naoAutenticado();

    const conteudo = await this.jwt.verificarAccessToken(token);

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: conteudo.sub },
      select: {
        id: true,
        empresaId: true,
        nome: true,
        email: true,
        perfil: true,
        ativo: true,
        versaoSessao: true,
        deveTrocarSenha: true,
      },
    });

    if (!usuario || !usuario.ativo) throw Erros.naoAutenticado();
    if (usuario.versaoSessao !== conteudo.versaoSessao) {
      throw Erros.naoAutenticado('Sessao encerrada. Entre novamente');
    }

    req.usuario = {
      id: usuario.id,
      empresaId: usuario.empresaId,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil as PerfilUsuario,
      versaoSessao: usuario.versaoSessao,
      deveTrocarSenha: usuario.deveTrocarSenha,
    };
    return true;
  }

  private extrairToken(req: FastifyRequest): string | null {
    const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies;
    const doCookie = cookies?.[COOKIE_ACCESS];
    if (doCookie) return doCookie;

    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return null;
  }
}
