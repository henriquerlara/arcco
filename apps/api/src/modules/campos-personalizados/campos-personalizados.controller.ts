import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  criarCampoPersonalizadoSchema,
  atualizarCampoPersonalizadoSchema,
  EntidadeCampoPersonalizado,
  PerfilUsuario,
} from '@arcco/contratos';
import type { z } from 'zod';
import { CamposPersonalizadosService } from './campos-personalizados.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';

type CriarCampoInput = z.infer<typeof criarCampoPersonalizadoSchema>;
type AtualizarCampoInput = z.infer<typeof atualizarCampoPersonalizadoSchema>;

@Controller('campos-personalizados')
export class CamposPersonalizadosController {
  constructor(private readonly servico: CamposPersonalizadosService) {}

  @Get()
  listar(
    @EmpresaAtual() empresaId: string,
    @Query('entidade') entidade?: EntidadeCampoPersonalizado,
  ) {
    return this.servico.listar(empresaId, entidade);
  }

  @Get(':id')
  obter(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.obter(empresaId, id);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Post()
  criar(
    @EmpresaAtual() empresaId: string,
    @Body(new ZodValidationPipe(criarCampoPersonalizadoSchema)) dto: CriarCampoInput,
  ) {
    return this.servico.criar(empresaId, dto);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Patch(':id')
  atualizar(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarCampoPersonalizadoSchema)) dto: AtualizarCampoInput,
  ) {
    return this.servico.atualizar(empresaId, id, dto);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Delete(':id')
  remover(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.remover(empresaId, id);
  }
}
