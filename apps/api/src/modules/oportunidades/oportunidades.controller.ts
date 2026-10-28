import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  criarOportunidadeSchema,
  atualizarOportunidadeSchema,
  moverOportunidadeSchema,
  paginacaoQuerySchema,
  OrigemHistoricoEtapa,
  PerfilUsuario,
} from '@arcco/contratos';
import type { z } from 'zod';
import { OportunidadesService } from './oportunidades.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import type { UsuarioAutenticado } from '../../common/auth/tipos';
import { PermissoesService } from '../permissoes/permissoes.service';

type CriarOportunidadeInput = z.infer<typeof criarOportunidadeSchema>;

@Controller('oportunidades')
export class OportunidadesController {
  constructor(
    private readonly servico: OportunidadesService,
    private readonly permissoes: PermissoesService,
  ) {}

  @Get()
  listar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query(new ZodValidationPipe(paginacaoQuerySchema)) query: z.infer<typeof paginacaoQuerySchema>,
    @Query('etapaId') etapaId?: string,
    @Query('responsavelId') responsavelId?: string,
    @Query('categoriaId') categoriaId?: string,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.listar(
        empresaId,
        { ...query, etapaId, responsavelId, categoriaId },
        { id: usuario.id, perfil: usuario.perfil },
      ),
    );
  }

  @Get('kanban')
  kanban(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('responsavelId') responsavelId?: string,
    @Query('categoriaId') categoriaId?: string,
    @Query('parceiroId') parceiroId?: string,
    @Query('periodoDe') periodoDe?: string,
    @Query('periodoAte') periodoAte?: string,
    @Query('escopo') escopo?: 'pre' | 'pos' | 'todos',
    @Query('finalizadosDias') finalizadosDias?: string,
  ) {
    const dias =
      finalizadosDias === undefined || finalizadosDias === ''
        ? undefined
        : Number(finalizadosDias);
    return this.permissoes.filtrar(
      usuario,
      this.servico.kanban(
        empresaId,
        {
          responsavelId,
          categoriaId,
          parceiroId,
          periodoDe,
          periodoAte,
          escopo,
          finalizadosDias: Number.isFinite(dias) ? dias : undefined,
        },
        { id: usuario.id, perfil: usuario.perfil },
      ),
    );
  }

  @Get('kanban/buscar')
  buscarKanban(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('q') q?: string,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.buscarKanban(empresaId, q ?? ''),
    );
  }

  @Get(':id')
  obter(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.obter(empresaId, id, { id: usuario.id, perfil: usuario.perfil }),
    );
  }

  @Post()
  criar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(criarOportunidadeSchema)) dto: CriarOportunidadeInput,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.criar(empresaId, dto, {
        origemHistorico: OrigemHistoricoEtapa.CRIACAO,
        usuarioId: usuario.id,
      }),
    );
  }

  @Patch(':id')
  atualizar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarOportunidadeSchema))
    dto: z.infer<typeof atualizarOportunidadeSchema>,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.atualizar(empresaId, id, dto));
  }

  @Post(':id/mover')
  mover(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moverOportunidadeSchema))
    dto: z.infer<typeof moverOportunidadeSchema>,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.mover(empresaId, id, dto, {
        origem: OrigemHistoricoEtapa.MANUAL,
        usuarioId: usuario.id,
      }),
    );
  }

  @Post(':id/ajuste-corrigido')
  marcarAjusteCorrigido(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body() corpo?: { ajusteId?: string },
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.marcarAjusteCorrigido(empresaId, id, usuario.id, corpo?.ajusteId),
    );
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  @Delete(':id')
  remover(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    return this.permissoes.filtrar(usuario, this.servico.remover(empresaId, id));
  }
}
