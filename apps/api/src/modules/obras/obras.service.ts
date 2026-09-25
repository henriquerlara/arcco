import { Injectable } from '@nestjs/common';
import {
  criarRespostaPaginada,
  EntidadeCampoPersonalizado,
  StatusObra,
  type criarObraSchema,
  type paginacaoQuerySchema,
  type vincularContatoObraSchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';

type CriarObraInput = z.infer<typeof criarObraSchema>;
type AtualizarObraInput = Partial<CriarObraInput>;
type PaginacaoQuery = z.infer<typeof paginacaoQuerySchema>;
type VincularInput = z.infer<typeof vincularContatoObraSchema>;

@Injectable()
export class ObrasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campos: CamposPersonalizadosService,
  ) {}

  async listar(empresaId: string, query: PaginacaoQuery & { status?: string }) {
    const where: Prisma.ObraWhereInput = { empresaId };
    if (query.status && Object.values(StatusObra).includes(query.status as StatusObra)) {
      where.status = query.status as StatusObra;
    }
    if (query.busca) {
      where.OR = [
        { nome: { contains: query.busca } },
        { identificacao: { contains: query.busca } },
        { cidade: { contains: query.busca } },
      ];
    }

    const [dados, total] = await this.prisma.$transaction([
      this.prisma.obra.findMany({
        where,
        include: { _count: { select: { oportunidades: true } } },
        orderBy: { criadoEm: 'desc' },
        skip: (query.pagina - 1) * query.porPagina,
        take: query.porPagina,
      }),
      this.prisma.obra.count({ where }),
    ]);

    const mapeados = dados.map(({ _count, ...obra }) => ({
      ...obra,
      totalOportunidades: _count.oportunidades,
    }));

    return criarRespostaPaginada(mapeados, total, query.pagina, query.porPagina);
  }

  async obter(empresaId: string, id: string) {
    const obra = await this.prisma.obra.findFirst({
      where: { id, empresaId },
      include: {
        contatosObras: { include: { contato: true } },
        _count: { select: { oportunidades: true } },
      },
    });
    if (!obra) throw Erros.naoEncontrado('OBRA_NAO_ENCONTRADA', 'Obra nao encontrada');

    const { contatosObras, _count, ...resto } = obra;
    return {
      ...resto,
      contatos: contatosObras.map((v) => ({
        id: v.id,
        papel: v.papel,
        contato: v.contato,
      })),
      totalOportunidades: _count.oportunidades,
    };
  }

  async criar(empresaId: string, dto: CriarObraInput) {
    const dadosPersonalizados = await this.campos.validarPara(
      empresaId,
      EntidadeCampoPersonalizado.OBRA,
      dto.dadosPersonalizados,
    );

    return this.prisma.obra.create({
      data: {
        empresaId,
        nome: this.inferirNome(dto),
        identificacao: dto.identificacao ?? null,
        tipo: dto.tipo ?? null,
        status: dto.status,
        endereco: dto.endereco ?? null,
        bairro: dto.bairro ?? null,
        cidade: dto.cidade ?? null,
        estado: dto.estado ?? null,
        cep: dto.cep ?? null,
        previsao: dto.previsao ?? null,
        observacoes: dto.observacoes ?? null,
        dadosPersonalizados: dadosPersonalizados as object,
      },
    });
  }

  private inferirNome(dto: CriarObraInput): string {
    const informado = dto.nome?.trim();
    if (informado) return informado;
    const contexto = dto.identificacao?.trim() || dto.endereco?.trim();
    if (contexto) return contexto;
    const local = [dto.bairro?.trim(), dto.cidade?.trim()].filter(Boolean).join(' · ');
    return local || `Projeto de ${new Intl.DateTimeFormat('pt-BR').format(new Date())}`;
  }

  async atualizar(empresaId: string, id: string, dto: AtualizarObraInput) {
    await this.obter(empresaId, id);

    const data: Prisma.ObraUpdateInput = {
      nome: dto.nome,
      identificacao: dto.identificacao,
      tipo: dto.tipo,
      status: dto.status,
      endereco: dto.endereco,
      bairro: dto.bairro,
      cidade: dto.cidade,
      estado: dto.estado,
      cep: dto.cep,
      previsao: dto.previsao,
      observacoes: dto.observacoes,
    };

    if (dto.dadosPersonalizados !== undefined) {
      data.dadosPersonalizados = (await this.campos.validarPara(
        empresaId,
        EntidadeCampoPersonalizado.OBRA,
        dto.dadosPersonalizados,
      )) as object;
    }

    return this.prisma.obra.update({ where: { id }, data });
  }

  async remover(empresaId: string, id: string) {
    await this.obter(empresaId, id);
    await this.prisma.obra.delete({ where: { id } });
    return { ok: true };
  }

  async vincularContato(empresaId: string, obraId: string, dto: VincularInput) {
    await this.obter(empresaId, obraId);
    const contato = await this.prisma.contato.findFirst({
      where: { id: dto.contatoId, empresaId },
    });
    if (!contato) throw Erros.naoEncontrado('CONTATO_NAO_ENCONTRADO', 'Contato nao encontrado');

    try {
      return await this.prisma.contatoObra.create({
        data: { empresaId, obraId, contatoId: dto.contatoId, papel: dto.papel },
      });
    } catch {
      throw Erros.conflito('VINCULO_DUPLICADO', 'Este contato ja possui este papel na obra');
    }
  }

  async desvincularContato(empresaId: string, obraId: string, vinculoId: string) {
    const vinculo = await this.prisma.contatoObra.findFirst({
      where: { id: vinculoId, obraId, empresaId },
    });
    if (!vinculo) throw Erros.naoEncontrado('VINCULO_NAO_ENCONTRADO', 'Vinculo nao encontrado');
    await this.prisma.contatoObra.delete({ where: { id: vinculoId } });
    return { ok: true };
  }
}
