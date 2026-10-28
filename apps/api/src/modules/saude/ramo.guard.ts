import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { RamoProduto } from '@arcco/contratos';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { Erros } from '../../common/erros/erros';

/** Impede que a operação comercial leia a clínica, e o contrário. */
@Injectable()
export class RamoGuard implements CanActivate {
  constructor(private readonly platform: PlatformPrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const caminho = req.url.split('?')[0] ?? '';
    if (caminho.startsWith('/api/autenticacao')) return true;
    if (!req.usuario) return true;

    const empresa = await this.platform.empresa.findUnique({
      where: { id: req.usuario.empresaId },
      select: { ramo: true },
    });
    const ramo = empresa?.ramo ?? RamoProduto.CONSTRUCAO;
    const areaSaude = caminho.startsWith('/api/saude');

    if (areaSaude && ramo !== RamoProduto.SAUDE) {
      throw Erros.semPermissao('Esta área pertence à operação clínica');
    }
    if (!areaSaude && ramo === RamoProduto.SAUDE) {
      throw Erros.semPermissao('Esta área pertence à operação comercial');
    }
    return true;
  }
}
