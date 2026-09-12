import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  criarProdutoSchema,
  atualizarProdutoSchema,
  entradaEstoqueSchema,
  ajusteEstoqueSchema,
  PerfilUsuario,
} from '@arcco/contratos';
import type { z } from 'zod';
import { ProdutosService } from './produtos.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import type { UsuarioAutenticado } from '../../common/auth/tipos';

@Controller('produtos')
export class ProdutosController {
  constructor(private readonly servico: ProdutosService) {}

  @Get('estoque/resumo')
  resumoEstoque(@EmpresaAtual() empresaId: string) {
    return this.servico.resumoEstoque(empresaId);
  }

  @Get('estoque')
  listarEstoque(
    @EmpresaAtual() empresaId: string,
    @Query('busca') busca?: string,
    @Query('criticos') criticos?: string,
    @Query('comControle') comControle?: string,
  ) {
    return this.servico.listarEstoque(empresaId, {
      busca,
      soCriticos: criticos === '1' || criticos === 'true',
      soComControle: comControle !== '0' && comControle !== 'false',
    });
  }

  @Get()
  listar(
    @EmpresaAtual() empresaId: string,
    @Query('ativos') ativos?: string,
  ) {
    return this.servico.listar(empresaId, ativos === '1' || ativos === 'true');
  }

  @Get(':id/movimentacoes')
  movimentacoes(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Query('limite') limite?: string,
  ) {
    return this.servico.listarMovimentacoes(
      empresaId,
      id,
      limite ? Number(limite) : 100,
    );
  }

  @Get(':id')
  obter(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.obter(empresaId, id);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  @Post()
  criar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(criarProdutoSchema)) dto: z.infer<typeof criarProdutoSchema>,
  ) {
    return this.servico.criar(empresaId, dto, usuario.id);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  @Patch(':id')
  atualizar(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarProdutoSchema))
    dto: z.infer<typeof atualizarProdutoSchema>,
  ) {
    return this.servico.atualizar(empresaId, id, dto);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Delete(':id')
  remover(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.remover(empresaId, id);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  @Post(':id/entrada')
  entrada(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(entradaEstoqueSchema)) dto: z.infer<typeof entradaEstoqueSchema>,
  ) {
    return this.servico.entrada(empresaId, id, dto, usuario.id);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  @Post(':id/ajuste')
  ajuste(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(ajusteEstoqueSchema)) dto: z.infer<typeof ajusteEstoqueSchema>,
  ) {
    return this.servico.ajuste(empresaId, id, dto, usuario.id);
  }
}
