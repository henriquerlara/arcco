import { Body, Controller, Get, Patch } from '@nestjs/common';
import { EmpresasService } from './empresas.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import { PerfilUsuario } from '@arcco/contratos';
import {
  atualizarEmpresaSchema,
  atualizarOnboardingSchema,
  type AtualizarEmpresaInput,
  type AtualizarOnboardingInput,
} from './empresas.schemas';

@Controller('empresa')
export class EmpresasController {
  constructor(private readonly servico: EmpresasService) {}

  @Get()
  obter(@EmpresaAtual() empresaId: string) {
    return this.servico.obter(empresaId);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Patch()
  atualizar(
    @EmpresaAtual() empresaId: string,
    @Body(new ZodValidationPipe(atualizarEmpresaSchema)) dto: AtualizarEmpresaInput,
  ) {
    return this.servico.atualizar(empresaId, dto);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Patch('onboarding')
  onboarding(
    @EmpresaAtual() empresaId: string,
    @Body(new ZodValidationPipe(atualizarOnboardingSchema)) dto: AtualizarOnboardingInput,
  ) {
    return this.servico.atualizarOnboarding(empresaId, dto);
  }
}
