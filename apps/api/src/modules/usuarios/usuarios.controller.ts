import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  criarUsuarioSchema,
  redefinirSenhaUsuarioSchema,
  PerfilUsuario,
  type CriarUsuarioInput,
} from '@arcco/contratos';
import { UsuariosService } from './usuarios.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import { atualizarUsuarioSchema, type AtualizarUsuarioInput } from './usuarios.schemas';
import type { UsuarioAutenticado } from '../../common/auth/tipos';

@Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly servico: UsuariosService) {}

  @Get()
  listar(@EmpresaAtual() empresaId: string) {
    return this.servico.listar(empresaId);
  }

  @Get(':id')
  obter(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.obter(empresaId, id);
  }

  @Post()
  criar(
    @EmpresaAtual() empresaId: string,
    @Body(new ZodValidationPipe(criarUsuarioSchema)) dto: CriarUsuarioInput,
  ) {
    return this.servico.criar(empresaId, dto);
  }

  @Patch(':id')
  atualizar(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarUsuarioSchema)) dto: AtualizarUsuarioInput,
  ) {
    return this.servico.atualizar(empresaId, id, dto);
  }

  @Post(':id/redefinir-senha')
  redefinirSenha(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(redefinirSenhaUsuarioSchema)) dto: { senhaTemporaria: string },
  ) {
    return this.servico.redefinirSenha(empresaId, id, dto);
  }

  @Delete(':id')
  remover(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.servico.remover(empresaId, id, usuario.id);
  }
}
