import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  consultarAuditoriaQuerySchema,
  OrigemAuditoria,
  PerfilUsuario,
  type ConsultarAuditoriaQuery,
} from '@arcco/contratos';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import type { UsuarioAutenticado } from '../../common/auth/tipos';
import { AuditoriaService } from './auditoria.service';

const detalheQuerySchema = z.object({
  origem: z.enum([OrigemAuditoria.OPERACIONAL, OrigemAuditoria.PLATAFORMA]).optional(),
});

@Controller('auditoria')
@Perfis(PerfilUsuario.PROPRIETARIO)
export class AuditoriaController {
  constructor(private readonly servico: AuditoriaService) {}

  @Get()
  listar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query(new ZodValidationPipe(consultarAuditoriaQuerySchema)) query: ConsultarAuditoriaQuery,
  ) {
    return this.servico.listar(empresaId, usuario, query);
  }

  @Get(':id')
  obter(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(detalheQuerySchema))
    query: z.infer<typeof detalheQuerySchema>,
  ) {
    return this.servico.obter(empresaId, usuario, id, query.origem);
  }
}
