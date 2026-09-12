import { Injectable } from '@nestjs/common';
import {
  criarRespostaPaginada,
  ModoAtendimento,
  StatusConversa,
  type EstadoBot,
} from '@arcco/contratos';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { normalizarTelefone } from '../../common/utils/telefone';

interface ResolverEntrada {
  telefone: string;
  nome?: string | null;
  conexaoId?: string | null;
}

@Injectable()
export class ConversasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    empresaId: string,
    opcoes: { pagina: number; porPagina: number; status?: string; modo?: string; busca?: string },
  ) {
    const where: Prisma.ConversaWhereInput = { empresaId };
    if (opcoes.status) where.status = opcoes.status as StatusConversa;
    if (opcoes.modo) where.modo = opcoes.modo as ModoAtendimento;
    if (opcoes.busca) {
      where.OR = [
        { nomeContato: { contains: opcoes.busca } },
        { telefoneNormalizado: { contains: normalizarTelefone(opcoes.busca) } },
      ];
    }

    const [dados, total] = await this.prisma.$transaction([
      this.prisma.conversa.findMany({
        where,
        include: { contato: { select: { id: true, nome: true } } },
        orderBy: { atualizadoEm: 'desc' },
        skip: (opcoes.pagina - 1) * opcoes.porPagina,
        take: opcoes.porPagina,
      }),
      this.prisma.conversa.count({ where }),
    ]);

    return criarRespostaPaginada(dados, total, opcoes.pagina, opcoes.porPagina);
  }

  async obter(empresaId: string, id: string) {
    const conversa = await this.prisma.conversa.findFirst({
      where: { id, empresaId },
      include: { contato: true },
    });
    if (!conversa) throw Erros.naoEncontrado('CONVERSA_NAO_ENCONTRADA', 'Conversa nao encontrada');
    const oportunidade = conversa.oportunidadeId
      ? await this.prisma.oportunidade.findFirst({
          where: { id: conversa.oportunidadeId, empresaId },
          include: { etapa: { select: { id: true, nome: true, tipo: true, chaveSistema: true } } },
        })
      : null;
    return { ...conversa, oportunidade };
  }

  /**
   * Conversa ligada à oportunidade (via oportunidadeId).
   * Fallback: conversa aberta do mesmo contato da oportunidade.
   */
  async porOportunidade(empresaId: string, oportunidadeId: string) {
    const porVinculo = await this.prisma.conversa.findFirst({
      where: { empresaId, oportunidadeId },
      include: { contato: true },
      orderBy: { atualizadoEm: 'desc' },
    });
    if (porVinculo) return porVinculo;

    const oportunidade = await this.prisma.oportunidade.findFirst({
      where: { id: oportunidadeId, empresaId },
      select: { contatoId: true },
    });
    if (!oportunidade?.contatoId) {
      throw Erros.naoEncontrado(
        'CONVERSA_NAO_ENCONTRADA',
        'Nenhuma conversa WhatsApp vinculada a esta oportunidade',
      );
    }

    const porContato = await this.prisma.conversa.findFirst({
      where: {
        empresaId,
        contatoId: oportunidade.contatoId,
        status: { not: StatusConversa.FINALIZADA },
      },
      include: { contato: true },
      orderBy: { atualizadoEm: 'desc' },
    });
    if (!porContato) {
      throw Erros.naoEncontrado(
        'CONVERSA_NAO_ENCONTRADA',
        'Nenhuma conversa WhatsApp vinculada a esta oportunidade',
      );
    }
    return porContato;
  }

  /** Encontra a conversa ativa pelo telefone ou cria uma nova (usado pelo WhatsApp). */
  async resolverOuCriar(empresaId: string, entrada: ResolverEntrada) {
    const telefoneNormalizado = normalizarTelefone(entrada.telefone);

    const contato = await this.prisma.contato.findUnique({
      where: { empresaId_telefoneNormalizado: { empresaId, telefoneNormalizado } },
    });

    let conversa = await this.prisma.conversa.findFirst({
      where: {
        empresaId,
        telefoneNormalizado,
        status: { not: StatusConversa.FINALIZADA },
      },
      orderBy: { atualizadoEm: 'desc' },
    });

    if (!conversa) {
      conversa = await this.prisma.conversa.create({
        data: {
          empresaId,
          conexaoId: entrada.conexaoId ?? null,
          contatoId: contato?.id ?? null,
          telefone: entrada.telefone,
          telefoneNormalizado,
          nomeContato: contato?.nome ?? entrada.nome ?? null,
          status: StatusConversa.BOT_ATENDENDO,
          modo: ModoAtendimento.BOT,
          estadoBot: { dadosColetados: {}, tentativas: 0 } as unknown as object,
        },
      });
    }

    return conversa;
  }

  async atualizarEstadoBot(id: string, estado: EstadoBot, intencao?: string | null) {
    return this.prisma.conversa.update({
      where: { id },
      data: {
        estadoBot: estado as unknown as object,
        ...(intencao !== undefined ? { intencaoAtual: intencao } : {}),
      },
    });
  }

  async vincularContato(id: string, contatoId: string) {
    return this.prisma.conversa.update({ where: { id }, data: { contatoId } });
  }

  async vincularOportunidade(id: string, oportunidadeId: string) {
    return this.prisma.conversa.update({ where: { id }, data: { oportunidadeId } });
  }

  async definirStatus(id: string, status: StatusConversa) {
    return this.prisma.conversa.update({ where: { id }, data: { status } });
  }

  async transferirParaHumano(empresaId: string, id: string) {
    await this.obter(empresaId, id);
    return this.prisma.conversa.update({
      where: { id },
      data: { modo: ModoAtendimento.HUMANO, status: StatusConversa.AGUARDANDO_HUMANO },
    });
  }

  async assumir(empresaId: string, id: string, atendenteId: string) {
    await this.obter(empresaId, id);
    return this.prisma.conversa.update({
      where: { id },
      data: {
        modo: ModoAtendimento.HUMANO,
        status: StatusConversa.EM_ATENDIMENTO,
        atendenteId,
        naoLidas: 0,
      },
    });
  }

  async definirModo(empresaId: string, id: string, modo: ModoAtendimento) {
    await this.obter(empresaId, id);
    const status =
      modo === ModoAtendimento.BOT
        ? StatusConversa.BOT_ATENDENDO
        : modo === ModoAtendimento.HUMANO
          ? StatusConversa.EM_ATENDIMENTO
          : StatusConversa.AGUARDANDO_CLIENTE;
    return this.prisma.conversa.update({ where: { id }, data: { modo, status } });
  }

  async finalizar(empresaId: string, id: string) {
    await this.obter(empresaId, id);
    return this.prisma.conversa.update({
      where: { id },
      data: { status: StatusConversa.FINALIZADA },
    });
  }

  async marcarLida(empresaId: string, id: string) {
    await this.obter(empresaId, id);
    return this.prisma.conversa.update({ where: { id }, data: { naoLidas: 0 } });
  }
}
