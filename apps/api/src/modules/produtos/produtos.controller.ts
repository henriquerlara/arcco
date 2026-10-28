import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  criarProdutoSchema,
  atualizarProdutoSchema,
  entradaEstoqueSchema,
  ajusteEstoqueSchema,
  PerfilUsuario,
  StatusEstoqueEcolume,
  TipoMovimentacaoEstoque,
} from '@arcco/contratos';
import type { z } from 'zod';
import { ProdutosService } from './produtos.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import type { UsuarioAutenticado } from '../../common/auth/tipos';
import { PermissoesService } from '../permissoes/permissoes.service';

const STATUS_VALIDOS = new Set(Object.values(StatusEstoqueEcolume));
const TIPOS_MOV = new Set(Object.values(TipoMovimentacaoEstoque));

@Controller('produtos')
export class ProdutosController {
  constructor(
    private readonly servico: ProdutosService,
    private readonly permissoes: PermissoesService,
  ) {}

  @Get('estoque/resumo')
  resumoEstoque(@EmpresaAtual() empresaId: string, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.permissoes.filtrar(usuario, this.servico.resumoEstoque(empresaId));
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Get('estoque/reconciliacao')
  reconciliar(@EmpresaAtual() empresaId: string, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.permissoes.filtrar(usuario, this.servico.reconciliar(empresaId));
  }

  @Get('estoque/movimentacoes')
  movimentacoesEstoque(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('produtoId') produtoId?: string,
    @Query('tipo') tipo?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('usuarioId') usuarioId?: string,
    @Query('limite') limite?: string,
  ) {
    const tipoOk =
      tipo && TIPOS_MOV.has(tipo as (typeof TipoMovimentacaoEstoque)[keyof typeof TipoMovimentacaoEstoque])
        ? (tipo as (typeof TipoMovimentacaoEstoque)[keyof typeof TipoMovimentacaoEstoque])
        : undefined;
    return this.permissoes.filtrar(
      usuario,
      this.servico.listarMovimentacoesEstoque(empresaId, {
        produtoId,
        tipo: tipoOk,
        de,
        ate,
        usuarioId,
        limite: limite ? Number(limite) : undefined,
      }),
    );
  }

  @Get('estoque/lista-compra')
  listaCompra(@EmpresaAtual() empresaId: string, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.permissoes.filtrar(usuario, this.servico.listaCompra(empresaId));
  }

  @Get('estoque')
  listarEstoque(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('busca') busca?: string,
    @Query('criticos') criticos?: string,
    @Query('comControle') comControle?: string,
    @Query('fornecedorId') fornecedorId?: string,
    @Query('status') status?: string,
  ) {
    const statusOk =
      status && STATUS_VALIDOS.has(status as (typeof StatusEstoqueEcolume)[keyof typeof StatusEstoqueEcolume])
        ? (status as (typeof StatusEstoqueEcolume)[keyof typeof StatusEstoqueEcolume])
        : undefined;
    return this.permissoes.filtrar(
      usuario,
      this.servico.listarEstoque(empresaId, {
        busca,
        soCriticos: criticos === '1' || criticos === 'true',
        soComControle: comControle !== '0' && comControle !== 'false',
        fornecedorId,
        status: statusOk,
      }),
    );
  }

  @Get()
  listar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('ativos') ativos?: string,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.listar(empresaId, ativos === '1' || ativos === 'true'));
  }

  @Get(':id/movimentacoes')
  movimentacoes(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Query('limite') limite?: string,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.listarMovimentacoes(empresaId, id, limite ? Number(limite) : 100),
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
  @Post()
  criar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(criarProdutoSchema)) dto: z.infer<typeof criarProdutoSchema>,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.criar(empresaId, dto, usuario.id));
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  @Patch(':id')
  atualizar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarProdutoSchema))
    dto: z.infer<typeof atualizarProdutoSchema>,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.atualizar(empresaId, id, dto, usuario.id));
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR)
  @Delete(':id')
  remover(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.remover(empresaId, id, { id: usuario.id, perfil: usuario.perfil }),
    );
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  @Post(':id/entrada')
  entrada(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(entradaEstoqueSchema)) dto: z.infer<typeof entradaEstoqueSchema>,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.entrada(empresaId, id, dto, usuario.id));
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  @Post(':id/ajuste')
  ajuste(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(ajusteEstoqueSchema)) dto: z.infer<typeof ajusteEstoqueSchema>,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.ajuste(empresaId, id, dto, { id: usuario.id, perfil: usuario.perfil }),
    );
  }
}
