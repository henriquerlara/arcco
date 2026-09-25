import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  criarContatoSchema,
  atualizarContatoSchema,
  paginacaoQuerySchema,
  PerfilUsuario,
  type criarContatoSchema as CriarSchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { ContatosService } from './contatos.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';

type CriarContatoInput = z.infer<typeof CriarSchema>;

@Controller('contatos')
export class ContatosController {
  constructor(private readonly servico: ContatosService) {}

  @Get()
  listar(
    @EmpresaAtual() empresaId: string,
    @Query(new ZodValidationPipe(paginacaoQuerySchema)) query: z.infer<typeof paginacaoQuerySchema>,
    @Query('tipo') tipo?: string,
  ) {
    return this.servico.listar(empresaId, { ...query, tipo });
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

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  @Delete(':id')
  remover(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.remover(empresaId, id);
  }
}
