import { Controller, Delete, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { PerfilUsuario } from '@arcco/contratos';
import { ArquivosService } from './arquivos.service';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import { Erros } from '../../common/erros/erros';
import type { UsuarioAutenticado } from '../../common/auth/tipos';

interface ArquivoMultipart {
  filename: string;
  mimetype: string;
  toBuffer: () => Promise<Buffer>;
  fields: Record<string, { value?: string } | undefined>;
}

interface RequestMultipart {
  file(): Promise<ArquivoMultipart | undefined>;
}

@Controller('arquivos')
export class ArquivosController {
  constructor(private readonly servico: ArquivosService) {}

  @Get()
  listar(
    @EmpresaAtual() empresaId: string,
    @Query('entidade') entidade?: string,
    @Query('entidadeId') entidadeId?: string,
  ) {
    return this.servico.listar(empresaId, entidade, entidadeId);
  }

  @Get(':id')
  obter(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.obter(empresaId, id);
  }

  @Get(':id/url')
  url(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.urlAssinada(empresaId, id);
  }

  @Post('upload')
  async enviar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    const dados = await (req as unknown as RequestMultipart).file();
    if (!dados) throw Erros.invalido('ARQUIVO_AUSENTE', 'Nenhum arquivo enviado');
    const conteudo = await dados.toBuffer();
    return this.servico.enviar(empresaId, usuario.id, {
      nome: dados.filename,
      tipoMime: dados.mimetype,
      conteudo,
      entidade: dados.fields?.entidade?.value,
      entidadeId: dados.fields?.entidadeId?.value,
    });
  }

  @Get(':id/conteudo')
  async conteudo(
    @EmpresaAtual() empresaId: string,
    @Param('id') id: string,
    @Res() res: FastifyReply,
  ) {
    const { arquivo, buffer } = await this.servico.conteudo(empresaId, id);
    res
      .header('Content-Type', arquivo.tipoMime)
      .header('Content-Disposition', `inline; filename="${arquivo.nome}"`)
      .send(buffer);
  }

  @Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
  @Delete(':id')
  remover(@EmpresaAtual() empresaId: string, @Param('id') id: string) {
    return this.servico.remover(empresaId, id);
  }
}
