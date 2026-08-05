import { Injectable } from '@nestjs/common';
import {
  DirecaoMensagem,
  StatusMensagem,
  TipoMensagem,
} from '@arcco/contratos';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';

export interface RegistrarMensagemEntrada {
  direcao: DirecaoMensagem;
  conteudo: string;
  tipo?: TipoMensagem;
  status?: StatusMensagem;
  remetente?: string | null;
  autorUsuarioId?: string | null;
  idExterno?: string | null;
  arquivoId?: string | null;
  metadados?: Record<string, unknown> | null;
}

@Injectable()
export class MensagensService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(empresaId: string, conversaId: string, entrada: RegistrarMensagemEntrada) {
    // Idempotencia por idExterno (evita duplicar mensagens recebidas via webhook).
    if (entrada.idExterno) {
      const existente = await this.prisma.mensagem.findUnique({
        where: { conversaId_idExterno: { conversaId, idExterno: entrada.idExterno } },
      });
      if (existente) return existente;
    }

    const recebida = entrada.direcao === DirecaoMensagem.RECEBIDA;
    const preview = entrada.conteudo.slice(0, 120);

    const [mensagem] = await this.prisma.$transaction([
      this.prisma.mensagem.create({
        data: {
          empresaId,
          conversaId,
          direcao: entrada.direcao,
          tipo: entrada.tipo ?? TipoMensagem.TEXTO,
          conteudo: entrada.conteudo,
          status: entrada.status ?? (recebida ? StatusMensagem.RECEBIDA : StatusMensagem.ENVIADA),
          remetente: entrada.remetente ?? null,
          autorUsuarioId: entrada.autorUsuarioId ?? null,
          idExterno: entrada.idExterno ?? null,
          arquivoId: entrada.arquivoId ?? null,
          metadados: (entrada.metadados ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      }),
      this.prisma.conversa.update({
        where: { id: conversaId },
        data: {
          ultimaMensagemEm: new Date(),
          ultimaMensagemPreview: preview,
          ...(recebida ? { naoLidas: { increment: 1 } } : {}),
        },
      }),
    ]);

    return mensagem;
  }

  async listar(
    empresaId: string,
    conversaId: string,
    opcoes: { apos?: string; limite?: number } = {},
  ) {
    const conversa = await this.prisma.conversa.findFirst({
      where: { id: conversaId, empresaId },
      select: { id: true },
    });
    if (!conversa) throw Erros.naoEncontrado('CONVERSA_NAO_ENCONTRADA', 'Conversa nao encontrada');

    const where: Prisma.MensagemWhereInput = { conversaId, empresaId };
    if (opcoes.apos) {
      const referencia = await this.prisma.mensagem.findUnique({
        where: { id: opcoes.apos },
        select: { criadoEm: true },
      });
      if (referencia) where.criadoEm = { gt: referencia.criadoEm };
    }

    return this.prisma.mensagem.findMany({
      where,
      orderBy: { criadoEm: 'asc' },
      take: opcoes.limite ?? 200,
    });
  }
}
