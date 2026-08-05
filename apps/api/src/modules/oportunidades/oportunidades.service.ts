import { Injectable } from '@nestjs/common';
import {
  criarRespostaPaginada,
  EntidadeCampoPersonalizado,
  OrigemHistoricoEtapa,
  TipoEtapaFunil,
  type criarOportunidadeSchema,
  type moverOportunidadeSchema,
  type paginacaoQuerySchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { avaliarTransicaoEtapa } from '../../common/utils/funil';
import { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';

type CriarOportunidadeInput = z.infer<typeof criarOportunidadeSchema>;
type AtualizarOportunidadeInput = Partial<CriarOportunidadeInput> & { motivoPerda?: string | null };
type MoverInput = z.infer<typeof moverOportunidadeSchema>;
type PaginacaoQuery = z.infer<typeof paginacaoQuerySchema> & {
  etapaId?: string;
  responsavelId?: string;
  categoriaId?: string;
};

export interface OpcoesCriarOportunidade {
  origemHistorico?: OrigemHistoricoEtapa;
  usuarioId?: string | null;
  /** Resolve etapa por chaveSistema (ex.: QUALIFICACAO). Ignorado se dto.etapaId estiver setado. */
  chaveSistemaEtapa?: string;
}

export interface OpcoesMoverOportunidade {
  origem?: OrigemHistoricoEtapa;
  usuarioId?: string | null;
}

const INCLUDE_PADRAO = {
  contato: { select: { id: true, nome: true, telefone: true } },
  etapa: { select: { id: true, nome: true, tipo: true, ordem: true, chaveSistema: true } },
  categoria: { select: { id: true, nome: true } },
  obra: { select: { id: true, nome: true } },
} satisfies Prisma.OportunidadeInclude;

const INCLUDE_DETALHE = {
  ...INCLUDE_PADRAO,
  historicoEtapas: { orderBy: { criadoEm: 'asc' as const } },
} satisfies Prisma.OportunidadeInclude;

@Injectable()
export class OportunidadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campos: CamposPersonalizadosService,
  ) {}

  async listar(empresaId: string, query: PaginacaoQuery) {
    const where: Prisma.OportunidadeWhereInput = { empresaId };
    if (query.etapaId) where.etapaId = query.etapaId;
    if (query.responsavelId) where.responsavelId = query.responsavelId;
    if (query.categoriaId) where.categoriaId = query.categoriaId;
    if (query.busca) {
      where.OR = [
        { titulo: { contains: query.busca, mode: 'insensitive' } },
        { codigo: { contains: query.busca, mode: 'insensitive' } },
        { contato: { nome: { contains: query.busca, mode: 'insensitive' } } },
      ];
    }

    const [dados, total] = await this.prisma.$transaction([
      this.prisma.oportunidade.findMany({
        where,
        include: INCLUDE_PADRAO,
        orderBy: { criadoEm: 'desc' },
        skip: (query.pagina - 1) * query.porPagina,
        take: query.porPagina,
      }),
      this.prisma.oportunidade.count({ where }),
    ]);

    return criarRespostaPaginada(dados, total, query.pagina, query.porPagina);
  }

  /** Agrupa oportunidades por etapa para exibicao em kanban. */
  async kanban(empresaId: string) {
    const [etapas, oportunidades] = await this.prisma.$transaction([
      this.prisma.etapaFunil.findMany({ where: { empresaId, ativo: true }, orderBy: { ordem: 'asc' } }),
      this.prisma.oportunidade.findMany({
        where: { empresaId, fechadaEm: null },
        include: INCLUDE_PADRAO,
        orderBy: { atualizadoEm: 'desc' },
      }),
    ]);

    return etapas.map((etapa) => ({
      etapa,
      oportunidades: oportunidades.filter((o) => o.etapaId === etapa.id),
    }));
  }

  async obter(empresaId: string, id: string) {
    const oportunidade = await this.prisma.oportunidade.findFirst({
      where: { id, empresaId },
      include: INCLUDE_DETALHE,
    });
    if (!oportunidade) {
      throw Erros.naoEncontrado('OPORTUNIDADE_NAO_ENCONTRADA', 'Oportunidade nao encontrada');
    }

    // Oportunidades anteriores à timeline: registra a etapa atual como ponto inicial.
    if (oportunidade.historicoEtapas.length === 0) {
      await this.prisma.historicoEtapaOportunidade.create({
        data: {
          empresaId,
          oportunidadeId: id,
          etapaId: oportunidade.etapaId,
          etapaNome: oportunidade.etapa.nome,
          origem: OrigemHistoricoEtapa.CRIACAO,
          criadoEm: oportunidade.criadoEm,
        },
      });
      return this.prisma.oportunidade.findFirstOrThrow({
        where: { id, empresaId },
        include: INCLUDE_DETALHE,
      });
    }

    return oportunidade;
  }

  private async proximoCodigo(empresaId: string): Promise<string> {
    const total = await this.prisma.oportunidade.count({ where: { empresaId } });
    return `OP-${String(total + 1).padStart(4, '0')}`;
  }

  private async resolverEtapa(
    empresaId: string,
    etapaId?: string | null,
    chaveSistema?: string | null,
  ) {
    if (etapaId) {
      const etapa = await this.prisma.etapaFunil.findFirst({ where: { id: etapaId, empresaId } });
      if (!etapa) throw Erros.naoEncontrado('ETAPA_NAO_ENCONTRADA', 'Etapa nao encontrada');
      return etapa;
    }
    if (chaveSistema) {
      const porChave = await this.prisma.etapaFunil.findFirst({
        where: { empresaId, chaveSistema, ativo: true },
      });
      if (porChave) return porChave;
    }
    const primeira = await this.prisma.etapaFunil.findFirst({
      where: { empresaId, ativo: true, tipo: TipoEtapaFunil.ABERTA },
      orderBy: { ordem: 'asc' },
    });
    if (!primeira) throw Erros.invalido('FUNIL_VAZIO', 'Configure ao menos uma etapa aberta');
    return primeira;
  }

  async criar(
    empresaId: string,
    dto: CriarOportunidadeInput,
    opcoes: OpcoesCriarOportunidade = {},
  ) {
    const contato = await this.prisma.contato.findFirst({
      where: { id: dto.contatoId, empresaId },
    });
    if (!contato) throw Erros.naoEncontrado('CONTATO_NAO_ENCONTRADO', 'Contato nao encontrado');

    const etapa = await this.resolverEtapa(empresaId, dto.etapaId, opcoes.chaveSistemaEtapa);
    const codigo = await this.proximoCodigo(empresaId);
    const dadosPersonalizados = await this.campos.validarPara(
      empresaId,
      EntidadeCampoPersonalizado.OPORTUNIDADE,
      dto.dadosPersonalizados,
    );

    const origemHistorico = opcoes.origemHistorico ?? OrigemHistoricoEtapa.CRIACAO;

    return this.prisma.$transaction(async (tx) => {
      const criada = await tx.oportunidade.create({
        data: {
          empresaId,
          codigo,
          titulo: dto.titulo,
          contatoId: dto.contatoId,
          obraId: dto.obraId ?? null,
          categoriaId: dto.categoriaId ?? null,
          etapaId: etapa.id,
          responsavelId: dto.responsavelId ?? null,
          descricao: dto.descricao ?? null,
          origem: dto.origem ?? null,
          prioridade: dto.prioridade,
          valorEstimado: dto.valorEstimado ?? null,
          previsaoFechamento: dto.previsaoFechamento ?? null,
          proximaAcao: dto.proximaAcao ?? null,
          dataProximaAcao: dto.dataProximaAcao ?? null,
          codigoOrcamento: dto.codigoOrcamento ?? null,
          dadosPersonalizados: dadosPersonalizados as object,
        },
        include: INCLUDE_PADRAO,
      });

      await tx.historicoEtapaOportunidade.create({
        data: {
          empresaId,
          oportunidadeId: criada.id,
          etapaId: etapa.id,
          etapaNome: etapa.nome,
          origem: origemHistorico,
          usuarioId: opcoes.usuarioId ?? null,
        },
      });

      return criada;
    });
  }

  async atualizar(empresaId: string, id: string, dto: AtualizarOportunidadeInput) {
    await this.obter(empresaId, id);

    const data: Prisma.OportunidadeUpdateInput = {
      titulo: dto.titulo,
      descricao: dto.descricao,
      origem: dto.origem,
      prioridade: dto.prioridade,
      valorEstimado: dto.valorEstimado,
      previsaoFechamento: dto.previsaoFechamento,
      proximaAcao: dto.proximaAcao,
      dataProximaAcao: dto.dataProximaAcao,
      codigoOrcamento: dto.codigoOrcamento,
      motivoPerda: dto.motivoPerda,
    };

    if (dto.contatoId) {
      const contato = await this.prisma.contato.findFirst({
        where: { id: dto.contatoId, empresaId },
      });
      if (!contato) throw Erros.naoEncontrado('CONTATO_NAO_ENCONTRADO', 'Contato nao encontrado');
      data.contato = { connect: { id: dto.contatoId } };
    }
    if (dto.obraId !== undefined) {
      data.obra = dto.obraId ? { connect: { id: dto.obraId } } : { disconnect: true };
    }
    if (dto.categoriaId !== undefined) {
      data.categoria = dto.categoriaId ? { connect: { id: dto.categoriaId } } : { disconnect: true };
    }
    if (dto.responsavelId !== undefined) {
      data.responsavelId = dto.responsavelId;
    }

    if (dto.dadosPersonalizados !== undefined) {
      data.dadosPersonalizados = (await this.campos.validarPara(
        empresaId,
        EntidadeCampoPersonalizado.OPORTUNIDADE,
        dto.dadosPersonalizados,
      )) as object;
    }

    return this.prisma.oportunidade.update({ where: { id }, data, include: INCLUDE_PADRAO });
  }

  async mover(
    empresaId: string,
    id: string,
    dto: MoverInput,
    opcoes: OpcoesMoverOportunidade = {},
  ) {
    const atual = await this.prisma.oportunidade.findFirst({
      where: { id, empresaId },
      include: { etapa: true },
    });
    if (!atual) {
      throw Erros.naoEncontrado('OPORTUNIDADE_NAO_ENCONTRADA', 'Oportunidade nao encontrada');
    }

    if (atual.etapaId === dto.etapaId) {
      return this.obter(empresaId, id);
    }

    const destino = await this.prisma.etapaFunil.findFirst({
      where: { id: dto.etapaId, empresaId },
    });

    const transicao = avaliarTransicaoEtapa(
      destino ? { id: destino.id, tipo: destino.tipo, ativo: destino.ativo } : null,
      dto.motivoPerda,
    );

    if (!transicao.permitido || !destino) {
      throw Erros.invalido('TRANSICAO_INVALIDA', transicao.erro ?? 'Transicao invalida');
    }

    const origem = opcoes.origem ?? OrigemHistoricoEtapa.MANUAL;

    return this.prisma.$transaction(async (tx) => {
      await tx.oportunidade.update({
        where: { id },
        data: {
          etapaId: dto.etapaId,
          fechadaEm: transicao.fechadaEm,
          motivoPerda: transicao.motivoPerda,
        },
      });

      await tx.historicoEtapaOportunidade.create({
        data: {
          empresaId,
          oportunidadeId: id,
          etapaId: destino.id,
          etapaNome: destino.nome,
          etapaAnteriorId: atual.etapaId,
          etapaAnteriorNome: atual.etapa.nome,
          origem,
          usuarioId: opcoes.usuarioId ?? null,
        },
      });

      return tx.oportunidade.findFirstOrThrow({
        where: { id, empresaId },
        include: INCLUDE_DETALHE,
      });
    });
  }

  /**
   * Avança para a etapa com a chaveSistema dada, apenas se a ordem atual for menor
   * (não regride). Retorna null se não houver mudança.
   */
  async moverPorChave(
    empresaId: string,
    oportunidadeId: string,
    chaveSistema: string,
    origem: OrigemHistoricoEtapa,
    usuarioId?: string | null,
  ) {
    const destino = await this.prisma.etapaFunil.findFirst({
      where: { empresaId, chaveSistema, ativo: true },
    });
    if (!destino) return null;

    const atual = await this.prisma.oportunidade.findFirst({
      where: { id: oportunidadeId, empresaId },
      include: { etapa: true },
    });
    if (!atual) return null;
    if (atual.etapaId === destino.id) return null;
    if (atual.etapa.ordem >= destino.ordem) return null;

    return this.mover(
      empresaId,
      oportunidadeId,
      { etapaId: destino.id },
      { origem, usuarioId },
    );
  }

  async remover(empresaId: string, id: string) {
    await this.obter(empresaId, id);
    await this.prisma.oportunidade.delete({ where: { id } });
    return { ok: true };
  }
}
