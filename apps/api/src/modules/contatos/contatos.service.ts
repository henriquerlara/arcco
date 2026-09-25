import { Injectable } from '@nestjs/common';
import {
  criarRespostaPaginada,
  EntidadeCampoPersonalizado,
  TipoContato,
  type criarContatoSchema,
  type paginacaoQuerySchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
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
    private readonly platform: PlatformPrismaService,
    private readonly campos: CamposPersonalizadosService,
  ) {}

  async listar(empresaId: string, query: PaginacaoQuery & { tipo?: string }) {
    const where: Prisma.ContatoWhereInput = { empresaId };
    if (query.tipo && Object.values(TipoContato).includes(query.tipo as TipoContato)) {
      where.tipo = query.tipo as TipoContato;
    }
    const termo = query.busca?.trim();
    if (termo) {
      const like = `%${termo.toLocaleLowerCase('pt-BR').replace(/[%_]/g, '')}%`;
      const digitos = termo.replace(/\D+/g, '');
      const telefoneSql = digitos
        ? Prisma.sql`OR telefone LIKE ${'%' + digitos + '%'} OR "telefoneNormalizado" LIKE ${'%' + digitos + '%'}`
        : Prisma.empty;
      const ids = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM contatos
        WHERE "empresaId" = ${empresaId}
        AND (
          lower(nome) LIKE ${like}
          OR lower(COALESCE("empresaNome", '')) LIKE ${like}
          ${telefoneSql}
        )
      `;
      where.id = { in: ids.map((linha) => linha.id) };
    }

    const [dados, total] = await this.prisma.$transaction([
      this.prisma.contato.findMany({
        where,
        include: {
          _count: { select: { oportunidades: true, contatosObras: true } },
        },
        orderBy: { criadoEm: 'desc' },
        skip: (query.pagina - 1) * query.porPagina,
        take: query.porPagina,
      }),
      this.prisma.contato.count({ where }),
    ]);

    const mapeados = dados.map(({ _count, ...contato }) => ({
      ...contato,
      totalOportunidades: _count.oportunidades,
      totalObras: _count.contatosObras,
    }));

    return criarRespostaPaginada(mapeados, total, query.pagina, query.porPagina);
  }

  async obter(empresaId: string, id: string) {
    const contato = await this.prisma.contato.findFirst({
      where: { id, empresaId },
      include: {
        contatosObras: { include: { obra: true } },
        _count: { select: { oportunidades: true, contatosObras: true } },
        oportunidades: {
          select: { id: true, codigo: true, titulo: true, etapaId: true, valorEstimado: true },
          orderBy: { atualizadoEm: 'desc' },
          take: 20,
        },
      },
    });
    if (!contato) throw Erros.naoEncontrado('CONTATO_NAO_ENCONTRADO', 'Contato nao encontrado');

    const { _count, contatosObras, ...resto } = contato;
    let responsavel: { id: string; nome: string; email: string } | null = null;
    if (resto.responsavelId) {
      responsavel = await this.platform.usuario.findFirst({
        where: { id: resto.responsavelId, empresaId },
        select: { id: true, nome: true, email: true },
      });
    }
    return {
      ...resto,
      responsavel,
      obras: contatosObras.map((v) => ({
        id: v.id,
        papel: v.papel,
        obra: v.obra,
      })),
      totalOportunidades: _count.oportunidades,
      totalObras: _count.contatosObras,
    };
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
        documento: dto.documento?.replace(/\D/g, '') || null,
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
      documento:
        dto.documento === undefined
          ? undefined
          : dto.documento?.replace(/\D/g, '') || null,
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
