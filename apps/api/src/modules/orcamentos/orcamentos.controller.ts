import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res } from '@nestjs/common';
import {
  criarOrcamentoSchema,
  atualizarOrcamentoSchema,
  enviarOrcamentoEstruturadoSchema,
  PerfilUsuario,
} from '@arcco/contratos';
import type { z } from 'zod';
import type { FastifyReply } from 'fastify';
import { OrcamentosService } from './orcamentos.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import type { UsuarioAutenticado } from '../../common/auth/tipos';
import { Erros } from '../../common/erros/erros';
import { PermissoesService } from '../permissoes/permissoes.service';

@Controller('orcamentos')
export class OrcamentosController {
  constructor(
    private readonly servico: OrcamentosService,
    private readonly permissoes: PermissoesService,
  ) {}

  @Get()
  listar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('oportunidadeId') oportunidadeId: string,
  ) {
    if (!oportunidadeId) {
      throw Erros.invalido('OPORTUNIDADE_OBRIGATORIA', 'Informe oportunidadeId');
    }
    return this.permissoes.filtrar(usuario, this.servico.listarPorOportunidade(empresaId, oportunidadeId));
  }

  @Get(':id')
  obter(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.obter(empresaId, id));
  }

  @Perfis(
    PerfilUsuario.PROPRIETARIO,
    PerfilUsuario.GESTOR,
    PerfilUsuario.VENDEDOR,
    PerfilUsuario.ATENDENTE,
  )
  @Post()
  criar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(criarOrcamentoSchema)) dto: z.infer<typeof criarOrcamentoSchema>,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.criar(empresaId, usuario, dto));
  }

  @Perfis(
    PerfilUsuario.PROPRIETARIO,
    PerfilUsuario.GESTOR,
    PerfilUsuario.VENDEDOR,
    PerfilUsuario.ATENDENTE,
  )
  @Patch(':id')
  atualizar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarOrcamentoSchema))
    dto: z.infer<typeof atualizarOrcamentoSchema>,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.atualizar(empresaId, id, dto, usuario));
  }

  @Perfis(
    PerfilUsuario.PROPRIETARIO,
    PerfilUsuario.GESTOR,
    PerfilUsuario.VENDEDOR,
    PerfilUsuario.ATENDENTE,
  )
  @Delete(':id')
  async excluir(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    return this.servico.excluir(empresaId, id, { id: usuario.id, perfil: usuario.perfil });
  }

  @Perfis(
    PerfilUsuario.PROPRIETARIO,
    PerfilUsuario.GESTOR,
    PerfilUsuario.VENDEDOR,
    PerfilUsuario.ATENDENTE,
  )
  @Post(':id/gerar-pdf')
  gerarPdf(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.gerarPdf(empresaId, id, usuario.id));
  }

  @Perfis(
    PerfilUsuario.PROPRIETARIO,
    PerfilUsuario.GESTOR,
    PerfilUsuario.VENDEDOR,
    PerfilUsuario.ATENDENTE,
  )
  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  async baixarPdf(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Res({ passthrough: false }) res: FastifyReply,
  ) {
    const { orcamento, buffer } = await this.servico.conteudoPdf(empresaId, id, usuario.id);
    const nome = `${orcamento.numero}.pdf`.replace(/[^\w.\-]+/g, '_');
    void res
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${nome}"`)
      .send(buffer);
  }

  @Perfis(
    PerfilUsuario.PROPRIETARIO,
    PerfilUsuario.GESTOR,
    PerfilUsuario.VENDEDOR,
    PerfilUsuario.ATENDENTE,
  )
  @Post(':id/duplicar')
  duplicar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.duplicar(empresaId, usuario, id));
  }

  @Perfis(
    PerfilUsuario.PROPRIETARIO,
    PerfilUsuario.GESTOR,
    PerfilUsuario.VENDEDOR,
    PerfilUsuario.ATENDENTE,
  )
  @Post(':id/marcar-enviado')
  marcarEnviado(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.marcarEnviado(empresaId, id));
  }

  @Perfis(
    PerfilUsuario.PROPRIETARIO,
    PerfilUsuario.GESTOR,
    PerfilUsuario.VENDEDOR,
    PerfilUsuario.ATENDENTE,
  )
  @Post(':id/marcar-recusado')
  marcarRecusado(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.marcarRecusado(empresaId, id));
  }

  @Perfis(
    PerfilUsuario.PROPRIETARIO,
    PerfilUsuario.GESTOR,
    PerfilUsuario.VENDEDOR,
    PerfilUsuario.ATENDENTE,
  )
  @Post(':id/enviar')
  async enviar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(enviarOrcamentoEstruturadoSchema))
    dto: z.infer<typeof enviarOrcamentoEstruturadoSchema>,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.enviar(empresaId, id, usuario.id, dto.texto));
  }
}
