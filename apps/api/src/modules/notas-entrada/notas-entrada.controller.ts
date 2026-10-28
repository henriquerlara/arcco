import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import {
  confirmarNotaEntradaSchema,
  PerfilUsuario,
  previsualizarNotaEntradaSchema,
  salvarPendenteNotaEntradaSchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import type { FastifyRequest } from 'fastify';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmpresaAtual } from '../../common/decorators/empresa-atual.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import { Perfis } from '../../common/decorators/perfis.decorator';
import type { UsuarioAutenticado } from '../../common/auth/tipos';
import { Erros } from '../../common/erros/erros';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ArquivosService } from '../arquivos/arquivos.service';
import { LIMITE_XML_BYTES } from './nfe-xml.parser';
import { NotasEntradaService } from './notas-entrada.service';

@Controller('notas-entrada')
@Perfis(PerfilUsuario.PROPRIETARIO, PerfilUsuario.GESTOR, PerfilUsuario.VENDEDOR)
export class NotasEntradaController {
  constructor(
    private readonly servico: NotasEntradaService,
    private readonly permissoes: PermissoesService,
    private readonly arquivos: ArquivosService,
  ) {}

  @Get()
  listar(@EmpresaAtual() empresaId: string, @UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.listar(empresaId, { id: usuario.id, perfil: usuario.perfil }),
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

  @Get(':id/xml')
  async baixarXml(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    const nota = await this.servico.obter(empresaId, id, {
      id: usuario.id,
      perfil: usuario.perfil,
    });
    if (!nota.arquivoXmlId) {
      throw Erros.naoEncontrado('XML_NAO_ENCONTRADO', 'XML desta nota nao esta disponivel');
    }
    const { arquivo, buffer } = await this.arquivos.conteudo(empresaId, nota.arquivoXmlId);
    return {
      nome: arquivo.nome,
      tipoMime: arquivo.tipoMime,
      base64: buffer.toString('base64'),
    };
  }

  @Post('previsualizar')
  previsualizar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(previsualizarNotaEntradaSchema))
    dto: z.infer<typeof previsualizarNotaEntradaSchema>,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.previsualizar(empresaId, dto.xml, {
        id: usuario.id,
        perfil: usuario.perfil,
      }),
    );
  }

  @Post('pendente')
  salvarPendente(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(salvarPendenteNotaEntradaSchema))
    dto: z.infer<typeof salvarPendenteNotaEntradaSchema>,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.salvarPendente(empresaId, dto, { id: usuario.id, perfil: usuario.perfil }),
    );
  }

  @Get(':id/conferencia')
  obterConferencia(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id') id: string,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.obterConferencia(empresaId, id, { id: usuario.id, perfil: usuario.perfil }),
    );
  }

  @Post('confirmar')
  confirmar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(confirmarNotaEntradaSchema))
    dto: z.infer<typeof confirmarNotaEntradaSchema>,
  ) {
    return this.permissoes.filtrar(
      usuario,
      this.servico.confirmar(empresaId, dto, { id: usuario.id, perfil: usuario.perfil }),
    );
  }

  @Post('confirmar-lote')
  confirmarLote(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() corpo: { notas?: z.infer<typeof confirmarNotaEntradaSchema>[] },
  ) {
    const notas = Array.isArray(corpo?.notas) ? corpo.notas : [];
    if (notas.length === 0) {
      throw Erros.invalido('LOTE_VAZIO', 'Envie ao menos uma nota para importar');
    }
    if (notas.length > 20) {
      throw Erros.invalido('LOTE_GRANDE', 'Maximo de 20 XMLs por lote');
    }
    for (const nota of notas) {
      confirmarNotaEntradaSchema.parse(nota);
    }
    return this.permissoes.filtrar(
      usuario,
      this.servico.confirmarLote(empresaId, notas, {
        id: usuario.id,
        perfil: usuario.perfil,
      }),
    );
  }

  /** Upload multipart: campo `xml` (arquivo). Só pré-visualiza. */
  @Post('upload-previsualizar')
  async uploadPrevisualizar(
    @EmpresaAtual() empresaId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() req: FastifyRequest,
  ) {
    const dados = await (req as FastifyRequest & {
      file: () => Promise<{ toBuffer: () => Promise<Buffer>; filename: string } | undefined>;
    }).file();
    if (!dados) throw Erros.invalido('XML_AUSENTE', 'Envie o arquivo XML');
    const buffer = await dados.toBuffer();
    if (buffer.length > LIMITE_XML_BYTES) {
      throw Erros.invalido('XML_GRANDE', `XML excede o limite de ${LIMITE_XML_BYTES} bytes`);
    }
    const xml = buffer.toString('utf8');
    return this.permissoes.filtrar(
      usuario,
      this.servico.previsualizar(empresaId, xml, {
        id: usuario.id,
        perfil: usuario.perfil,
      }),
    );
  }
}
