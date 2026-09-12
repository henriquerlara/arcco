import { Injectable } from '@nestjs/common';
import {
  criarRespostaPaginada,
  EntidadeCampoPersonalizado,
  OrigemHistoricoEtapa,
  StatusOrcamento,
  TipoAtividade,
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
import { EventosService, TipoEvento } from '../eventos/eventos.service';
import { ProdutosService } from '../produtos/produtos.service';
import { lerAjustes, persistirAjustes } from '../../common/utils/ajustes-persistir';

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
  eventos: { orderBy: { criadoEm: 'desc' as const } },
  atividades: {
    where: { concluida: false },
    orderBy: { vencimento: 'asc' as const },
    take: 5,
  },
  orcamentos: {
    include: {
      itens: { orderBy: { ordem: 'asc' as const } },
    },
    orderBy: { versao: 'desc' as const },
  },
} satisfies Prisma.OportunidadeInclude;

@Injectable()
export class OportunidadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campos: CamposPersonalizadosService,
    private readonly eventos: EventosService,
    private readonly produtos: ProdutosService,
  ) {}

  async listar(empresaId: string, query: PaginacaoQuery) {
    const where: Prisma.OportunidadeWhereInput = { empresaId };
    if (query.etapaId) where.etapaId = query.etapaId;
    if (query.responsavelId) where.responsavelId = query.responsavelId;
    if (query.categoriaId) where.categoriaId = query.categoriaId;
    if (query.busca) {
      where.OR = [
        { titulo: { contains: query.busca } },
        { codigo: { contains: query.busca } },
        { contato: { nome: { contains: query.busca } } },
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

  /** Agrupa oportunidades por etapa para exibicao em kanban (inclui Fechado/Perdido). */
  async kanban(empresaId: string) {
    const [etapas, oportunidades] = await this.prisma.$transaction([
      this.prisma.etapaFunil.findMany({ where: { empresaId, ativo: true }, orderBy: { ordem: 'asc' } }),
      this.prisma.oportunidade.findMany({
        where: { empresaId },
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
      await this.eventos.registrar(this.prisma, {
        empresaId,
        oportunidadeId: id,
        tipo: TipoEvento.OPORTUNIDADE_CRIADA,
        titulo: 'Oportunidade criada',
        descricao: `Entrada em ${oportunidade.etapa.nome}`,
        origem: OrigemHistoricoEtapa.CRIACAO,
        criadoEm: oportunidade.criadoEm,
      });
      return this.prisma.oportunidade.findFirstOrThrow({
        where: { id, empresaId },
        include: INCLUDE_DETALHE,
      });
    }

    if (oportunidade.eventos.length === 0) {
      await this.prisma.eventoOportunidade.createMany({
        data: oportunidade.historicoEtapas.map((item, indice) => ({
          empresaId,
          oportunidadeId: id,
          tipo: indice === 0 ? TipoEvento.OPORTUNIDADE_CRIADA : TipoEvento.ETAPA_ALTERADA,
          titulo: item.etapaAnteriorNome
            ? `${item.etapaAnteriorNome} → ${item.etapaNome}`
            : 'Oportunidade criada',
          descricao: item.etapaAnteriorNome ? `Entrada em ${item.etapaNome}` : `Entrada em ${item.etapaNome}`,
          origem: item.origem,
          usuarioId: item.usuarioId,
          criadoEm: item.criadoEm,
        })),
      });
      return this.prisma.oportunidade.findFirstOrThrow({
        where: { id, empresaId },
        include: INCLUDE_DETALHE,
      });
    }

    return oportunidade;
  }

  private async proximoCodigo(empresaId: string): Promise<string> {
    const ultima = await this.prisma.oportunidade.findFirst({
      where: { empresaId },
      select: { codigo: true },
      orderBy: { codigo: 'desc' },
    });
    const sequencia = Number(ultima?.codigo.match(/(\d+)$/)?.[1] ?? 0) + 1;
    return `OP-${String(sequencia).padStart(4, '0')}`;
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
    // Identidade do negócio = número do pedido (sem nome descritivo).
    const titulo = codigo;
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
          titulo,
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

      await this.eventos.registrar(tx, {
        empresaId,
        oportunidadeId: criada.id,
        tipo: TipoEvento.OPORTUNIDADE_CRIADA,
        titulo: 'Oportunidade criada',
        descricao: `Entrada em ${etapa.nome}`,
        origem: origemHistorico,
        usuarioId: opcoes.usuarioId,
      });

      return criada;
    });
  }

  async atualizar(empresaId: string, id: string, dto: AtualizarOportunidadeInput) {
    const atual = await this.obter(empresaId, id);

    const data: Prisma.OportunidadeUpdateInput = {
      // Título do negócio é sempre o número do pedido.
      titulo: dto.titulo === undefined ? undefined : atual.codigo,
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

  /** Marca um ajuste (ou todos, se sem id) como feito. */
  async marcarAjusteCorrigido(
    empresaId: string,
    id: string,
    usuarioId?: string,
    ajusteId?: string,
  ) {
    const atual = await this.prisma.oportunidade.findFirst({ where: { id, empresaId } });
    if (!atual) {
      throw Erros.naoEncontrado('OPORTUNIDADE_NAO_ENCONTRADA', 'Oportunidade nao encontrada');
    }

    const atuais = { ...((atual.dadosPersonalizados ?? {}) as Record<string, unknown>) };
    const ajustes = lerAjustes(atuais, atual.descricao);
    const marcados: typeof ajustes = [];

    if (ajusteId) {
      const indiceLegado = ajusteId.startsWith('legado-') ? Number(ajusteId.slice(7)) : Number.NaN;
      const item =
        ajustes.find((ajuste) => ajuste.id === ajusteId) ??
        (Number.isInteger(indiceLegado) ? ajustes[indiceLegado] : undefined);
      if (!item) {
        throw Erros.naoEncontrado('AJUSTE_NAO_ENCONTRADO', 'Pedido de ajuste nao encontrado');
      }
      item.status = 'corrigido';
      marcados.push(item);
    } else {
      for (const item of ajustes) {
        if (item.status !== 'corrigido') marcados.push(item);
        item.status = 'corrigido';
      }
    }

    const dados = persistirAjustes(atuais, ajustes);

    await this.prisma.$transaction(async (tx) => {
      await tx.oportunidade.update({
        where: { id },
        data: { dadosPersonalizados: dados as object },
      });

      if (!ajusteId) {
        await tx.atividade.updateMany({
          where: {
            empresaId,
            oportunidadeId: id,
            tipo: TipoAtividade.REVISAR_ORCAMENTO,
            concluida: false,
          },
          data: { concluida: true, concluidaEm: new Date() },
        });
      } else {
        for (const item of marcados) {
          const porTexto = await tx.atividade.updateMany({
            where: {
              empresaId,
              oportunidadeId: id,
              tipo: TipoAtividade.REVISAR_ORCAMENTO,
              concluida: false,
              descricao: item.texto,
            },
            data: { concluida: true, concluidaEm: new Date() },
          });
          if (porTexto.count > 0) continue;
          const tarefa = await tx.atividade.findFirst({
            where: {
              empresaId,
              oportunidadeId: id,
              tipo: TipoAtividade.REVISAR_ORCAMENTO,
              concluida: false,
            },
            orderBy: { criadoEm: 'asc' },
          });
          if (tarefa) {
            await tx.atividade.update({
              where: { id: tarefa.id },
              data: { concluida: true, concluidaEm: new Date() },
            });
          }
        }
      }
    });

    await this.eventos.registrar(this.prisma, {
      empresaId,
      oportunidadeId: id,
      tipo: TipoEvento.AJUSTE_CORRIGIDO,
      titulo: marcados.length > 1 ? 'Ajustes de orçamento corrigidos' : 'Ajuste de orçamento corrigido',
      descricao:
        marcados.length === 1
          ? marcados[0]!.texto
          : 'O time marcou os pedidos de ajuste como feitos.',
      origem: OrigemHistoricoEtapa.MANUAL,
      usuarioId,
    });
    await this.eventos.sincronizarProximaAcao(empresaId, id);
    return this.obter(empresaId, id);
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

      await this.eventos.registrar(tx, {
        empresaId,
        oportunidadeId: id,
        tipo: TipoEvento.ETAPA_ALTERADA,
        titulo: `${atual.etapa.nome} → ${destino.nome}`,
        descricao:
          origem === OrigemHistoricoEtapa.MANUAL
            ? 'Etapa corrigida manualmente'
            : 'Progresso atualizado automaticamente',
        origem,
        usuarioId: opcoes.usuarioId,
        dados: { etapaAnteriorId: atual.etapaId, etapaId: destino.id },
      });

      if (destino.tipo === TipoEtapaFunil.GANHA) {
        const vigente = await tx.orcamento.findFirst({
          where: {
            empresaId,
            oportunidadeId: id,
            vigente: true,
            status: { in: [StatusOrcamento.ENVIADO, StatusOrcamento.ACEITO] },
          },
        });
        if (vigente) {
          await this.produtos.baixarPorOrcamento(
            tx,
            empresaId,
            vigente.id,
            id,
            opcoes.usuarioId,
          );
          await tx.orcamento.update({
            where: { id: vigente.id },
            data: { status: StatusOrcamento.CONVERTIDO, convertidoEm: new Date() },
          });
          await this.eventos.registrar(tx, {
            empresaId,
            oportunidadeId: id,
            tipo: TipoEvento.ESTOQUE_BAIXADO,
            titulo: 'Estoque baixado pelo orçamento vigente',
            descricao: `Baixa automática do orçamento ${vigente.numero}.`,
            origem,
            usuarioId: opcoes.usuarioId,
            dados: { orcamentoId: vigente.id },
          });
        }
      }

      if (destino.tipo === TipoEtapaFunil.PERDIDA) {
        await tx.orcamento.updateMany({
          where: {
            empresaId,
            oportunidadeId: id,
            vigente: true,
            status: {
              in: [StatusOrcamento.ENVIADO, StatusOrcamento.ACEITO, StatusOrcamento.RASCUNHO],
            },
          },
          data: { status: StatusOrcamento.CANCELADO, vigente: false },
        });
      }

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
