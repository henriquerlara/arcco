import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import type { FastifyReply } from 'fastify';
import { AppError } from './erros';

interface CorpoErro {
  erro: {
    codigo: string;
    mensagem: string;
    detalhes?: unknown;
  };
}

@Catch()
export class FiltroExcecaoGlobal implements ExceptionFilter {
  private readonly logger = new Logger('Excecao');

  catch(excecao: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const resposta = ctx.getResponse<FastifyReply>();

    let status = 500;
    let corpo: CorpoErro = {
      erro: { codigo: 'ERRO_INTERNO', mensagem: 'Ocorreu um erro inesperado' },
    };

    if (excecao instanceof AppError) {
      status = excecao.status;
      corpo = {
        erro: { codigo: excecao.codigo, mensagem: excecao.message, detalhes: excecao.detalhes },
      };
    } else if (excecao instanceof ZodError) {
      status = 422;
      corpo = {
        erro: {
          codigo: 'DADOS_INVALIDOS',
          mensagem: 'Verifique os dados enviados',
          detalhes: excecao.flatten(),
        },
      };
    } else if (excecao instanceof HttpException) {
      status = excecao.getStatus();
      const resp = excecao.getResponse();
      const mensagem =
        typeof resp === 'string'
          ? resp
          : ((resp as { message?: string | string[] }).message ?? excecao.message);
      corpo = {
        erro: {
          codigo: 'ERRO_HTTP',
          mensagem: Array.isArray(mensagem) ? mensagem.join('; ') : String(mensagem),
        },
      };
    } else if (excecao instanceof Prisma.PrismaClientKnownRequestError) {
      // Nunca expor internals do Prisma; traduzir codigos comuns.
      if (excecao.code === 'P2002') {
        status = 409;
        corpo = { erro: { codigo: 'REGISTRO_DUPLICADO', mensagem: 'Registro ja existe' } };
      } else if (excecao.code === 'P2025') {
        status = 404;
        corpo = { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Registro nao encontrado' } };
      } else {
        status = 400;
        corpo = { erro: { codigo: 'ERRO_BANCO', mensagem: 'Nao foi possivel completar a operacao' } };
      }
      this.logger.error(`Prisma ${excecao.code}: ${excecao.message}`);
    } else if (excecao instanceof Error) {
      this.logger.error(excecao.message, excecao.stack);
    } else {
      this.logger.error(`Excecao desconhecida: ${JSON.stringify(excecao)}`);
    }

    resposta.status(status).send(corpo);
  }
}
