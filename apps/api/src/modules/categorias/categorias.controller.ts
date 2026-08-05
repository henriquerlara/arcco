import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  criarCategoriaSchema,
  atualizarCategoriaSchema,
  PerfilUsuario,
} from '@arcco/contratos';
import type { z } from 'zod';
import { CategoriasService } from './categorias.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';

type CriarCategoriaInput = z.infer<typeof criarCategoriaSchema>;

@Controller('categorias')
export class CategoriasController {
  constructor(private readonly servico: CategoriasService) {}

  @Get()
  listar(@EmpresaAtual() empresaId: string) {
    return this.servico.listar(empresaId);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Post()
  criar(
    @EmpresaAtual() empresaId: string,
    @Body(new ZodValidationPipe(criarCategoriaSchema)) dto: CriarCategoriaInput,
  ) {
    return this.servico.criar(empresaId, dto);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Patch(':id')
  atualizar(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarCategoriaSchema)) dto: Partial<CriarCategoriaInput>,
  ) {
    return this.servico.atualizar(empresaId, id, dto);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Delete(':id')
  remover(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.remover(empresaId, id);
  }
}
