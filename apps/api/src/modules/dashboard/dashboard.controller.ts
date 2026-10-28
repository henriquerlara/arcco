import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { PermissoesService } from '../permissoes/permissoes.service';

import type { UsuarioAutenticado } from '../../common/auth/tipos';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly servico: DashboardService,
    private readonly permissoes: PermissoesService,
  ) {}

  @Get('metricas')
  metricas(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('dias') dias?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('chave') chave?: string,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.metricas(
        empresaId,
        {
          dias: dias ? Number.parseInt(dias, 10) : undefined,
          de: de ? new Date(de) : undefined,
          ate: ate ? new Date(ate) : undefined,
          chave,
        },
        { id: usuario.id, perfil: usuario.perfil },
      ),
    );
  }
}
