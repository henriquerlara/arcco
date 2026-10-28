import { Body, Controller, Get, Patch } from '@nestjs/common';
import { EmpresasService } from './empresas.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import { PerfilUsuario } from '@arcco/contratos';
import type { UsuarioAutenticado } from '../../common/auth/tipos';
import {
  atualizarEmpresaSchema,
  atualizarOnboardingSchema,
  atualizarParametrosComerciaisSchema,
  type AtualizarEmpresaInput,
  type AtualizarOnboardingInput,
  type AtualizarParametrosComerciaisInput,
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

  /** ECOL-02 */
  @Get('parametros-comerciais')
  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  parametros(@EmpresaAtual() empresaId: string) {
    return this.servico.obterParametrosComerciais(empresaId);
  }

  @Patch('parametros-comerciais')
  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  atualizarParametros(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(atualizarParametrosComerciaisSchema))
    dto: AtualizarParametrosComerciaisInput,
  ) {
    return this.servico.atualizarParametrosComerciais(empresaId, dto, {
      id: usuario.id,
      perfil: usuario.perfil,
    });
  }
}
