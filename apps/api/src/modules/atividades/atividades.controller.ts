import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  criarAtividadeSchema,
  atualizarAtividadeSchema,
  paginacaoQuerySchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { AtividadesService } from './atividades.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../../common/auth/tipos';

@Controller('atividades')
export class AtividadesController {
  constructor(private readonly servico: AtividadesService) {}

  @Get()
  listar(
    @EmpresaAtual() empresaId: string,
    @Query(new ZodValidationPipe(paginacaoQuerySchema)) query: z.infer<typeof paginacaoQuerySchema>,
    @Query('concluida') concluida?: string,
    @Query('responsavelId') responsavelId?: string,
    @Query('oportunidadeId') oportunidadeId?: string,
  ) {
    return this.servico.listar(empresaId, { ...query, concluida, responsavelId, oportunidadeId });
  }

  @Get(':id')
  obter(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.obter(empresaId, id);
  }

  @Post()
  criar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(criarAtividadeSchema)) dto: z.infer<typeof criarAtividadeSchema>,
  ) {
    return this.servico.criar(empresaId, usuario.id, dto);
  }

  @Patch(':id')
  atualizar(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarAtividadeSchema))
    dto: z.infer<typeof atualizarAtividadeSchema>,
  ) {
    return this.servico.atualizar(empresaId, id, dto);
  }

  @Post(':id/concluir')
  concluir(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.concluir(empresaId, id);
  }

  @Delete(':id')
  remover(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.remover(empresaId, id);
  }
}
