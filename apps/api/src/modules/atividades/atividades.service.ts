import { Injectable } from '@nestjs/common';
import {
  criarRespostaPaginada,
  type criarAtividadeSchema,
  type atualizarAtividadeSchema,
  type paginacaoQuerySchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { EventosService, TipoEvento } from '../eventos/eventos.service';
import { lerAjustes, persistirAjustes } from '../../common/utils/ajustes-persistir';

type CriarAtividadeInput = z.infer<typeof criarAtividadeSchema>;
type AtualizarAtividadeInput = z.infer<typeof atualizarAtividadeSchema>;
type PaginacaoQuery = z.infer<typeof paginacaoQuerySchema> & {
  concluida?: string;
  responsavelId?: string;
  oportunidadeId?: string;
};

const INCLUDE_PADRAO = {
  contato: { select: { id: true, nome: true, telefone: true } },
  oportunidade: {
    select: {
      id: true,
      codigo: true,
      titulo: true,
      contato: { select: { id: true, nome: true, telefone: true } },
    },
  },
  obra: { select: { id: true, nome: true } },
} satisfies Prisma.AtividadeInclude;

@Injectable()
export class AtividadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventosService,
  ) {}

  async listar(empresaId: string, query: PaginacaoQuery) {
    const where: Prisma.AtividadeWhereInput = { empresaId };
    if (query.concluida === 'true') where.concluida = true;
    if (query.concluida === 'false') where.concluida = false;
    if (query.responsavelId) where.responsavelId = query.responsavelId;
    if (query.oportunidadeId) where.oportunidadeId = query.oportunidadeId;

    const [dados, total] = await this.prisma.$transaction([
      this.prisma.atividade.findMany({
        where,
        include: INCLUDE_PADRAO,
        orderBy: [{ concluida: 'asc' }, { vencimento: 'asc' }],
        skip: (query.pagina - 1) * query.porPagina,
        take: query.porPagina,
      }),
      this.prisma.atividade.count({ where }),
    ]);

    return criarRespostaPaginada(dados, total, query.pagina, query.porPagina);
  }

  async obter(empresaId: string, id: string) {
    const atividade = await this.prisma.atividade.findFirst({
      where: { id, empresaId },
      include: INCLUDE_PADRAO,
    });
    if (!atividade) throw Erros.naoEncontrado('ATIVIDADE_NAO_ENCONTRADA', 'Atividade nao encontrada');
    return atividade;
  }

  async criar(empresaId: string, responsavelPadrao: string, dto: CriarAtividadeInput) {
    let contatoId = dto.contatoId ?? null;
    if (!contatoId && dto.oportunidadeId) {
      const oportunidade = await this.prisma.oportunidade.findFirst({
        where: { id: dto.oportunidadeId, empresaId },
        select: { contatoId: true },
      });
      contatoId = oportunidade?.contatoId ?? null;
    }

    const criada = await this.prisma.atividade.create({
      data: {
        empresaId,
        tipo: dto.tipo,
        titulo: dto.titulo,
        descricao: dto.descricao ?? null,
        vencimento: dto.vencimento,
        responsavelId: dto.responsavelId ?? responsavelPadrao,
        oportunidadeId: dto.oportunidadeId ?? null,
        contatoId,
        obraId: dto.obraId ?? null,
      },
      include: INCLUDE_PADRAO,
    });
    if (criada.oportunidadeId) {
      await this.eventos.registrar(this.prisma, {
        empresaId,
        oportunidadeId: criada.oportunidadeId,
        tipo: TipoEvento.ATIVIDADE_CRIADA,
        titulo: `Próxima ação: ${criada.titulo}`,
        descricao: `Prevista para ${criada.vencimento.toLocaleString('pt-BR')}`,
        origem: 'USUARIO',
        usuarioId: responsavelPadrao,
      });
      await this.eventos.sincronizarProximaAcao(empresaId, criada.oportunidadeId);
    }
    return criada;
  }

  async atualizar(empresaId: string, id: string, dto: AtualizarAtividadeInput) {
    const atual = await this.obter(empresaId, id);

    const data: Prisma.AtividadeUncheckedUpdateInput = {
      tipo: dto.tipo,
      titulo: dto.titulo,
      descricao: dto.descricao,
      vencimento: dto.vencimento,
      responsavelId: dto.responsavelId,
      oportunidadeId: dto.oportunidadeId,
      contatoId: dto.contatoId,
      obraId: dto.obraId,
    };

    if (dto.concluida !== undefined && dto.concluida !== atual.concluida) {
      data.concluida = dto.concluida;
      data.concluidaEm = dto.concluida ? new Date() : null;
    }

    const atualizada = await this.prisma.atividade.update({ where: { id }, data, include: INCLUDE_PADRAO });
    const oportunidades = new Set([atual.oportunidadeId, atualizada.oportunidadeId].filter(Boolean));
    for (const oportunidadeId of oportunidades) {
      await this.eventos.sincronizarProximaAcao(empresaId, oportunidadeId!);
    }
    if (dto.concluida === true && !atual.concluida && atualizada.oportunidadeId) {
      await this.eventos.registrar(this.prisma, {
        empresaId,
        oportunidadeId: atualizada.oportunidadeId,
        tipo: TipoEvento.ATIVIDADE_CONCLUIDA,
        titulo: atualizada.titulo,
        descricao: 'Ação concluída',
        origem: 'USUARIO',
      });
      if (atualizada.tipo === 'REVISAR_ORCAMENTO') {
        await this.marcarAjusteCorrigidoNaOportunidade(
          empresaId,
          atualizada.oportunidadeId,
          atualizada.descricao,
        );
      }
    }
    return atualizada;
  }

  async concluir(empresaId: string, id: string) {
    const atual = await this.obter(empresaId, id);
    const concluida = await this.prisma.atividade.update({
      where: { id },
      data: { concluida: true, concluidaEm: new Date() },
      include: INCLUDE_PADRAO,
    });
    if (atual.oportunidadeId) {
      await this.eventos.registrar(this.prisma, {
        empresaId,
        oportunidadeId: atual.oportunidadeId,
        tipo: TipoEvento.ATIVIDADE_CONCLUIDA,
        titulo: atual.titulo,
        descricao: 'Ação concluída',
        origem: 'USUARIO',
      });
      if (concluida.tipo === 'REVISAR_ORCAMENTO') {
        await this.marcarAjusteCorrigidoNaOportunidade(
          empresaId,
          atual.oportunidadeId,
          atual.descricao,
        );
      }
      await this.eventos.sincronizarProximaAcao(empresaId, atual.oportunidadeId);
    }
    return concluida;
  }

  async remover(empresaId: string, id: string) {
    const atual = await this.obter(empresaId, id);
    await this.prisma.atividade.delete({ where: { id } });
    if (atual.oportunidadeId) {
      await this.eventos.sincronizarProximaAcao(empresaId, atual.oportunidadeId);
    }
    return { ok: true };
  }

  private async marcarAjusteCorrigidoNaOportunidade(
    empresaId: string,
    oportunidadeId: string,
    texto?: string | null,
  ) {
    const atual = await this.prisma.oportunidade.findFirst({
      where: { id: oportunidadeId, empresaId },
      select: { descricao: true, dadosPersonalizados: true },
    });
    if (!atual) return;
    const atuais = { ...((atual.dadosPersonalizados ?? {}) as Record<string, unknown>) };
    const ajustes = lerAjustes(atuais, atual.descricao);
    if (ajustes.length === 0) {
      atuais.ajuste_status = 'corrigido';
      await this.prisma.oportunidade.update({
        where: { id: oportunidadeId },
        data: { dadosPersonalizados: atuais as object },
      });
      return;
    }

    const alvo =
      (texto?.trim()
        ? ajustes.find((item) => item.status === 'pendente' && item.texto === texto.trim())
        : undefined) ?? ajustes.find((item) => item.status === 'pendente');
    if (!alvo) return;
    alvo.status = 'corrigido';
    const dados = persistirAjustes(atuais, ajustes);
    await this.prisma.oportunidade.update({
      where: { id: oportunidadeId },
      data: { dadosPersonalizados: dados as object },
    });
  }
}
