import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly servico: DashboardService) {}

  @Get('metricas')
  metricas(
    @EmpresaAtual() empresaId: string,
    @Query('dias') dias?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    return this.servico.metricas(empresaId, {
      dias: dias ? Number.parseInt(dias, 10) : undefined,
      de: de ? new Date(de) : undefined,
      ate: ate ? new Date(ate) : undefined,
    });
  }
}
