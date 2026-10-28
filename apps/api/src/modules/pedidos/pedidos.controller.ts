import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  cancelarPedidoSchema,
  converterOrcamentoPedidoSchema,
  marcarChecklistSchema,
  marcarPagamentoRecebidoSchema,
  moverPedidoKanbanSchema,
  PerfilUsuario,
} from '@arcco/contratos';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import type { UsuarioAutenticado } from '../../common/auth/tipos';
import { PermissoesService } from '../permissoes/permissoes.service';
import { PedidosService } from './pedidos.service';

@Controller('pedidos')
@Perfis(
  PerfilUsuario.PROPRIETARIO,
  PerfilUsuario.GESTOR,
  PerfilUsuario.VENDEDOR,
  PerfilUsuario.ATENDENTE,
)
export class PedidosController {
  constructor(
    private readonly servico: PedidosService,
    private readonly permissoes: PermissoesService,
  ) {}

  @Get('oportunidade/:oportunidadeId')
  listarPorOportunidade(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('oportunidadeId') oportunidadeId: string,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.listarPorOportunidade(empresaId, oportunidadeId),
    );
  }

  @Get('conversao/previsualizar/:orcamentoId')
  previsualizar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('orcamentoId') orcamentoId: string,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.previsualizarConversao(empresaId, orcamentoId, {
        id: usuario.id,
        perfil: usuario.perfil,
      }),
    );
  }

  @Post('converter')
  converter(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(converterOrcamentoPedidoSchema))
    corpo: unknown,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.converter(
        empresaId,
        corpo as Parameters<PedidosService['converter']>[1],
        { id: usuario.id, perfil: usuario.perfil },
      ),
    );
  }

  @Get(':id')
  obter(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.obter(empresaId, id));
  }

  @Post(':id/mover-kanban')
  moverKanban(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moverPedidoKanbanSchema)) corpo: unknown,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.moverKanban(
        empresaId,
        id,
        corpo as Parameters<PedidosService['moverKanban']>[2],
        { id: usuario.id, perfil: usuario.perfil },
      ),
    );
  }

  @Post(':id/cancelar')
  cancelar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelarPedidoSchema)) corpo: unknown,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.cancelar(
        empresaId,
        id,
        corpo as Parameters<PedidosService['cancelar']>[2],
        { id: usuario.id, perfil: usuario.perfil },
      ),
    );
  }

  @Patch(':id/pagamentos/:pagamentoId/receber')
  marcarPagamento(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Param('pagamentoId') pagamentoId: string,
    @Body(new ZodValidationPipe(marcarPagamentoRecebidoSchema)) corpo: unknown,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.marcarPagamentoRecebido(
        empresaId,
        id,
        pagamentoId,
        corpo as Parameters<PedidosService['marcarPagamentoRecebido']>[3],
        { id: usuario.id, perfil: usuario.perfil },
      ),
    );
  }

  @Patch(':id/checklist/:itemId')
  marcarChecklist(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(marcarChecklistSchema)) corpo: unknown,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.marcarChecklist(
        empresaId,
        id,
        itemId,
        corpo as Parameters<PedidosService['marcarChecklist']>[3],
        { id: usuario.id, perfil: usuario.perfil },
      ),
    );
  }

  @Post(':id/comissao/pagar')
  marcarComissao(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body() corpo: { formaPagamento?: string },
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.marcarComissaoPaga(empresaId, id, {
        id: usuario.id,
        perfil: usuario.perfil,
      }, corpo?.formaPagamento),
    );
  }
}
