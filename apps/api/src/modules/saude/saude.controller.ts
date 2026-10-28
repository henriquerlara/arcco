import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ajustarEstoqueMedicamentoSchema,
  atualizarConfiguracaoClinicaSchema,
  atualizarConsultaSchema,
  criarConsultaSchema,
  criarMedicamentoSchema,
  criarPacienteSchema,
  criarProfissionalSchema,
  StatusConsulta,
} from '@arcco/contratos';
import type { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { SaudeService } from './saude.service';

@Controller('saude')
export class SaudeController {
  constructor(private readonly servico: SaudeService) {}

  @Get('inicio')
  inicio(@EmpresaAtual() empresaId: string) {
    return this.servico.inicio(empresaId);
  }

  @Get('pacientes')
  pacientes(@EmpresaAtual() empresaId: string) {
    return this.servico.listarPacientes(empresaId);
  }

  @Post('pacientes')
  criarPaciente(
    @EmpresaAtual() empresaId: string,
    @Body(new ZodValidationPipe(criarPacienteSchema)) dto: z.infer<typeof criarPacienteSchema>,
  ) {
    return this.servico.criarPaciente(empresaId, dto);
  }

  @Get('profissionais')
  profissionais(@EmpresaAtual() empresaId: string) {
    return this.servico.listarProfissionais(empresaId);
  }

  @Post('profissionais')
  criarProfissional(
    @EmpresaAtual() empresaId: string,
    @Body(new ZodValidationPipe(criarProfissionalSchema)) dto: z.infer<typeof criarProfissionalSchema>,
  ) {
    return this.servico.criarProfissional(empresaId, dto);
  }

  @Get('agenda')
  agenda(@EmpresaAtual() empresaId: string, @Query('data') data?: string) {
    return this.servico.agenda(empresaId, data);
  }

  @Get('consultas')
  consultas(@EmpresaAtual() empresaId: string) {
    return this.servico.listarConsultas(empresaId);
  }

  @Post('consultas')
  criarConsulta(
    @EmpresaAtual() empresaId: string,
    @Body(new ZodValidationPipe(criarConsultaSchema)) dto: z.infer<typeof criarConsultaSchema>,
  ) {
    return this.servico.criarConsulta(empresaId, dto);
  }

  @Patch('consultas/:id')
  atualizarConsulta(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarConsultaSchema)) dto: { status: StatusConsulta },
  ) {
    return this.servico.atualizarConsulta(empresaId, id, dto.status);
  }

  @Get('medicamentos')
  medicamentos(@EmpresaAtual() empresaId: string) {
    return this.servico.listarMedicamentos(empresaId);
  }

  @Post('medicamentos')
  criarMedicamento(
    @EmpresaAtual() empresaId: string,
    @Body(new ZodValidationPipe(criarMedicamentoSchema)) dto: z.infer<typeof criarMedicamentoSchema>,
  ) {
    return this.servico.criarMedicamento(empresaId, dto);
  }

  @Patch('medicamentos/:id')
  ajustarEstoque(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ajustarEstoqueMedicamentoSchema)) dto: { estoque: number },
  ) {
    return this.servico.ajustarEstoque(empresaId, id, dto.estoque);
  }

  @Get('configuracao')
  configuracao(@EmpresaAtual() empresaId: string) {
    return this.servico.configuracao(empresaId);
  }

  @Patch('configuracao')
  atualizarConfiguracao(
    @EmpresaAtual() empresaId: string,
    @Body(new ZodValidationPipe(atualizarConfiguracaoClinicaSchema))
    dto: z.infer<typeof atualizarConfiguracaoClinicaSchema>,
  ) {
    return this.servico.atualizarConfiguracao(empresaId, dto);
  }
}
