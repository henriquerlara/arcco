import { Controller, Get, Param, Query } from '@nestjs/common';
import { MensagensService } from './mensagens.service';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';

@Controller('conversas/:conversaId/mensagens')
export class MensagensController {
  constructor(private readonly servico: MensagensService) {}

  /** Endpoint de polling: informe `apos` (id da ultima mensagem) para receber apenas as novas. */
  @Get()
  listar(
    @EmpresaAtual() empresaId: string,
    @Param('conversaId') conversaId: string,
    @Query('apos') apos?: string,
    @Query('limite') limite?: string,
  ) {
    return this.servico.listar(empresaId, conversaId, {
      apos,
      limite: limite ? Number.parseInt(limite, 10) : undefined,
    });
  }
}
