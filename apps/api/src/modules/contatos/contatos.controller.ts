import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  criarContatoSchema,
  atualizarContatoSchema,
  paginacaoQuerySchema,
  type criarContatoSchema as CriarSchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { ContatosService } from './contatos.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';

type CriarContatoInput = z.infer<typeof CriarSchema>;

@Controller('contatos')
export class ContatosController {
  constructor(private readonly servico: ContatosService) {}

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
    @Body(new ZodValidationPipe(criarContatoSchema)) dto: CriarContatoInput,
  ) {
    return this.servico.criar(empresaId, dto);
  }

  @Patch(':id')
  atualizar(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarContatoSchema)) dto: Partial<CriarContatoInput>,
  ) {
    return this.servico.atualizar(empresaId, id, dto);
  }

  @Delete(':id')
  remover(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.remover(empresaId, id);
  }
}
