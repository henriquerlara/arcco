import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ModoAtendimento } from '@arcco/contratos';
import { ConversasService } from './conversas.service';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../../common/auth/tipos';

@Controller('conversas')
export class ConversasController {
  constructor(private readonly servico: ConversasService) {}

  @Get()
  listar(
    @EmpresaAtual() empresaId: string,
    @Query('pagina') pagina = '1',
    @Query('porPagina') porPagina = '20',
    @Query('status') status?: string,
    @Query('modo') modo?: string,
    @Query('busca') busca?: string,
  ) {
    return this.servico.listar(empresaId, {
      pagina: Number.parseInt(pagina, 10) || 1,
      porPagina: Number.parseInt(porPagina, 10) || 20,
      status,
      modo,
      busca,
    });
  }

  @Get('por-oportunidade/:oportunidadeId')
  porOportunidade(
    @EmpresaAtual() empresaId: string,
    @Param('oportunidadeId') oportunidadeId: string,
  ) {
    return this.servico.porOportunidade(empresaId, oportunidadeId);
  }

  @Get(':id')
  obter(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.obter(empresaId, id);
  }

  @Post(':id/assumir')
  assumir(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.servico.assumir(empresaId, id, usuario.id);
  }

  @Post(':id/transferir')
  transferir(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.transferirParaHumano(empresaId, id);
  }

  @Post(':id/modo/:modo')
  definirModo(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Param('modo') modo: ModoAtendimento,
  ) {
    return this.servico.definirModo(empresaId, id, modo);
  }

  @Post(':id/finalizar')
  finalizar(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.finalizar(empresaId, id);
  }

  @Post(':id/marcar-lida')
  marcarLida(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.marcarLida(empresaId, id);
  }
}
