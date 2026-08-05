import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  criarObraSchema,
  atualizarObraSchema,
  paginacaoQuerySchema,
  vincularContatoObraSchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { ObrasService } from './obras.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';

type CriarObraInput = z.infer<typeof criarObraSchema>;

@Controller('obras')
export class ObrasController {
  constructor(private readonly servico: ObrasService) {}

  @Get()
  listar(
    @EmpresaAtual() empresaId: string,
    @Query(new ZodValidationPipe(paginacaoQuerySchema)) query: z.infer<typeof paginacaoQuerySchema>,
  ) {
    return this.servico.listar(empresaId, query);
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

  @Delete(':id/contatos/:vinculoId')
  desvincular(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Param('vinculoId') vinculoId: string,
  ) {
    return this.servico.desvincularContato(empresaId, id, vinculoId);
  }
}
