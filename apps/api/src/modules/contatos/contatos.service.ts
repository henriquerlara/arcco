import { Injectable } from '@nestjs/common';
import {
  criarRespostaPaginada,
  EntidadeCampoPersonalizado,
  type criarContatoSchema,
  type paginacaoQuerySchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { normalizarTelefone } from '../../common/utils/telefone';
import { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';

type CriarContatoInput = z.infer<typeof criarContatoSchema>;
type AtualizarContatoInput = Partial<CriarContatoInput>;
type PaginacaoQuery = z.infer<typeof paginacaoQuerySchema>;

@Injectable()
export class ContatosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campos: CamposPersonalizadosService,
  ) {}

  async listar(empresaId: string, query: PaginacaoQuery) {
    const where: Prisma.ContatoWhereInput = { empresaId };
    if (query.busca) {
      where.OR = [
        { nome: { contains: query.busca, mode: 'insensitive' } },
        { telefoneNormalizado: { contains: normalizarTelefone(query.busca) } },
        { empresaNome: { contains: query.busca, mode: 'insensitive' } },
      ];
    }

    const [dados, total] = await this.prisma.$transaction([
      this.prisma.contato.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (query.pagina - 1) * query.porPagina,
        take: query.porPagina,
      }),
      this.prisma.contato.count({ where }),
    ]);

    return criarRespostaPaginada(dados, total, query.pagina, query.porPagina);
  }

  async obter(empresaId: string, id: string) {
    const contato = await this.prisma.contato.findFirst({
      where: { id, empresaId },
      include: {
        contatosObras: { include: { obra: true } },
      },
    });
    if (!contato) throw Erros.naoEncontrado('CONTATO_NAO_ENCONTRADO', 'Contato nao encontrado');
    return contato;
  }

  async criar(empresaId: string, dto: CriarContatoInput) {
    const telefoneNormalizado = normalizarTelefone(dto.telefone);
    if (!telefoneNormalizado) {
      throw Erros.invalido('TELEFONE_INVALIDO', 'Telefone invalido');
    }

    const duplicado = await this.prisma.contato.findUnique({
      where: { empresaId_telefoneNormalizado: { empresaId, telefoneNormalizado } },
    });
    if (duplicado) {
      throw Erros.conflito('CONTATO_DUPLICADO', 'Ja existe um contato com este telefone');
    }

    const dadosPersonalizados = await this.campos.validarPara(
      empresaId,
      EntidadeCampoPersonalizado.CONTATO,
      dto.dadosPersonalizados,
    );

    return this.prisma.contato.create({
      data: {
        empresaId,
        nome: dto.nome,
        telefone: dto.telefone,
        telefoneNormalizado,
        email: dto.email || null,
        tipo: dto.tipo,
        empresaNome: dto.empresaNome ?? null,
        origem: dto.origem ?? null,
        observacoes: dto.observacoes ?? null,
        responsavelId: dto.responsavelId ?? null,
        dadosPersonalizados: dadosPersonalizados as object,
      },
    });
  }

  async atualizar(empresaId: string, id: string, dto: AtualizarContatoInput) {
    await this.obter(empresaId, id);

    const data: Prisma.ContatoUpdateInput = {
      nome: dto.nome,
      email: dto.email === '' ? null : dto.email,
      tipo: dto.tipo,
      empresaNome: dto.empresaNome,
      origem: dto.origem,
      observacoes: dto.observacoes,
      responsavelId: dto.responsavelId,
    };

    if (dto.telefone) {
      const telefoneNormalizado = normalizarTelefone(dto.telefone);
      const duplicado = await this.prisma.contato.findFirst({
        where: { empresaId, telefoneNormalizado, id: { not: id } },
      });
      if (duplicado) {
        throw Erros.conflito('CONTATO_DUPLICADO', 'Ja existe um contato com este telefone');
      }
      data.telefone = dto.telefone;
      data.telefoneNormalizado = telefoneNormalizado;
    }

    if (dto.dadosPersonalizados !== undefined) {
      data.dadosPersonalizados = (await this.campos.validarPara(
        empresaId,
        EntidadeCampoPersonalizado.CONTATO,
        dto.dadosPersonalizados,
      )) as object;
    }

    return this.prisma.contato.update({ where: { id }, data });
  }

  async remover(empresaId: string, id: string) {
    await this.obter(empresaId, id);
    await this.prisma.contato.delete({ where: { id } });
    return { ok: true };
  }
}
