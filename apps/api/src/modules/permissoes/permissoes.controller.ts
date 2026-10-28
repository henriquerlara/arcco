import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { GRUPOS_PERMISSAO_UI, PERMISSOES_COMERCIAIS, PerfilUsuario } from '@arcco/contratos';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { UsuarioAutenticado } from '../../common/auth/tipos';
import { PermissoesService } from './permissoes.service';
import {
  aplicarConjuntoSchema,
  atualizarConjuntoSchema,
  criarConjuntoSchema,
  definirPermissoesSchema,
  type AplicarConjuntoInput,
  type AtualizarConjuntoInput,
  type CriarConjuntoInput,
  type DefinirPermissoesInput,
} from './permissoes.schemas';

@Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
@Controller('permissoes')
export class PermissoesController {
  constructor(private readonly servico: PermissoesService) {}

  @Get('catalogo')
  catalogo() {
    return {
      chaves: PERMISSOES_COMERCIAIS,
      grupos: GRUPOS_PERMISSAO_UI,
    };
  }

  @Get('usuarios/:usuarioId')
  async doUsuario(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('usuarioId') usuarioId: string,
  ) {
    await this.servico.assertAdministraPermissoes({
      id: usuario.id,
      empresaId,
      perfil: usuario.perfil,
    });
    return this.servico.listarDoUsuario(empresaId, usuarioId);
  }

  @Put('usuarios/:usuarioId')
  async definir(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('usuarioId') usuarioId: string,
    @Body(new ZodValidationPipe(definirPermissoesSchema)) dto: DefinirPermissoesInput,
  ) {
    return this.servico.definir(empresaId, usuarioId, dto.chaves, {
      id: usuario.id,
      empresaId,
      perfil: usuario.perfil,
    }, { conjuntoId: dto.conjuntoId });
  }

  @Get('conjuntos')
  async listarConjuntos(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    await this.servico.assertAdministraPermissoes({
      id: usuario.id,
      empresaId,
      perfil: usuario.perfil,
    });
    return this.servico.listarConjuntos(empresaId);
  }

  @Post('conjuntos')
  criarConjunto(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(criarConjuntoSchema)) dto: CriarConjuntoInput,
  ) {
    return this.servico.criarConjunto(empresaId, dto, {
      id: usuario.id,
      empresaId,
      perfil: usuario.perfil,
    });
  }

  @Patch('conjuntos/:id')
  atualizarConjunto(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarConjuntoSchema)) dto: AtualizarConjuntoInput,
  ) {
    return this.servico.atualizarConjunto(empresaId, id, dto, {
      id: usuario.id,
      empresaId,
      perfil: usuario.perfil,
    });
  }

  @Delete('conjuntos/:id')
  excluirConjunto(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    return this.servico.excluirConjunto(empresaId, id, {
      id: usuario.id,
      empresaId,
      perfil: usuario.perfil,
    });
  }

  @Post('conjuntos/:id/aplicar')
  aplicar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(aplicarConjuntoSchema)) dto: AplicarConjuntoInput,
  ) {
    return this.servico.aplicarConjunto(empresaId, id, dto.usuarioId, {
      id: usuario.id,
      empresaId,
      perfil: usuario.perfil,
    });
  }
}
