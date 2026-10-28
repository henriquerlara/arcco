import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  cancelarNfSchema,
  cartaCorrecaoNfSchema,
  emitirNfPedidoSchema,
  enviarEmailNfSchema,
  PerfilUsuario,
} from '@arcco/contratos';
import type { z } from 'zod';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import { Publico } from '../../common/decorators/publico.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { UsuarioAutenticado } from '../../common/auth/tipos';
import { NotasFiscaisService } from './notas-fiscais.service';
import { NfePedidoService } from './nfe-pedido.service';
import { PermissoesService } from '../permissoes/permissoes.service';

@Controller()
export class NotasFiscaisController {
  constructor(
    private readonly notas: NotasFiscaisService,
    private readonly nfePedido: NfePedidoService,
    private readonly permissoes: PermissoesService,
  ) {}

  @Get('integrations/focus-nfe/status')
  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  statusIntegracao() {
    return this.notas.statusIntegracao();
  }

  @Get('orcamentos/:orcamentoId/notas-fiscais')
  listarPorOrcamento(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('orcamentoId') orcamentoId: string,
  ) {
    return this.permissoes.filtrar(usuario, this.notas.listarPorOrcamento(empresaId, orcamentoId));
  }

  @Get('oportunidades/:oportunidadeId/notas-fiscais')
  listarPorOportunidade(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('oportunidadeId') oportunidadeId: string,
  ) {
    return this.permissoes.filtrar(usuario, this.notas.listarPorOportunidade(empresaId, oportunidadeId));
  }

  @Get('notas-fiscais/:id')
  obter(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    return this.permissoes.filtrar(usuario, this.notas.obter(empresaId, id));
  }

  @Post('orcamentos/:orcamentoId/emitir-nf')
  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  emitir(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('orcamentoId') orcamentoId: string,
  ) {
    return this.permissoes.filtrar(usuario, this.notas.emitirDeOrcamento(empresaId, orcamentoId, usuario.id));
  }

  /** ECOL-24 — preparação da NF-e a partir do pedido. */
  @Get('pedidos/:pedidoId/nfe/preparar')
  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  prepararPedido(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('pedidoId') pedidoId: string,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.nfePedido.preparar(empresaId, pedidoId, {
        id: usuario.id,
        empresaId,
        perfil: usuario.perfil,
      }),
    );
  }

  @Get('pedidos/:pedidoId/notas-fiscais')
  listarPorPedido(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('pedidoId') pedidoId: string,
  ) {
    return this.permissoes.filtrar(usuario, this.nfePedido.listarPorPedido(empresaId, pedidoId));
  }

  /** ECOL-25 — abas Fiscal. */
  @Get('fiscal/notas-emitidas')
  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  listarEmitidas(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.nfePedido.listarEmitidas(empresaId, {
        id: usuario.id,
        empresaId,
        perfil: usuario.perfil,
      }),
    );
  }

  @Get('fiscal/pendentes-emissao')
  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  listarPendentes(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.nfePedido.listarPendentesEmissao(empresaId, {
        id: usuario.id,
        empresaId,
        perfil: usuario.perfil,
      }),
    );
  }

  @Post('pedidos/:pedidoId/emitir-nf')
  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  emitirPedido(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('pedidoId') pedidoId: string,
    @Body(new ZodValidationPipe(emitirNfPedidoSchema))
    dto: z.infer<typeof emitirNfPedidoSchema>,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.nfePedido.emitir(empresaId, pedidoId, dto, {
        id: usuario.id,
        empresaId,
        perfil: usuario.perfil,
      }),
    );
  }

  @Post('notas-fiscais/:id/cancelar')
  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  cancelar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelarNfSchema)) dto: z.infer<typeof cancelarNfSchema>,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.nfePedido.cancelar(empresaId, id, dto, {
        id: usuario.id,
        empresaId,
        perfil: usuario.perfil,
      }),
    );
  }

  /** ECOL-28b — carta de correção (CC-e). Permissão CARTA_CORRECAO checada no serviço. */
  @Post('notas-fiscais/:id/carta-correcao')
  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  cartaCorrecao(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cartaCorrecaoNfSchema)) dto: z.infer<typeof cartaCorrecaoNfSchema>,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.nfePedido.cartaCorrecao(empresaId, id, dto, {
        id: usuario.id,
        empresaId,
        perfil: usuario.perfil,
      }),
    );
  }

  /** ECOL-28b — reenvio de DANFE/XML por e-mail (Focus). */
  @Post('notas-fiscais/:id/enviar-email')
  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  enviarEmail(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(enviarEmailNfSchema)) dto: z.infer<typeof enviarEmailNfSchema>,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.nfePedido.enviarEmailDanfe(empresaId, id, dto, {
        id: usuario.id,
        empresaId,
        perfil: usuario.perfil,
      }),
    );
  }

  /** ECOL-28b — status de homologação/emissão (sem segredos). */
  @Get('fiscal/status-homologacao')
  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  statusHomologacao(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.nfePedido.statusHomologacao(empresaId, {
        id: usuario.id,
        empresaId,
        perfil: usuario.perfil,
      }),
    );
  }

  @Post('notas-fiscais/:id/sincronizar')
  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  sincronizar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.notas.sincronizar(empresaId, id, usuario.id),
    );
  }

  /** Callback Focus NFe (público). */
  @Publico()
  @Post('webhooks/focus-nfe')
  webhook(@Body() body: Record<string, unknown>) {
    return this.notas.processarWebhook(body ?? {});
  }
}
