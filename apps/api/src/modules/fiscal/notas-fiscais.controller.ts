import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PerfilUsuario } from '@arcco/contratos';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import { Publico } from '../../common/decorators/publico.decorator';
import type { UsuarioAutenticado } from '../../common/auth/tipos';
import { NotasFiscaisService } from './notas-fiscais.service';

@Controller()
export class NotasFiscaisController {
  constructor(private readonly notas: NotasFiscaisService) {}

  @Get('integrations/focus-nfe/status')
  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  statusIntegracao() {
    return this.notas.statusIntegracao();
  }

  @Get('orcamentos/:orcamentoId/notas-fiscais')
  listarPorOrcamento(
    @EmpresaAtual() empresaId: string,
    @Param('orcamentoId') orcamentoId: string,
  ) {
    return this.notas.listarPorOrcamento(empresaId, orcamentoId);
  }

  @Get('oportunidades/:oportunidadeId/notas-fiscais')
  listarPorOportunidade(
    @EmpresaAtual() empresaId: string,
    @Param('oportunidadeId') oportunidadeId: string,
  ) {
    return this.notas.listarPorOportunidade(empresaId, oportunidadeId);
  }

  @Get('notas-fiscais/:id')
  obter(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.notas.obter(empresaId, id);
  }

  @Post('orcamentos/:orcamentoId/emitir-nf')
  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  emitir(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('orcamentoId') orcamentoId: string,
  ) {
    return this.notas.emitirDeOrcamento(empresaId, orcamentoId, usuario.id);
  }

  @Post('notas-fiscais/:id/sincronizar')
  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  sincronizar(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.notas.sincronizar(empresaId, id);
  }

  /** Callback Focus NFe (público). */
  @Publico()
  @Post('webhooks/focus-nfe')
  webhook(@Body() body: Record<string, unknown>) {
    return this.notas.processarWebhook(body ?? {});
  }
}
