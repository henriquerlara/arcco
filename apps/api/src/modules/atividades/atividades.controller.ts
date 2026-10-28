import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  criarAtividadeSchema,
  atualizarAtividadeSchema,
  concluirEntregaSchema,
  concluirFollowUpSchema,
  paginacaoQuerySchema,
  PerfilUsuario,
} from '@arcco/contratos';
import type { z } from 'zod';
import { AtividadesService } from './atividades.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import type { UsuarioAutenticado } from '../../common/auth/tipos';
import { PermissoesService } from '../permissoes/permissoes.service';

@Controller('atividades')
export class AtividadesController {
  constructor(
    private readonly servico: AtividadesService,
    private readonly permissoes: PermissoesService,
  ) {}

  @Get()
  listar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query(new ZodValidationPipe(paginacaoQuerySchema)) query: z.infer<typeof paginacaoQuerySchema>,
    @Query('concluida') concluida?: string,
    @Query('responsavelId') responsavelId?: string,
    @Query('oportunidadeId') oportunidadeId?: string,
    @Query('pedidoId') pedidoId?: string,
    @Query('tipo') tipo?: string,
    @Query('atrasadas') atrasadas?: string,
    @Query('entregasAFazer') entregasAFazer?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.listar(
        empresaId,
        {
          ...query,
          concluida,
          responsavelId,
          oportunidadeId,
          pedidoId,
          tipo,
          atrasadas,
          entregasAFazer,
          de,
          ate,
        },
        { id: usuario.id, perfil: usuario.perfil },
      ),
    );
  }

  @Get('resumo-agenda')
  resumoAgenda(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('todas') todas?: string,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.resumoAgenda(
        empresaId,
        { id: usuario.id, perfil: usuario.perfil },
        { todas: todas === '1' || todas === 'true' },
      ),
    );
  }

  @Get('entrega/sugerir/:pedidoId')
  sugerirEntrega(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('pedidoId') pedidoId: string,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.sugerirEntrega(empresaId, pedidoId),
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
    @Body(new ZodValidationPipe(criarAtividadeSchema)) dto: z.infer<typeof criarAtividadeSchema>,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.criar(empresaId, usuario.id, dto),
    );
  }

  @Patch(':id')
  atualizar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarAtividadeSchema))
    dto: z.infer<typeof atualizarAtividadeSchema>,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.atualizar(empresaId, id, dto, { id: usuario.id, perfil: usuario.perfil }),
    );
  }

  @Post(':id/concluir')
  concluir(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.concluir(empresaId, id, usuario.id),
    );
  }

  @Post(':id/concluir-follow-up')
  concluirFollowUp(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(concluirFollowUpSchema))
    dto: z.infer<typeof concluirFollowUpSchema>,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.concluirFollowUp(empresaId, id, dto, usuario.id),
    );
  }

  @Post(':id/concluir-entrega')
  concluirEntrega(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(concluirEntregaSchema))
    dto: z.infer<typeof concluirEntregaSchema>,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.concluirEntrega(empresaId, id, dto, usuario.id),
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
