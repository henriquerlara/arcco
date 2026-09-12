import { Injectable } from '@nestjs/common';
import { StatusConversa, TipoEtapaFunil } from '@arcco/contratos';
import { PrismaService } from '../../database/prisma.service';

export interface FiltroPeriodo {
  de?: Date;
  ate?: Date;
  dias?: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

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
          atualizadoEm: { lt: new Date(Date.now() - 7 * 86400_000) },
        },
      }),
      this.prisma.produto.findMany({
        where: { empresaId, ativo: true, controlaEstoque: true },
        select: { estoqueAtual: true, estoqueMinimo: true },
      }),
    ]);

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
}
