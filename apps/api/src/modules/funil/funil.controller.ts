import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  criarEtapaFunilSchema,
  atualizarEtapaFunilSchema,
  reordenarEtapasSchema,
  excluirEtapaSchema,
  PerfilUsuario,
} from '@arcco/contratos';
import type { z } from 'zod';
import { FunilService } from './funil.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';

type CriarEtapaInput = z.infer<typeof criarEtapaFunilSchema>;

@Controller('funil/etapas')
export class FunilController {
  constructor(private readonly servico: FunilService) {}

  @Get()
  listar(@EmpresaAtual() empresaId: string) {
    return this.servico.listar(empresaId);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Post()
  criar(
    @EmpresaAtual() empresaId: string,
    @Body(new ZodValidationPipe(criarEtapaFunilSchema)) dto: CriarEtapaInput,
  ) {
    return this.servico.criar(empresaId, dto);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Post('reordenar')
  reordenar(
    @EmpresaAtual() empresaId: string,
    @Body(new ZodValidationPipe(reordenarEtapasSchema)) dto: z.infer<typeof reordenarEtapasSchema>,
  ) {
    return this.servico.reordenar(empresaId, dto);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Patch(':id')
  atualizar(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarEtapaFunilSchema)) dto: Partial<CriarEtapaInput>,
  ) {
    return this.servico.atualizar(empresaId, id, dto);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Delete(':id')
  excluir(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(excluirEtapaSchema)) dto: z.infer<typeof excluirEtapaSchema>,
  ) {
    return this.servico.excluir(empresaId, id, dto);
  }
}
