import { Injectable, Logger } from '@nestjs/common';
import {
  ChaveEtapaSistema,
  COLUNAS_POS_VENDA_ECOLUME,
  COLUNAS_PRE_VENDA_ECOLUME,
  decimalParaNumero,
  fimDoDiaLocal,
  inicioDoDiaLocal,
  lerDiasChecklistPendente,
  lerDiasOrcamentoSemMovimentacao,
  resolverPeriodoDashboard,
  StatusComissaoPedido,
  StatusOrcamento,
  StatusPedido,
  StatusConversa,
  ticketMedio,
  TipoAtividade,
  TipoEtapaFunil,
  variacaoPercentual,
} from '@arcco/contratos';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { PrismaService } from '../../database/prisma.service';
import { FollowUpsService } from '../atividades/follow-ups.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { colunaPedidoDe, garantirEtapasEcolume } from '../oportunidades/kanban-ecolume';

export interface FiltroPeriodo {
  de?: Date;
  ate?: Date;
  dias?: number;
  /** ECOL-23: mes | mes_anterior | 30d | ano | personalizado */
  chave?: string;
}

const ROTULO_COLUNA: Record<string, string> = {
  [ChaveEtapaSistema.NOVO_CONTATO]: 'Novo contato',
  [ChaveEtapaSistema.ORCAMENTO_EM_ABERTO]: 'Orçamento em aberto',
  [ChaveEtapaSistema.PERDIDO]: 'Perdido',
  [ChaveEtapaSistema.PEDIDO_CONFIRMADO]: 'Pedido confirmado',
  [ChaveEtapaSistema.EM_SEPARACAO]: 'Em separação',
  [ChaveEtapaSistema.PRONTO_ENTREGA]: 'Pronto para entrega',
  [ChaveEtapaSistema.ENTREGUE]: 'Entregue',
  [ChaveEtapaSistema.PEDIDO_FINALIZADO]: 'Finalizado',
};

@Injectable()
export class DashboardService {
  private readonly logger = new Logger('Dashboard');

  constructor(
    private readonly prisma: PrismaService,
    private readonly platform: PlatformPrismaService,
    private readonly followUps: FollowUpsService,
    private readonly permissoes: PermissoesService,
  ) {}

  private resolverPeriodoLegado(filtro: FiltroPeriodo): { de: Date; ate: Date } {
    const ate = filtro.ate ?? new Date();
    let de = filtro.de;
    if (!de) {
      const dias = filtro.dias ?? 30;
      de = new Date(ate.getTime() - dias * 86400_000);
    }
    return { de, ate };
  }

  async metricas(
    empresaId: string,
    filtro: FiltroPeriodo,
    usuario?: { id: string; perfil: string } | null,
  ) {
    if (await this.permissoes.empresaEcolume(empresaId)) {
      return this.metricasEcolume(empresaId, filtro, usuario);
    }
    return this.metricasLegado(empresaId, filtro);
  }

