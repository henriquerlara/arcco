import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { camposFinanceirosProibidos, publicarResposta } from '@arcco/contratos';
import type { FastifyRequest } from 'fastify';
import { Observable, map } from 'rxjs';
import { Erros } from '../../common/erros/erros';
import { PermissoesService } from './permissoes.service';

/**
 * Rede de segurança da ECOL-26a. O controller continua chamando filtrar de forma
 * explícita; esta camada cobre resposta, corpo e consulta mesmo se um endpoint
 * novo esquecer a chamada. No modo legado a publicação devolve o valor intacto.
 */
@Injectable()
export class PermissaoFinanceiraInterceptor implements NestInterceptor {
  constructor(private readonly permissoes: PermissoesService) {}

  async intercept(contexto: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = contexto.switchToHttp().getRequest<FastifyRequest>();
    if (!req.usuario) return next.handle();

    const ctx = await this.permissoes.resolver(req.usuario);
    const proibidos = [
      ...camposFinanceirosProibidos(ctx, req.body),
      ...camposFinanceirosProibidos(ctx, req.query),
    ];
    if (proibidos.length > 0) throw Erros.semPermissao();

    return next.handle().pipe(map((dados) => publicarResposta(ctx, dados)));
  }
}
