import { Injectable, Logger } from '@nestjs/common';
import { StatusConversa, TipoAtividade, TipoEtapaFunil } from '@arcco/contratos';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { PrismaService } from '../../database/prisma.service';
import { EventosService } from '../eventos/eventos.service';

export interface FiltroPeriodo {
  de?: Date;
  ate?: Date;
  dias?: number;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger('Dashboard');

  constructor(
    private readonly prisma: PrismaService,
    private readonly platform: PlatformPrismaService,
    private readonly eventos: EventosService,
  ) {}

  private resolverPeriodo(filtro: FiltroPeriodo): { de: Date; ate: Date } {
    const ate = filtro.ate ?? new Date();
    let de = filtro.de;
    if (!de) {
      const dias = filtro.dias ?? 30;
      de = new Date(ate.getTime() - dias * 86400_000);
    }
    return { de, ate };
  }

  async metricas(empresaId: string, filtro: FiltroPeriodo) {
    const { de, ate } = this.resolverPeriodo(filtro);
    const janela = { gte: de, lte: ate };
    const limiteParada = new Date(Date.now() - 7 * 86400_000);

    const [
      etapas,
      oportunidadesAbertas,
      valorPipeline,
      ganhasPeriodo,
      perdidasPeriodo,
      novosContatos,
      novasOportunidades,
      atividadesPendentes,
      atividadesAtrasadas,
      conversasPorStatus,
      oportunidadesParadas,
      produtosEstoque,
    ] = await this.prisma.$transaction([
      this.prisma.etapaFunil.findMany({ where: { empresaId, ativo: true }, orderBy: { ordem: 'asc' } }),
      this.prisma.oportunidade.count({ where: { empresaId, fechadaEm: null } }),
      this.prisma.oportunidade.aggregate({
        where: { empresaId, fechadaEm: null },
        _sum: { valorEstimado: true },
      }),
      this.prisma.oportunidade.aggregate({
        where: { empresaId, fechadaEm: janela, etapa: { tipo: TipoEtapaFunil.GANHA } },
        _count: true,
        _sum: { valorEstimado: true },
      }),
      this.prisma.oportunidade.count({
        where: { empresaId, fechadaEm: janela, etapa: { tipo: TipoEtapaFunil.PERDIDA } },
      }),
      this.prisma.contato.count({ where: { empresaId, criadoEm: janela } }),
      this.prisma.oportunidade.count({ where: { empresaId, criadoEm: janela } }),
      this.prisma.atividade.count({ where: { empresaId, concluida: false } }),
      this.prisma.atividade.count({
        where: { empresaId, concluida: false, vencimento: { lt: new Date() } },
      }),
      this.prisma.conversa.groupBy({
        by: ['status'],
        where: { empresaId },
        _count: true,
        orderBy: { status: 'asc' },
      }),
      this.prisma.oportunidade.count({
        where: {
          empresaId,
          fechadaEm: null,
          atualizadoEm: { lt: limiteParada },
        },
      }),
      this.prisma.produto.findMany({
        where: { empresaId, ativo: true, controlaEstoque: true },
        select: { estoqueAtual: true, estoqueMinimo: true },
      }),
    ]);

    await this.garantirFollowUpsParados(empresaId, limiteParada);

    const estoqueCriticos = produtosEstoque.filter(
      (p) => p.estoqueAtual <= p.estoqueMinimo,
    ).length;
    const estoqueZerados = produtosEstoque.filter((p) => p.estoqueAtual <= 0).length;

    const oportunidadesPorEtapa = await this.prisma.oportunidade.groupBy({
      by: ['etapaId'],
      where: { empresaId },
      _count: true,
      _sum: { valorEstimado: true },
    });

    const funil = etapas.map((etapa) => {
      const agrupado = oportunidadesPorEtapa.find((o) => o.etapaId === etapa.id);
      return {
        etapaId: etapa.id,
        nome: etapa.nome,
        tipo: etapa.tipo,
        quantidade: agrupado?._count ?? 0,
        valor: agrupado?._sum.valorEstimado ?? 0,
      };
    });

    const ganhas = ganhasPeriodo._count ?? 0;
    const totalFechadas = ganhas + perdidasPeriodo;
    const taxaConversao = totalFechadas > 0 ? ganhas / totalFechadas : 0;

    const conversas = {
      aguardandoHumano:
        conversasPorStatus.find((c) => c.status === StatusConversa.AGUARDANDO_HUMANO)?._count ?? 0,
      emAtendimento:
        conversasPorStatus.find((c) => c.status === StatusConversa.EM_ATENDIMENTO)?._count ?? 0,
      botAtendendo:
        conversasPorStatus.find((c) => c.status === StatusConversa.BOT_ATENDENDO)?._count ?? 0,
    };

    return {
      periodo: { de, ate },
      oportunidades: {
        abertas: oportunidadesAbertas,
        valorPipeline: valorPipeline._sum.valorEstimado ?? 0,
        novasNoPeriodo: novasOportunidades,
        ganhasNoPeriodo: ganhas,
        valorGanhoNoPeriodo: ganhasPeriodo._sum.valorEstimado ?? 0,
        perdidasNoPeriodo: perdidasPeriodo,
        taxaConversao,
        ticketMedioGanho: ganhas > 0 ? (ganhasPeriodo._sum.valorEstimado ?? 0) / ganhas : 0,
        paradas: oportunidadesParadas,
      },
      contatos: { novosNoPeriodo: novosContatos },
      atividades: { pendentes: atividadesPendentes, atrasadas: atividadesAtrasadas },
      conversas,
      estoque: {
        comControle: produtosEstoque.length,
        criticos: estoqueCriticos,
        zerados: estoqueZerados,
      },
      funil,
    };
  }

  /** Cria FOLLOW_UP para negócios parados (>7d) que ainda não têm um pendente. */
  private async garantirFollowUpsParados(empresaId: string, limiteParada: Date) {
    try {
      const paradas = await this.prisma.oportunidade.findMany({
        where: {
          empresaId,
          fechadaEm: null,
          atualizadoEm: { lt: limiteParada },
          NOT: {
            atividades: {
              some: {
                concluida: false,
                tipo: TipoAtividade.FOLLOW_UP,
                titulo: { startsWith: 'Negócio parado' },
              },
            },
          },
        },
        select: {
          id: true,
          codigo: true,
          contatoId: true,
          responsavelId: true,
        },
        take: 25,
      });
      if (paradas.length === 0) return;

      const fallback =
        (
          await this.platform.usuario.findFirst({
            where: { empresaId, ativo: true },
            orderBy: { criadoEm: 'asc' },
            select: { id: true },
          })
        )?.id ?? null;

      const vencimento = new Date();
      vencimento.setHours(9, 0, 0, 0);

      for (const opp of paradas) {
        const responsavelId = opp.responsavelId ?? fallback;
        if (!responsavelId) continue;

        await this.prisma.atividade.create({
          data: {
            empresaId,
            tipo: TipoAtividade.FOLLOW_UP,
            titulo: `Negócio parado ${opp.codigo}`,
            descricao: 'Sem movimentação há mais de 7 dias. Retome o contato ou atualize a etapa.',
            vencimento,
            responsavelId,
            oportunidadeId: opp.id,
            contatoId: opp.contatoId,
          },
        });
        await this.eventos.sincronizarProximaAcao(empresaId, opp.id);
      }
    } catch (erro) {
      this.logger.warn(
        `Falha ao agendar follow-ups de negócios parados: ${(erro as Error).message}`,
      );
    }
  }
}
