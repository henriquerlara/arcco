import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  cadastrarSchema,
  entrarSchema,
  trocarSenhaSchema,
  type CadastrarInput,
  type EntrarInput,
  type TrocarSenhaInput,
} from '@arcco/contratos';
import { AutenticacaoService } from './autenticacao.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Publico } from '../../common/decorators/publico.decorator';
import { UsuarioAtual } from '../../common/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../../common/auth/tipos';

function ipDe(req: FastifyRequest): string {
  const encaminhado = req.headers['x-forwarded-for'];
  if (typeof encaminhado === 'string' && encaminhado.length > 0) {
    return encaminhado.split(',')[0]!.trim();
  }
  return req.ip ?? 'desconhecido';
}

@Controller('autenticacao')
export class AutenticacaoController {
  constructor(private readonly servico: AutenticacaoService) {}

  @Publico()
  @Post('cadastrar')
  cadastrar(
    @Body(new ZodValidationPipe(cadastrarSchema)) dto: CadastrarInput,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    return this.servico.cadastrar(dto, ipDe(req), res);
  }

  @Publico()
  @Post('entrar')
  entrar(
    @Body(new ZodValidationPipe(entrarSchema)) dto: EntrarInput,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    return this.servico.entrar(dto, ipDe(req), res);
  }

  @Publico()
  @Post('renovar')
  renovar(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    return this.servico.renovar(req, res);
  }

  @Post('sair')
  sair(@UsuarioAtual() usuario: UsuarioAutenticado, @Res({ passthrough: true }) res: FastifyReply) {
    return this.servico.sair(usuario, res);
  }

  @Get('eu')
  eu(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servico.eu(usuario);
  }

  @Post('trocar-senha')
  trocarSenha(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body(new ZodValidationPipe(trocarSenhaSchema)) dto: TrocarSenhaInput,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    return this.servico.trocarSenha(usuario, dto, res);
  }
}
