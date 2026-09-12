import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  criarOrcamentoSchema,
  atualizarOrcamentoSchema,
  enviarOrcamentoEstruturadoSchema,
  PerfilUsuario,
} from '@arcco/contratos';
import type { z } from 'zod';
import { OrcamentosService } from './orcamentos.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import type { UsuarioAutenticado } from '../../common/auth/tipos';
import { Erros } from '../../common/erros/erros';

@Controller('orcamentos')
export class OrcamentosController {
  constructor(
    private readonly servico: OrcamentosService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  @Get()
  listar(
    @EmpresaAtual() empresaId: string,
    @Query('oportunidadeId') oportunidadeId: string,
  ) {
    if (!oportunidadeId) {
      throw Erros.invalido('OPORTUNIDADE_OBRIGATORIA', 'Informe oportunidadeId');
    }
    return this.servico.listarPorOportunidade(empresaId, oportunidadeId);
  }

  @Get(':id')
  obter(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.obter(empresaId, id);
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
    return this.servico.criar(empresaId, usuario.id, dto);
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
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarOrcamentoSchema))
    dto: z.infer<typeof atualizarOrcamentoSchema>,
  ) {
    return this.servico.atualizar(empresaId, id, dto);
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
    return this.servico.gerarPdf(empresaId, id, usuario.id);
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
    const orcamento = await this.servico.prepararEnvio(empresaId, id, usuario.id);
    const envio = await this.whatsapp.enviarOrcamento(
      empresaId,
      orcamento.oportunidadeId,
      {
        texto: dto.texto,
        valorEstimado: orcamento.total,
        arquivoId: orcamento.arquivoId,
      },
      usuario.id,
    );
    return { orcamento, envio };
  }
}
