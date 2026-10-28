import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  criarContatoSchema,
  atualizarContatoSchema,
  paginacaoQuerySchema,
  PerfilUsuario,
  type criarContatoSchema as CriarSchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { ContatosService } from './contatos.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import type { UsuarioAutenticado } from '../../common/auth/tipos';

type CriarContatoInput = z.infer<typeof CriarSchema>;

@Controller('contatos')
export class ContatosController {
  constructor(
    private readonly servico: ContatosService,
    private readonly permissoes: PermissoesService,
  ) {}

  @Get()
  listar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query(new ZodValidationPipe(paginacaoQuerySchema)) query: z.infer<typeof paginacaoQuerySchema>,
    @Query('tipo') tipo?: string,
    @Query('natureza') natureza?: string,
    @Query('parceiro') parceiro?: string,
    @Query('cidade') cidade?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.listar(empresaId, { ...query, tipo, natureza, parceiro, cidade, de, ate }),
    );
  }

  /** ECOL-10b — declarada antes de `:id`. */
  @Get('comissoes')
  listarComissoes(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query(new ZodValidationPipe(paginacaoQuerySchema)) query: z.infer<typeof paginacaoQuerySchema>,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('parceiroId') parceiroId?: string,
    @Query('status') status?: string,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.listarComissoes(empresaId, {
        de,
        ate,
        parceiroId,
        status,
        pagina: query.pagina,
        porPagina: query.porPagina,
      }),
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

  @Post()
  criar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(criarContatoSchema)) dto: CriarContatoInput,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.criar(empresaId, dto));
  }

  @Patch(':id')
  atualizar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarContatoSchema)) dto: Partial<CriarContatoInput>,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.atualizar(empresaId, id, dto));
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  @Delete(':id')
  remover(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    return this.servico.remover(empresaId, id, { id: usuario.id, perfil: usuario.perfil });
  }
}
