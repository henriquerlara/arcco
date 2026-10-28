import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  atualizarFornecedorSchema,
  criarFornecedorSchema,
  PerfilUsuario,
} from '@arcco/contratos';
import type { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import type { UsuarioAutenticado } from '../../common/auth/tipos';
import { PermissoesService } from '../permissoes/permissoes.service';
import { FornecedoresService } from './fornecedores.service';

@Controller('fornecedores')
export class FornecedoresController {
  constructor(
    private readonly servico: FornecedoresService,
    private readonly permissoes: PermissoesService,
  ) {}

  @Get()
  listar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('busca') busca?: string,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.listar(empresaId, busca));
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  @Post()
  criar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(criarFornecedorSchema)) dto: z.infer<typeof criarFornecedorSchema>,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.criar(empresaId, dto));
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  @Patch('vinculo-produto/:produtoId')
  vincularProduto(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('produtoId') produtoId: string,
    @Body() corpo: { fornecedorId?: string | null },
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.vincularProduto(empresaId, produtoId, corpo.fornecedorId ?? null),
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

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  @Patch(':id')
  atualizar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarFornecedorSchema))
    dto: z.infer<typeof atualizarFornecedorSchema>,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.atualizar(empresaId, id, dto, usuario.id),
    );
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Delete(':id')
  remover(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.remover(empresaId, id));
  }
}