  /** Dashboard legado — inalterado na estrutura. */
  private async metricasLegado(empresaId: string, filtro: FiltroPeriodo) {
    const { de, ate } = this.resolverPeriodoLegado(filtro);
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

    await this.followUps.garantirParaEmpresa(empresaId);

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
      modo: 'legado' as const,
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

  /** ECOL-23 — Visão geral §§15.1–15.7. */
  private async metricasEcolume(
    empresaId: string,
    filtro: FiltroPeriodo,
    usuario?: { id: string; perfil: string } | null,
  ) {
    const periodo = resolverPeriodoDashboard({
      chave: filtro.chave,
      de: filtro.de,
      ate: filtro.ate,
    });
    const { de, ate, deAnterior, ateAnterior } = periodo;
    const janela = { gte: de, lte: ate };
    const janelaAnt = { gte: deAnterior, lte: ateAnterior };
    const escopoAgenda = usuario
      ? await this.permissoes.escopoAgenda({
          id: usuario.id,
          empresaId,
          perfil: usuario.perfil,
        })
      : 'TODAS';
    const whereAgendaBase: {
      empresaId: string;
      concluida: boolean;
      responsavelId?: string;
      tipo?: typeof TipoAtividade.ENTREGA;
    } = { empresaId, concluida: false };
    if (escopoAgenda === 'PROPRIAS' && usuario) {
      whereAgendaBase.responsavelId = usuario.id;
    } else if (escopoAgenda === 'ENTREGAS' && usuario) {
      whereAgendaBase.responsavelId = usuario.id;
      whereAgendaBase.tipo = TipoAtividade.ENTREGA;
    }

    const empresa = await this.platform.empresa.findUnique({
      where: { id: empresaId },
      select: { configuracoes: true },
    });
    const diasOrc = lerDiasOrcamentoSemMovimentacao(empresa?.configuracoes);
    const diasChecklist = lerDiasChecklistPendente(empresa?.configuracoes);
    const limiteOrc = new Date(Date.now() - diasOrc * 86_400_000);
    const limiteChecklist = new Date(Date.now() - diasChecklist * 86_400_000);

    await this.prisma.$transaction(async (tx) => {
      await garantirEtapasEcolume(tx, empresaId);
    });

    // Pedidos do período (não cancelados) — faturamento / vendas / ticket
    const [aggAtual, aggAnt, negociosCriados, orcsAbertos, etapas] = await Promise.all([
      this.prisma.pedido.aggregate({
        where: {
          empresaId,
          criadoEm: janela,
          status: { not: StatusPedido.CANCELADO },
        },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.pedido.aggregate({
        where: {
          empresaId,
          criadoEm: janelaAnt,
          status: { not: StatusPedido.CANCELADO },
        },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.oportunidade.findMany({
        where: { empresaId, criadoEm: janela },
        select: {
          id: true,
          pedidos: {
            where: { status: { not: StatusPedido.CANCELADO } },
            select: { id: true },
            take: 1,
          },
        },
      }),
      this.prisma.orcamento.aggregate({
        where: {
          empresaId,
          status: { in: [StatusOrcamento.RASCUNHO, StatusOrcamento.ENVIADO] },
        },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.etapaFunil.findMany({
        where: { empresaId, ativo: true },
        select: { id: true, chaveSistema: true, nome: true, tipo: true },
      }),
    ]);

    const faturamento = aggAtual._sum.total ?? 0;
    const faturamentoAnterior = aggAnt._sum.total ?? 0;
    const vendas = aggAtual._count;
    const negociosNoPeriodo = negociosCriados.length;
    const negociosComPedido = negociosCriados.filter((n) => n.pedidos.length > 0).length;
    const taxaConversaoNegocio =
      negociosNoPeriodo > 0 ? negociosComPedido / negociosNoPeriodo : 0;

    // Funil pré + pós
    const chaveParaEtapaId = new Map(
      etapas.filter((e) => e.chaveSistema).map((e) => [e.chaveSistema!, e.id]),
    );

    const contagemPre = new Map<string, { quantidade: number; valor: number }>();
    for (const chave of COLUNAS_PRE_VENDA_ECOLUME) {
      contagemPre.set(chave, { quantidade: 0, valor: 0 });
    }
    for (const chave of COLUNAS_PRE_VENDA_ECOLUME) {
      const id = chaveParaEtapaId.get(chave);
      if (!id) continue;
      const agg = await this.prisma.oportunidade.aggregate({
        where: { empresaId, etapaId: id },
        _count: true,
        _sum: { valorEstimado: true },
      });
      contagemPre.set(chave, {
        quantidade: agg._count,
        valor: agg._sum.valorEstimado ?? 0,
      });
    }

    const pedidosKanban = await this.prisma.pedido.findMany({
      where: {
        empresaId,
        status: { not: StatusPedido.CANCELADO },
      },
      select: { status: true, faseKanban: true, total: true },
      take: 2000,
    });
    const contagemPos = new Map<string, { quantidade: number; valor: number }>();
    for (const chave of COLUNAS_POS_VENDA_ECOLUME) {
      contagemPos.set(chave, { quantidade: 0, valor: 0 });
    }
    for (const p of pedidosKanban) {
      const col = colunaPedidoDe(p);
      if (!col || !contagemPos.has(col)) continue;
      const slot = contagemPos.get(col)!;
      slot.quantidade += 1;
      slot.valor += p.total ?? 0;
    }

    const funil = [
      ...COLUNAS_PRE_VENDA_ECOLUME.map((chave) => {
        const s = contagemPre.get(chave) ?? { quantidade: 0, valor: 0 };
        return {
          chave,
          nome: ROTULO_COLUNA[chave] ?? chave,
          tipoCard: 'NEGOCIO' as const,
          tipo: chave === ChaveEtapaSistema.PERDIDO ? TipoEtapaFunil.PERDIDA : TipoEtapaFunil.ABERTA,
          quantidade: s.quantidade,
          valor: s.valor,
          link: `/app/pipeline?coluna=${chave}`,
        };
      }),
      ...COLUNAS_POS_VENDA_ECOLUME.map((chave) => {
        const s = contagemPos.get(chave) ?? { quantidade: 0, valor: 0 };
        return {
          chave,
          nome: ROTULO_COLUNA[chave] ?? chave,
          tipoCard: 'PEDIDO' as const,
          tipo: chave === ChaveEtapaSistema.PEDIDO_FINALIZADO ? TipoEtapaFunil.GANHA : TipoEtapaFunil.ABERTA,
          quantidade: s.quantidade,
          valor: s.valor,
          link: `/app/pipeline?coluna=${chave}`,
        };
      }),
    ];

    // Alertas
    const inicioHoje = inicioDoDiaLocal(new Date());
    const fimAmanha = fimDoDiaLocal(new Date(inicioHoje.getTime() + 86_400_000));

    const [
      atrasadas,
      aComprar,
      abaixoMinimo,
      orcsParados,
      checklistPendentes,
      entregasProximas,
    ] = await Promise.all([
      this.prisma.atividade.count({
        where: { ...whereAgendaBase, vencimento: { lt: inicioHoje } },
      }),
      this.prisma.produto.count({
        where: { empresaId, ativo: true, controlaEstoque: true, estoqueAtual: { lt: 0 } },
      }),
      this.prisma.produto.count({
        where: {
          empresaId,
          ativo: true,
          controlaEstoque: true,
          estoqueAtual: { gte: 0 },
          // abaixo ou igual ao mínimo (e não negativo — já em aComprar)
        },
      }).then(async (ignored) => {
        void ignored;
        const prods = await this.prisma.produto.findMany({
          where: { empresaId, ativo: true, controlaEstoque: true, estoqueAtual: { gte: 0 } },
          select: { estoqueAtual: true, estoqueMinimo: true },
        });
        return prods.filter((p) => p.estoqueAtual <= p.estoqueMinimo).length;
      }),
      this.prisma.orcamento.count({
        where: {
          empresaId,
          status: StatusOrcamento.ENVIADO,
          OR: [
            { enviadoEm: { lte: limiteOrc } },
            { enviadoEm: null, atualizadoEm: { lte: limiteOrc } },
          ],
        },
      }),
      this.prisma.pedido.count({
        where: {
          empresaId,
          status: StatusPedido.CONFIRMADO,
          criadoEm: { lte: limiteChecklist },
          checklist: { some: { aplicavel: true, concluido: false } },
        },
      }),
      this.prisma.atividade.count({
        where: {
          ...whereAgendaBase,
          tipo: TipoAtividade.ENTREGA,
          vencimento: { gte: inicioHoje, lte: fimAmanha },
        },
      }),
    ]);

    const alertas = [
      {
        id: 'atividades-atrasadas',
        tipo: 'atividade_atrasada',
        quantidade: atrasadas,
        titulo: `${atrasadas} atividade(s) atrasada(s)`,
        link: '/app/agenda?atrasadas=1',
        gravidade: 'alerta' as const,
      },
      {
        id: 'itens-a-comprar',
        tipo: 'itens_a_comprar',
        quantidade: aComprar,
        titulo: `${aComprar} item(ns) a comprar`,
        link: '/app/estoque?aba=lista-compra',
        gravidade: 'alerta' as const,
      },
      {
        id: 'abaixo-minimo',
        tipo: 'estoque_minimo',
        quantidade: abaixoMinimo,
        titulo: `${abaixoMinimo} produto(s) abaixo do mínimo`,
        link: '/app/estoque?criticos=1',
        gravidade: 'alerta' as const,
      },
      {
        id: 'orcamentos-parados',
        tipo: 'orcamento_parado',
        quantidade: orcsParados,
        titulo: `${orcsParados} orçamento(s) enviado(s) parado(s)`,
        link: '/app/agenda',
        gravidade: 'info' as const,
      },
      {
        id: 'checklist-pendente',
        tipo: 'checklist_pendente',
        quantidade: checklistPendentes,
        titulo: `${checklistPendentes} pedido(s) com checklist atrasado`,
        link: '/app/pipeline?escopo=pos',
        gravidade: 'alerta' as const,
      },
      {
        id: 'entregas-proximas',
        tipo: 'entregas_proximas',
        quantidade: entregasProximas,
        titulo: `${entregasProximas} entrega(s) hoje/amanhã`,
        link: '/app/agenda?entregas=1',
        gravidade: 'info' as const,
      },
    ].filter((a) => a.quantidade > 0);

    // Parceiros — pedidos não cancelados do período com comissão
    const pedidosParceiro = await this.prisma.pedido.findMany({
      where: {
        empresaId,
        criadoEm: janela,
        status: { not: StatusPedido.CANCELADO },
        comissao: { isNot: null },
      },
      select: {
        id: true,
        total: true,
        comissao: {
          select: {
            parceiroId: true,
            valorComissao: true,
            status: true,
          },
        },
      },
    });

    const porParceiro = new Map<
      string,
      { quantidadePedidos: number; valorVendido: number; comissaoGerada: number }
    >();
    for (const p of pedidosParceiro) {
      const c = p.comissao;
      if (!c || c.status === StatusComissaoPedido.CANCELADA) continue;
      const slot = porParceiro.get(c.parceiroId) ?? {
        quantidadePedidos: 0,
        valorVendido: 0,
        comissaoGerada: 0,
      };
      slot.quantidadePedidos += 1;
      slot.valorVendido += p.total ?? 0;
      slot.comissaoGerada += decimalParaNumero(c.valorComissao);
      porParceiro.set(c.parceiroId, slot);
    }

    const idsParceiros = [...porParceiro.keys()];
    const contatosParceiro =
      idsParceiros.length === 0
        ? []
        : await this.prisma.contato.findMany({
            where: { empresaId, id: { in: idsParceiros } },
            select: { id: true, nome: true, tipoParceiro: true },
          });

    const parceiros = contatosParceiro
      .map((ct) => {
        const s = porParceiro.get(ct.id)!;
        return {
          parceiroId: ct.id,
          nome: ct.nome,
          tipoParceiro: ct.tipoParceiro,
          quantidadePedidos: s.quantidadePedidos,
          valorVendido: s.valorVendido,
          comissaoGerada: s.comissaoGerada,
        };
      })
      .sort((a, b) => b.valorVendido - a.valorVendido);

    // Scheduler follow-up (não bloqueia resposta)
    void this.followUps.garantirParaEmpresa(empresaId).catch((e) =>
      this.logger.warn(`Follow-up no dashboard: ${(e as Error).message}`),
    );

    return {
      modo: 'ecolume' as const,
      periodo: {
        chave: periodo.chave,
        de,
        ate,
        deAnterior,
        ateAnterior,
      },
      indicadores: {
        faturamento,
        faturamentoAnterior,
        variacaoFaturamentoPercentual: variacaoPercentual(faturamento, faturamentoAnterior),
        vendasConcluidas: vendas,
        taxaConversaoNegocio,
        negociosCriados: negociosNoPeriodo,
        negociosComPedido,
        orcamentosAbertos: {
          quantidade: orcsAbertos._count,
          valor: orcsAbertos._sum.total ?? 0,
        },
        ticketMedio: ticketMedio(faturamento, vendas),
      },
      funil,
      alertas,
      parceiros,
      diasAlerta: { orcamento: diasOrc, checklist: diasChecklist },
    };
  }
}
