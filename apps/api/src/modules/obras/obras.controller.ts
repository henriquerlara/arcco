import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  criarObraSchema,
  atualizarObraSchema,
  paginacaoQuerySchema,
  vincularContatoObraSchema,
  PerfilUsuario,
} from '@arcco/contratos';
import type { z } from 'zod';
import { ObrasService } from './obras.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';

type CriarObraInput = z.infer<typeof criarObraSchema>;

@Controller('obras')
export class ObrasController {
  constructor(private readonly servico: ObrasService) {}

  @Get()
  listar(
    @EmpresaAtual() empresaId: string,
    @Query(new ZodValidationPipe(paginacaoQuerySchema)) query: z.infer<typeof paginacaoQuerySchema>,
    @Query('status') status?: string,
  ) {
    return this.servico.listar(empresaId, { ...query, status });
  }

  @Get(':id')
  obter(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.obter(empresaId, id);
  }

  @Post()
  criar(
    @EmpresaAtual() empresaId: string,
    @Body(new ZodValidationPipe(criarObraSchema)) dto: CriarObraInput,
  ) {
    return this.servico.criar(empresaId, dto);
  }

  @Patch(':id')
  atualizar(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarObraSchema)) dto: Partial<CriarObraInput>,
  ) {
    return this.servico.atualizar(empresaId, id, dto);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  @Delete(':id')
  remover(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.remover(empresaId, id);
  }

  @Post(':id/contatos')
  vincular(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(vincularContatoObraSchema))
    dto: z.infer<typeof vincularContatoObraSchema>,
  ) {
    return this.servico.vincularContato(empresaId, id, dto);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  @Delete(':id/contatos/:vinculoId')
  desvincular(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Param('vinculoId') vinculoId: string,
  ) {
    return this.servico.desvincularContato(empresaId, id, vinculoId);
  }
}
