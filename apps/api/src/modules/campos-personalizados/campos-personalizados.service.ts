import { Injectable } from '@nestjs/common';
import {
  EntidadeCampoPersonalizado,
  type criarCampoPersonalizadoSchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import {
  validarDadosPersonalizados,
  type DefinicaoCampo,
} from '../../common/utils/campos-personalizados';

type CriarCampoInput = z.infer<typeof criarCampoPersonalizadoSchema>;
type AtualizarCampoInput = Partial<CriarCampoInput>;

@Injectable()
export class CamposPersonalizadosService {
  constructor(private readonly prisma: PrismaService) {}

  listar(empresaId: string, entidade?: EntidadeCampoPersonalizado) {
    return this.prisma.campoPersonalizado.findMany({
      where: { empresaId, ...(entidade ? { entidade } : {}) },
      orderBy: [{ entidade: 'asc' }, { ordem: 'asc' }],
    });
  }

  async obter(empresaId: string, id: string) {
    const campo = await this.prisma.campoPersonalizado.findFirst({ where: { id, empresaId } });
    if (!campo) throw Erros.naoEncontrado('CAMPO_NAO_ENCONTRADO', 'Campo personalizado nao encontrado');
    return campo;
  }

  async criar(empresaId: string, dto: CriarCampoInput) {
    const existente = await this.prisma.campoPersonalizado.findUnique({
      where: {
        empresaId_entidade_chave: {
          empresaId,
          entidade: dto.entidade,
          chave: dto.chave,
        },
      },
    });
    if (existente) throw Erros.conflito('CHAVE_EM_USO', 'Ja existe um campo com esta chave');

    return this.prisma.campoPersonalizado.create({
      data: {
        empresaId,
        entidade: dto.entidade,
        chave: dto.chave,
        rotulo: dto.rotulo,
        descricao: dto.descricao ?? null,
        tipo: dto.tipo,
        obrigatorio: dto.obrigatorio ?? false,
        opcoes: dto.opcoes ?? [],
        ordem: dto.ordem ?? 0,
        ativo: dto.ativo ?? true,
        usarNoChatbot: dto.usarNoChatbot ?? false,
        textoPergunta: dto.textoPergunta ?? null,
        mostrarNoResumo: dto.mostrarNoResumo ?? true,
        permitirFiltro: dto.permitirFiltro ?? false,
      },
    });
  }

  async atualizar(empresaId: string, id: string, dto: AtualizarCampoInput) {
    await this.obter(empresaId, id);
    return this.prisma.campoPersonalizado.update({
      where: { id },
      data: {
        rotulo: dto.rotulo,
        descricao: dto.descricao,
        tipo: dto.tipo,
        obrigatorio: dto.obrigatorio,
        opcoes: dto.opcoes ?? undefined,
        ordem: dto.ordem,
        ativo: dto.ativo,
        usarNoChatbot: dto.usarNoChatbot,
        textoPergunta: dto.textoPergunta,
        mostrarNoResumo: dto.mostrarNoResumo,
        permitirFiltro: dto.permitirFiltro,
      },
    });
  }

  async remover(empresaId: string, id: string) {
    await this.obter(empresaId, id);
    await this.prisma.campoPersonalizado.delete({ where: { id } });
    return { ok: true };
  }

  async carregarDefinicoes(
    empresaId: string,
    entidade: EntidadeCampoPersonalizado,
  ): Promise<DefinicaoCampo[]> {
    const campos = await this.prisma.campoPersonalizado.findMany({
      where: { empresaId, entidade, ativo: true },
    });
    return campos.map((c) => ({
      chave: c.chave,
      rotulo: c.rotulo,
      tipo: c.tipo,
      obrigatorio: c.obrigatorio,
      opcoes: Array.isArray(c.opcoes) ? c.opcoes.filter((o): o is string => typeof o === 'string') : [],
      ativo: c.ativo,
    }));
  }

  /**
   * Valida os dadosPersonalizados de uma entidade. Lanca AppError 422 se invalidos.
   */
  async validarPara(
    empresaId: string,
    entidade: EntidadeCampoPersonalizado,
    dados: Record<string, unknown> | null | undefined,
  ): Promise<Record<string, unknown>> {
    const definicoes = await this.carregarDefinicoes(empresaId, entidade);
    const resultado = validarDadosPersonalizados(definicoes, dados);
    if (!resultado.valido) {
      throw Erros.invalido(
        'CAMPOS_PERSONALIZADOS_INVALIDOS',
        'Verifique os campos personalizados',
        resultado.erros,
      );
    }
    return resultado.dados;
  }
}
