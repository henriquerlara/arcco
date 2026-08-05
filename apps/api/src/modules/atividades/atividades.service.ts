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

type CriarAtividadeInput = z.infer<typeof criarAtividadeSchema>;
type AtualizarAtividadeInput = z.infer<typeof atualizarAtividadeSchema>;
type PaginacaoQuery = z.infer<typeof paginacaoQuerySchema> & {
  concluida?: string;
  responsavelId?: string;
  oportunidadeId?: string;
};

const INCLUDE_PADRAO = {
  contato: { select: { id: true, nome: true } },
  oportunidade: { select: { id: true, codigo: true, titulo: true } },
  obra: { select: { id: true, nome: true } },
} satisfies Prisma.AtividadeInclude;

@Injectable()
export class AtividadesService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.atividade.create({
      data: {
        empresaId,
        tipo: dto.tipo,
        titulo: dto.titulo,
        descricao: dto.descricao ?? null,
        vencimento: dto.vencimento,
        responsavelId: dto.responsavelId ?? responsavelPadrao,
        oportunidadeId: dto.oportunidadeId ?? null,
        contatoId: dto.contatoId ?? null,
        obraId: dto.obraId ?? null,
      },
      include: INCLUDE_PADRAO,
    });
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

    return this.prisma.atividade.update({ where: { id }, data, include: INCLUDE_PADRAO });
  }

  async concluir(empresaId: string, id: string) {
    await this.obter(empresaId, id);
    return this.prisma.atividade.update({
      where: { id },
      data: { concluida: true, concluidaEm: new Date() },
      include: INCLUDE_PADRAO,
    });
  }

  async remover(empresaId: string, id: string) {
    await this.obter(empresaId, id);
    await this.prisma.atividade.delete({ where: { id } });
    return { ok: true };
  }
}
