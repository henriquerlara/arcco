import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ChaveEtapaSistema,
  FaseKanbanPedido,
  OrigemHistoricoEtapa,
  PermissaoComercial,
  StatusComissaoPedido,
  StatusNotaFiscal,
  StatusOrcamento,
  StatusPagamentoPedido,
  StatusPedido,
  TipoAuditoria,
  TipoChecklistPedido,
  possuiPermissao,
  type cancelarPedidoSchema,
  type converterOrcamentoPedidoSchema,
  type marcarChecklistSchema,
  type marcarPagamentoRecebidoSchema,
  type moverPedidoKanbanSchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ProdutosService } from '../produtos/produtos.service';
import {
  arredondarDinheiro,
  montarLinhasPagamento,
  type EntradaConversaoPagamento,
} from './pagamentos-pedido';

const INCLUDE = {
  itens: { orderBy: { ordem: 'asc' as const } },
} as const;

const INCLUDE_COMPLETO = {
  itens: { orderBy: { ordem: 'asc' as const } },
  pagamentos: { orderBy: { ordem: 'asc' as const } },
  comissao: true,
  checklist: { orderBy: { ordem: 'asc' as const } },
  itensSeparacao: { orderBy: { ordem: 'asc' as const } },
  itensCompra: { orderBy: { ordem: 'asc' as const } },
} as const;

type Tx = Prisma.TransactionClient;
type ConverterInput = z.infer<typeof converterOrcamentoPedidoSchema>;
type CancelarInput = z.infer<typeof cancelarPedidoSchema>;
type MoverKanbanInput = z.infer<typeof moverPedidoKanbanSchema>;
type Ator = { id: string; perfil: string };

const FASES_MANUAIS = new Set<string>(Object.values(FaseKanbanPedido));

const STATUS_ELEGIVEIS: StatusOrcamento[] = [
  StatusOrcamento.RASCUNHO,
  StatusOrcamento.ENVIADO,
  StatusOrcamento.ACEITO,
];

const STATUS_SUBSTITUIVEIS: StatusOrcamento[] = STATUS_ELEGIVEIS;

const ROTULOS_CHECKLIST: Record<
  (typeof TipoChecklistPedido)[keyof typeof TipoChecklistPedido],
  string
> = {
  PAGAMENTO_RECEBIDO: 'Pagamento recebido',
  ITENS_COMPRADOS: 'Itens faltantes comprados',
  MATERIAL_SEPARADO: 'Material separado',
  NF_EMITIDA: 'Nota fiscal emitida',
  ENTREGUE: 'Entregue',
  COMISSAO_PAGA: 'Comissão do parceiro paga',
};

/**
 * ECOL-16/17 — estrutura + conversão operacional.
 * Base da RT = total do pedido (P1 / §16.4) até ECOL-02 tornar configurável.
 */
@Injectable()
export class PedidosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissoes: PermissoesService,
    private readonly produtos: ProdutosService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listarPorOportunidade(empresaId: string, oportunidadeId: string) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.invalido('PEDIDO_INDISPONIVEL', 'Pedidos so na personalizacao ECOLUME');
    }
    const opp = await this.prisma.oportunidade.findFirst({
      where: { id: oportunidadeId, empresaId },
      select: { id: true },
    });
    if (!opp) throw Erros.naoEncontrado('OPORTUNIDADE_NAO_ENCONTRADA', 'Negocio nao encontrado');
    const lista = await this.prisma.pedido.findMany({
      where: { empresaId, oportunidadeId },
      include: INCLUDE_COMPLETO,
      orderBy: { criadoEm: 'desc' },
    });
    return lista.map((p) => this.serializarPedido(p));
  }

  async obter(empresaId: string, id: string) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.invalido('PEDIDO_INDISPONIVEL', 'Pedidos so na personalizacao ECOLUME');
    }
    const pedido = await this.prisma.pedido.findFirst({
      where: { id, empresaId },
      include: INCLUDE_COMPLETO,
    });
    if (!pedido) throw Erros.naoEncontrado('PEDIDO_NAO_ENCONTRADO', 'Pedido nao encontrado');
    return this.serializarPedido(pedido);
  }

  /**
   * Cria Pedido + ItemPedido a partir do orçamento (snapshot comercial).
   * - Não altera status do orçamento.
   * - Não movimenta estoque, pagamentos, comissão nem checklist.
   * - Aceita `tx` externo para a transação da ECOL-17.
   */
  async criarEstruturaAPartirDeOrcamento(
    empresaId: string,
    orcamentoId: string,
    usuarioId: string | null,
    txExterno?: Tx,
  ) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.invalido('PEDIDO_INDISPONIVEL', 'Pedidos so na personalizacao ECOLUME');
    }

    const executar = async (tx: Tx) => {
      const orcamento = await tx.orcamento.findFirst({
        where: { id: orcamentoId, empresaId },
        include: { itens: { orderBy: { ordem: 'asc' } } },
      });
      if (!orcamento) {
        throw Erros.naoEncontrado('ORCAMENTO_NAO_ENCONTRADO', 'Orcamento nao encontrado');
      }
      if (orcamento.itens.length === 0) {
        throw Erros.invalido('ORCAMENTO_SEM_ITENS', 'Inclua itens antes de gerar o pedido');
      }
      if (
        orcamento.status === StatusOrcamento.CANCELADO ||
        orcamento.status === StatusOrcamento.RECUSADO ||
        orcamento.status === StatusOrcamento.SUBSTITUIDO
      ) {
        throw Erros.invalido(
          'ORCAMENTO_NAO_CONVERSIVEL',
          'Orcamento cancelado, recusado ou substituido nao gera pedido',
        );
      }

      const existente = await tx.pedido.findFirst({
        where: { orcamentoId: orcamento.id },
        select: { id: true, numero: true },
      });
      if (existente) {
        throw Erros.conflito(
          'ORCAMENTO_JA_TEM_PEDIDO',
          `Orcamento ja possui o pedido ${existente.numero}`,
        );
      }

      const numero = await this.reservarNumero(tx, empresaId);

      try {
        const pedido = await tx.pedido.create({
          data: {
            empresaId,
            oportunidadeId: orcamento.oportunidadeId,
            orcamentoId: orcamento.id,
            numero,
            status: StatusPedido.CONFIRMADO,
            faseKanban: FaseKanbanPedido.PEDIDO_CONFIRMADO,
            observacoes: orcamento.observacoes,
            descontoValor: orcamento.descontoValor,
            descontoTipo: orcamento.descontoTipo,
            descontoPercentual: orcamento.descontoPercentual,
            subtotal: orcamento.subtotal,
            total: orcamento.total,
            criadoPorId: usuarioId,
            itens: {
              create: orcamento.itens.map((item) => ({
                produtoId: item.produtoId,
                nome: item.nome,
                unidade: item.unidade,
                quantidade: item.quantidade,
                precoUnitario: item.precoUnitario,
                desconto: item.desconto,
                totalLinha: item.totalLinha,
                ordem: item.ordem,
                codigoInterno: item.codigoInterno,
              })),
            },
          },
          include: INCLUDE,
        });
        await tx.historicoFasePedido.create({
          data: {
            empresaId,
            pedidoId: pedido.id,
            faseAnterior: null,
            faseNova: FaseKanbanPedido.PEDIDO_CONFIRMADO,
            origem: 'CONVERSAO',
            usuarioId,
            motivo: 'Conversao de orcamento',
          },
        });
        return pedido;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw Erros.conflito(
            'ORCAMENTO_JA_TEM_PEDIDO',
            'Orcamento ja possui pedido (concorrencia)',
          );
        }
        throw e;
      }
    };

    if (txExterno) return executar(txExterno);
    return this.prisma.$transaction((tx) => executar(tx));
  }

  /** Pré-visualização sem gravações. */
  async previsualizarConversao(empresaId: string, orcamentoId: string, ator: Ator) {
    await this.afirmarEcolumeEConverter(empresaId, ator);
    const ctx = await this.carregarContextoConversao(empresaId, orcamentoId);
    const previsao = await this.preverEstoque(empresaId, ctx.orcamento.itens);
    const outros = ctx.outrosOrcamentos.map((o) => ({
      id: o.id,
      numero: o.numero,
      status: o.status,
      total: o.total,
    }));
    const comissao = this.preverComissao(ctx.oportunidade, ctx.orcamento.total);
    return {
      orcamento: {
        id: ctx.orcamento.id,
        numero: ctx.orcamento.numero,
        status: ctx.orcamento.status,
        total: ctx.orcamento.total,
        subtotal: ctx.orcamento.subtotal,
        itens: ctx.orcamento.itens.map((i) => ({
          id: i.id,
          produtoId: i.produtoId,
          nome: i.nome,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
          desconto: i.desconto,
          totalLinha: i.totalLinha,
          controlaEstoque: i.produtoId
            ? previsao.porProduto.get(i.produtoId)?.controlaEstoque ?? false
            : false,
          saldoAtual: i.produtoId ? previsao.porProduto.get(i.produtoId)?.saldoAtual ?? null : null,
          saldoPrevisto: i.produtoId
            ? previsao.porProduto.get(i.produtoId)?.saldoPrevisto ?? null
            : null,
          negativoPrevisto: i.produtoId
            ? (previsao.porProduto.get(i.produtoId)?.saldoPrevisto ?? 0) < 0
            : false,
        })),
      },
      outrosOrcamentosAbertos: outros,
      comissao,
      avisosEstoqueNegativo: previsao.negativos,
    };
  }

  /** Conversão atômica no banco operacional (auditoria na mesma TX). */
  async converter(empresaId: string, dto: ConverterInput, ator: Ator) {
    await this.afirmarEcolumeEConverter(empresaId, ator);

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`${empresaId}:conv-orc:${dto.orcamentoId}`}))
        `;

        const ctx = await this.carregarContextoConversao(empresaId, dto.orcamentoId, tx);
        if (ctx.orcamento.status === StatusOrcamento.CONVERTIDO) {
          throw Erros.conflito('ORCAMENTO_JA_CONVERTIDO', 'Orcamento ja convertido');
        }
        if (!(STATUS_ELEGIVEIS as string[]).includes(ctx.orcamento.status)) {
          throw Erros.invalido(
            'ORCAMENTO_NAO_CONVERSIVEL',
            'Orcamento nao elegivel para conversao',
          );
        }

        const pedido = await this.criarEstruturaAPartirDeOrcamento(
          empresaId,
          dto.orcamentoId,
          ator.id,
          tx,
        );

        await tx.orcamento.update({
          where: { id: ctx.orcamento.id },
          data: { status: StatusOrcamento.CONVERTIDO, vigente: true },
        });

        const substituir = [...new Set(dto.orcamentosSubstituirIds ?? [])].filter(
          (id) => id !== ctx.orcamento.id,
        );
        const substituidos: string[] = [];
        for (const id of substituir) {
          const outro = ctx.outrosOrcamentos.find((o) => o.id === id);
          if (!outro || !(STATUS_SUBSTITUIVEIS as string[]).includes(outro.status)) continue;
          await tx.orcamento.update({
            where: { id },
            data: { status: StatusOrcamento.SUBSTITUIDO, vigente: false },
          });
          substituidos.push(id);
        }

        await tx.orcamento.updateMany({
          where: {
            empresaId,
            oportunidadeId: ctx.orcamento.oportunidadeId,
            id: { not: ctx.orcamento.id },
            status: StatusOrcamento.CONVERTIDO,
          },
          data: { vigente: false },
        });

        const baixa = await this.produtos.baixarPorPedido(
          tx,
          empresaId,
          {
            id: pedido.id,
            numero: pedido.numero,
            oportunidadeId: pedido.oportunidadeId,
            orcamentoId: pedido.orcamentoId,
            itens: pedido.itens,
          },
          ator.id,
        );

        if (baixa.separacao.length) {
          await tx.itemSeparacaoPedido.createMany({
            data: baixa.separacao.map((s) => ({
              pedidoId: pedido.id,
              produtoId: s.produtoId,
              nome: s.nome,
              quantidade: s.quantidade,
              ordem: s.ordem,
            })),
          });
        }
        if (baixa.compra.length) {
          await tx.itemCompraPedido.createMany({
            data: baixa.compra.map((c) => ({
              pedidoId: pedido.id,
              produtoId: c.produtoId,
              nome: c.nome,
              quantidadeFalta: c.quantidadeFalta,
              ordem: c.ordem,
            })),
          });
        }

        const pag = montarLinhasPagamento(pedido.total, dto as EntradaConversaoPagamento);
        for (const linha of pag.linhas) {
          await tx.pagamentoPedido.create({
            data: {
              empresaId,
              pedidoId: pedido.id,
              modelo: linha.modelo,
              forma: linha.forma,
              valor: linha.valor,
              vencimentoEm: linha.vencimentoEm,
              status: linha.status,
              recebidoEm: linha.recebidoEm,
              ordem: linha.ordem,
            },
          });
        }

        let comissaoId: string | null = null;
        const prevComissao = this.preverComissao(ctx.oportunidade, pedido.total);
        if (prevComissao) {
          const criada = await tx.comissaoPedido.create({
            data: {
              empresaId,
              pedidoId: pedido.id,
              parceiroId: prevComissao.parceiroId,
              rtPercentual: new Prisma.Decimal(prevComissao.rtPercentual.toFixed(4)),
              baseCalculo: new Prisma.Decimal(prevComissao.baseCalculo.toFixed(4)),
              valorComissao: new Prisma.Decimal(prevComissao.valorComissao.toFixed(4)),
              status: StatusComissaoPedido.A_PAGAR,
            },
          });
          comissaoId = criada.id;
        }

        await this.criarChecklist(
          tx,
          empresaId,
          pedido.id,
          baixa.compra.length > 0,
          !!prevComissao,
        );

        await this.sincronizarEtapaAposConversao(tx, empresaId, ctx.oportunidade, ator.id);

        await this.auditoria.registrar(tx, {
          empresaId,
          usuarioId: ator.id,
          tipo: TipoAuditoria.CONVERSAO_PEDIDO,
          entidade: 'pedido',
          entidadeId: pedido.id,
          anterior: {
            orcamentoId: ctx.orcamento.id,
            orcamentoStatus: ctx.orcamento.status,
          },
          posterior: {
            pedidoId: pedido.id,
            numero: pedido.numero,
            orcamentoId: ctx.orcamento.id,
            modeloPagamento: dto.modeloPagamento,
            orcamentosSubstituidos: substituidos,
            comissaoId,
            somaPagamentos: pag.soma,
            diferencaPagamentos: pag.diferenca,
            itensSeparacao: baixa.separacao.length,
            itensCompra: baixa.compra.length,
          },
        });

        const completo = await tx.pedido.findFirstOrThrow({
          where: { id: pedido.id },
          include: INCLUDE_COMPLETO,
        });
        return {
          ...this.serializarPedido(completo),
          avisoPagamento:
            pag.diferenca !== 0
              ? {
                  soma: pag.soma,
                  totalPedido: arredondarDinheiro(pedido.total),
                  diferenca: pag.diferenca,
                }
              : null,
        };
      },
      { timeout: 30_000 },
    );
  }

  async marcarPagamentoRecebido(
    empresaId: string,
    pedidoId: string,
    pagamentoId: string,
    dto: z.infer<typeof marcarPagamentoRecebidoSchema>,
    ator: Ator,
  ) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.invalido('PEDIDO_INDISPONIVEL', 'Pedidos so na personalizacao ECOLUME');
    }
    const ctx = await this.permissoes.resolver({ ...ator, empresaId });
    if (!possuiPermissao(ctx, PermissaoComercial.VER_PAGAMENTOS)) {
      throw Erros.semPermissao();
    }

    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findFirst({
        where: { id: pedidoId, empresaId },
        select: { id: true },
      });
      if (!pedido) throw Erros.naoEncontrado('PEDIDO_NAO_ENCONTRADO', 'Pedido nao encontrado');
      const pag = await tx.pagamentoPedido.findFirst({
        where: { id: pagamentoId, pedidoId, empresaId },
      });
      if (!pag) throw Erros.naoEncontrado('PAGAMENTO_NAO_ENCONTRADO', 'Pagamento nao encontrado');
      const recebidoEm = dto.recebidoEm ?? new Date();
      return tx.pagamentoPedido.update({
        where: { id: pag.id },
        data: { status: StatusPagamentoPedido.RECEBIDO, recebidoEm },
      });
    });
  }

  async marcarChecklist(
    empresaId: string,
    pedidoId: string,
    itemId: string,
    dto: z.infer<typeof marcarChecklistSchema>,
    ator: Ator,
  ) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.invalido('PEDIDO_INDISPONIVEL', 'Pedidos so na personalizacao ECOLUME');
    }

    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findFirst({
        where: { id: pedidoId, empresaId },
        include: { checklist: true },
      });
      if (!pedido) throw Erros.naoEncontrado('PEDIDO_NAO_ENCONTRADO', 'Pedido nao encontrado');
      if (pedido.status === StatusPedido.CANCELADO) {
        throw Erros.invalido('PEDIDO_CANCELADO', 'Pedido cancelado');
      }
      const item = pedido.checklist.find((c) => c.id === itemId);
      if (!item) throw Erros.naoEncontrado('CHECKLIST_NAO_ENCONTRADO', 'Item nao encontrado');
      if (item.automatico && !item.aplicavel) {
        throw Erros.invalido('CHECKLIST_NAO_APLICAVEL', 'Item nao aplicavel');
      }
      if (item.automatico && item.tipo === TipoChecklistPedido.NF_EMITIDA) {
        throw Erros.invalido(
          'CHECKLIST_AUTOMATICO',
          'Nota fiscal sera marcada pela integracao futura',
        );
      }
      if (item.automatico && item.tipo === TipoChecklistPedido.COMISSAO_PAGA) {
        throw Erros.invalido(
          'CHECKLIST_AUTOMATICO',
          'Comissao sera marcada pelo pagamento da RT',
        );
      }

      await tx.checklistItemPedido.update({
        where: { id: item.id },
        data: {
          concluido: dto.concluido,
          concluidoEm: dto.concluido ? new Date() : null,
          usuarioId: ator.id,
        },
      });

      const checklist = await tx.checklistItemPedido.findMany({ where: { pedidoId } });
      const aplicaveis = checklist.filter((c) => c.aplicavel);
      const completo =
        aplicaveis.length > 0 && aplicaveis.every((c) => c.concluido);
      if (completo && pedido.status !== StatusPedido.FINALIZADO) {
        await tx.pedido.update({
          where: { id: pedidoId },
          data: { status: StatusPedido.FINALIZADO, finalizadoEm: new Date() },
        });
        await tx.historicoFasePedido.create({
          data: {
            empresaId,
            pedidoId,
            faseAnterior: pedido.faseKanban,
            faseNova: ChaveEtapaSistema.PEDIDO_FINALIZADO,
            origem: 'CHECKLIST',
            usuarioId: ator.id,
            motivo: 'Checklist 100%',
          },
        });
      } else if (!completo && pedido.status === StatusPedido.FINALIZADO) {
        await tx.pedido.update({
          where: { id: pedidoId },
          data: { status: StatusPedido.CONFIRMADO, finalizadoEm: null },
        });
        await tx.historicoFasePedido.create({
          data: {
            empresaId,
            pedidoId,
            faseAnterior: ChaveEtapaSistema.PEDIDO_FINALIZADO,
            faseNova: pedido.faseKanban || FaseKanbanPedido.ENTREGUE,
            origem: 'CHECKLIST',
            usuarioId: ator.id,
            motivo: 'Checklist reaberto',
          },
        });
      }

      const atualizado = await tx.pedido.findFirstOrThrow({
        where: { id: pedidoId, empresaId },
        include: INCLUDE_COMPLETO,
      });
      return this.serializarPedido(atualizado);
    });
  }

  /**
   * ECOL-19 — move card de pedido entre colunas pós-venda.
   * Não altera estoque, pagamentos nem comissão. Pronto para entrega / Entregue
   * marcam Material separado no checklist (implica separação concluída).
   */
  async moverKanban(empresaId: string, pedidoId: string, dto: MoverKanbanInput, ator: Ator) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.invalido('PEDIDO_INDISPONIVEL', 'Pedidos so na personalizacao ECOLUME');
    }
    if (!FASES_MANUAIS.has(dto.faseKanban)) {
      throw Erros.invalido('TRANSICAO_INVALIDA', 'Fase Kanban invalida');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`${empresaId}:ped-kanban:${pedidoId}`}))
      `;

      const pedido = await tx.pedido.findFirst({
        where: { id: pedidoId, empresaId },
        include: { checklist: true },
      });
      if (!pedido) throw Erros.naoEncontrado('PEDIDO_NAO_ENCONTRADO', 'Pedido nao encontrado');
      if (pedido.status === StatusPedido.CANCELADO) {
        throw Erros.invalido('PEDIDO_CANCELADO', 'Pedido cancelado fora do funil ativo');
      }
      if (pedido.status === StatusPedido.FINALIZADO) {
        throw Erros.invalido(
          'TRANSICAO_INVALIDA',
          'Pedido finalizado so reabre via checklist incompleto',
        );
      }

      const faseAtual = pedido.faseKanban || FaseKanbanPedido.PEDIDO_CONFIRMADO;
      if (faseAtual === dto.faseKanban) {
        const atual = await tx.pedido.findFirstOrThrow({
          where: { id: pedidoId, empresaId },
          include: INCLUDE_COMPLETO,
        });
        return this.serializarPedido(atual);
      }

      await tx.pedido.update({
        where: { id: pedidoId },
        data: { faseKanban: dto.faseKanban as never },
      });
      await tx.historicoFasePedido.create({
        data: {
          empresaId,
          pedidoId,
          faseAnterior: faseAtual,
          faseNova: dto.faseKanban,
          origem: 'MANUAL',
          usuarioId: ator.id,
        },
      });

      // Pronto/Entregue implica material separado; voltar para Confirmado/Separação desfaz.
      const implicaMaterialPronto =
        dto.faseKanban === FaseKanbanPedido.PRONTO_ENTREGA ||
        dto.faseKanban === FaseKanbanPedido.ENTREGUE;
      const voltaAntesDePronto =
        dto.faseKanban === FaseKanbanPedido.PEDIDO_CONFIRMADO ||
        dto.faseKanban === FaseKanbanPedido.EM_SEPARACAO;
      const material = pedido.checklist.find(
        (c) => c.tipo === TipoChecklistPedido.MATERIAL_SEPARADO && c.aplicavel,
      );
      if (material && implicaMaterialPronto && !material.concluido) {
        await tx.checklistItemPedido.update({
          where: { id: material.id },
          data: {
            concluido: true,
            concluidoEm: new Date(),
            usuarioId: ator.id,
          },
        });
      } else if (material && voltaAntesDePronto && material.concluido) {
        await tx.checklistItemPedido.update({
          where: { id: material.id },
          data: {
            concluido: false,
            concluidoEm: null,
            usuarioId: ator.id,
          },
        });
      }

      const checklist = await tx.checklistItemPedido.findMany({ where: { pedidoId } });
      const aplicaveis = checklist.filter((c) => c.aplicavel);
      const completo = aplicaveis.length > 0 && aplicaveis.every((c) => c.concluido);
      // Aqui status já não é CANCELADO/FINALIZADO (bloqueados acima).
      if (completo) {
        await tx.pedido.update({
          where: { id: pedidoId },
          data: { status: StatusPedido.FINALIZADO, finalizadoEm: new Date() },
        });
        await tx.historicoFasePedido.create({
          data: {
            empresaId,
            pedidoId,
            faseAnterior: dto.faseKanban,
            faseNova: ChaveEtapaSistema.PEDIDO_FINALIZADO,
            origem: 'CHECKLIST',
            usuarioId: ator.id,
            motivo: 'Checklist 100% apos Pronto para entrega',
          },
        });
      }

      const atualizado = await tx.pedido.findFirstOrThrow({
        where: { id: pedidoId, empresaId },
        include: INCLUDE_COMPLETO,
      });
      return this.serializarPedido(atualizado);
    });
  }

  /**
   * ECOL-18 — cancelamento com estorno das baixas reais, comissão CANCELADA,
   * orçamento RECUSADO. Bloqueia se houver NF-e AUTORIZADA no orçamento de origem.
   */
  async cancelar(empresaId: string, pedidoId: string, dto: CancelarInput, ator: Ator) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.invalido('PEDIDO_INDISPONIVEL', 'Pedidos so na personalizacao ECOLUME');
    }
    const ctxPerm = await this.permissoes.resolver({ ...ator, empresaId });
    if (!possuiPermissao(ctxPerm, PermissaoComercial.CANCELAR_PEDIDO)) {
      throw Erros.semPermissao();
    }
    if (dto.confirmar !== true) {
      throw Erros.invalido('CONFIRMACAO_OBRIGATORIA', 'Confirme o cancelamento');
    }
    const motivo = dto.motivo.trim();
    if (motivo.length < 3) {
      throw Erros.invalido('MOTIVO_OBRIGATORIO', 'Informe o motivo do cancelamento');
    }

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`${empresaId}:canc-ped:${pedidoId}`}))
        `;

        const pedido = await tx.pedido.findFirst({
          where: { id: pedidoId, empresaId },
          include: INCLUDE_COMPLETO,
        });
        if (!pedido) throw Erros.naoEncontrado('PEDIDO_NAO_ENCONTRADO', 'Pedido nao encontrado');
        if (pedido.status === StatusPedido.CANCELADO) {
          throw Erros.conflito('PEDIDO_JA_CANCELADO', 'Pedido ja cancelado');
        }

        // ECOL-18 + ECOL-24: qualquer NF AUTORIZADA do pedido (parcial) ou do orçamento legado.
        const nfAutorizada = await tx.notaFiscal.findFirst({
          where: {
            empresaId,
            status: StatusNotaFiscal.AUTORIZADA,
            OR: [{ pedidoId: pedido.id }, { orcamentoId: pedido.orcamentoId }],
          },
          select: { id: true, numero: true, serie: true, chaveAcesso: true, pedidoId: true },
        });
        if (nfAutorizada) {
          throw Erros.conflito(
            'NF_AUTORIZADA_BLOQUEIA_CANCELAMENTO',
            'Cancele a NF-e autorizada antes de cancelar o pedido',
            {
              notaFiscalId: nfAutorizada.id,
              numero: nfAutorizada.numero,
              serie: nfAutorizada.serie,
              pedidoId: nfAutorizada.pedidoId ?? pedido.id,
              orcamentoId: pedido.orcamentoId,
              atalhoFiscal: '#painel-nota-fiscal',
            },
          );
        }

        const estorno = await this.produtos.estornarPorPedido(
          tx,
          empresaId,
          {
            id: pedido.id,
            numero: pedido.numero,
            oportunidadeId: pedido.oportunidadeId,
            orcamentoId: pedido.orcamentoId,
          },
          ator.id,
        );

        let comissaoAntes: string | null = null;
        let comissaoJaPaga = false;
        if (pedido.comissao) {
          comissaoAntes = pedido.comissao.status;
          comissaoJaPaga = pedido.comissao.status === StatusComissaoPedido.PAGA;
          await tx.comissaoPedido.update({
            where: { id: pedido.comissao.id },
            data: { status: StatusComissaoPedido.CANCELADA },
          });
          await this.auditoria.registrar(tx, {
            empresaId,
            usuarioId: ator.id,
            tipo: TipoAuditoria.ALTERACAO_COMISSAO,
            entidade: 'comissao_pedido',
            entidadeId: pedido.comissao.id,
            anterior: {
              status: pedido.comissao.status,
              pagoEm: pedido.comissao.pagoEm,
              formaPagamento: pedido.comissao.formaPagamento,
            },
            posterior: {
              status: StatusComissaoPedido.CANCELADA,
              pagoEm: pedido.comissao.pagoEm,
              formaPagamento: pedido.comissao.formaPagamento,
              tratamentoFinanceiroManual: comissaoJaPaga,
            },
          });
        }

        await tx.orcamento.update({
          where: { id: pedido.orcamentoId },
          data: { status: StatusOrcamento.RECUSADO, vigente: false },
        });

        const agora = new Date();
        const faseAntes =
          pedido.status === StatusPedido.FINALIZADO
            ? ChaveEtapaSistema.PEDIDO_FINALIZADO
            : pedido.faseKanban;
        await tx.pedido.update({
          where: { id: pedido.id },
          data: {
            status: StatusPedido.CANCELADO,
            canceladoEm: agora,
            canceladoPorId: ator.id,
            motivoCancelamento: motivo,
            finalizadoEm: null,
          },
        });
        await tx.historicoFasePedido.create({
          data: {
            empresaId,
            pedidoId: pedido.id,
            faseAnterior: faseAntes,
            faseNova: 'CANCELADO',
            origem: 'CANCELAMENTO',
            usuarioId: ator.id,
            motivo,
          },
        });

        const valorRecebido = arredondarDinheiro(
          (pedido.pagamentos ?? [])
            .filter((p) => p.status === StatusPagamentoPedido.RECEBIDO)
            .reduce((a, p) => a + Number(p.valor), 0),
        );

        await this.auditoria.registrar(tx, {
          empresaId,
          usuarioId: ator.id,
          tipo: TipoAuditoria.CANCELAMENTO_PEDIDO,
          entidade: 'pedido',
          entidadeId: pedido.id,
          anterior: {
            status: pedido.status,
            orcamentoStatus: StatusOrcamento.CONVERTIDO,
            comissaoStatus: comissaoAntes,
          },
          posterior: {
            status: StatusPedido.CANCELADO,
            motivo,
            canceladoEm: agora.toISOString(),
            orcamentoStatus: StatusOrcamento.RECUSADO,
            estornos: estorno.estornos,
            comissaoStatus: pedido.comissao ? StatusComissaoPedido.CANCELADA : null,
            comissaoJaPaga,
            valorRecebidoPreservado: valorRecebido,
            funil: 'pedido_cancelado_fora_do_ativo',
          },
        });

        const completo = await tx.pedido.findFirstOrThrow({
          where: { id: pedido.id },
          include: INCLUDE_COMPLETO,
        });
        return {
          ...this.serializarPedido(completo),
          alertaPagamentosRecebidos:
            valorRecebido > 0
              ? {
                  valorRecebido,
                  mensagem:
                    'Ha pagamentos recebidos. Conciliacao ou devolucao deve ser feita manualmente.',
                }
              : null,
          alertaComissaoPaga: comissaoJaPaga
            ? {
                mensagem:
                  'Comissao estava paga; evidencias preservadas. Tratamento financeiro manual necessario.',
              }
            : null,
        };
      },
      { timeout: 30_000 },
    );
  }

  /**
   * Preparação ECOL-10b / §9.3 — marca comissão paga e checklist, sem extrato.
   */
  async marcarComissaoPaga(
    empresaId: string,
    pedidoId: string,
    ator: Ator,
    formaPagamento?: string | null,
  ) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.invalido('PEDIDO_INDISPONIVEL', 'Pedidos so na personalizacao ECOLUME');
    }
    const ctx = await this.permissoes.resolver({ ...ator, empresaId });
    if (!possuiPermissao(ctx, PermissaoComercial.VER_COMISSOES)) {
      throw Erros.semPermissao();
    }

    return this.prisma.$transaction(async (tx) => {
      const comissao = await tx.comissaoPedido.findFirst({
        where: { pedidoId, empresaId },
      });
      if (!comissao) throw Erros.naoEncontrado('COMISSAO_NAO_ENCONTRADA', 'Comissao nao encontrada');
      if (comissao.status === StatusComissaoPedido.CANCELADA) {
        throw Erros.invalido('COMISSAO_CANCELADA', 'Comissao cancelada');
      }
      // Idempotente: já paga não altera nem gera segundo log (§16.3 / ECOL-27b).
      if (comissao.status === StatusComissaoPedido.PAGA) {
        const atual = await tx.pedido.findFirstOrThrow({
          where: { id: pedidoId, empresaId },
          include: INCLUDE_COMPLETO,
        });
        return this.serializarPedido(atual);
      }

      const pagoEm = new Date();
      const forma = formaPagamento ?? null;
      await tx.comissaoPedido.update({
        where: { id: comissao.id },
        data: {
          status: StatusComissaoPedido.PAGA,
          pagoEm,
          formaPagamento: forma,
        },
      });
      await this.auditoria.registrar(tx, {
        empresaId,
        usuarioId: ator.id,
        tipo: TipoAuditoria.ALTERACAO_COMISSAO,
        entidade: 'comissao_pedido',
        entidadeId: comissao.id,
        anterior: {
          status: comissao.status,
          pagoEm: comissao.pagoEm,
          formaPagamento: comissao.formaPagamento,
          valorComissao: Number(comissao.valorComissao),
        },
        posterior: {
          status: StatusComissaoPedido.PAGA,
          pagoEm: pagoEm.toISOString(),
          formaPagamento: forma,
          valorComissao: Number(comissao.valorComissao),
          pedidoId,
        },
      });
      await tx.checklistItemPedido.updateMany({
        where: {
          pedidoId,
          tipo: TipoChecklistPedido.COMISSAO_PAGA,
          aplicavel: true,
        },
        data: { concluido: true, concluidoEm: new Date(), usuarioId: ator.id },
      });
      const checklist = await tx.checklistItemPedido.findMany({ where: { pedidoId } });
      const aplicaveis = checklist.filter((c) => c.aplicavel);
      if (aplicaveis.length > 0 && aplicaveis.every((c) => c.concluido)) {
        const ped = await tx.pedido.findFirst({
          where: { id: pedidoId, empresaId },
          select: { status: true, faseKanban: true },
        });
        if (ped && ped.status !== StatusPedido.FINALIZADO) {
          await tx.pedido.update({
            where: { id: pedidoId },
            data: { status: StatusPedido.FINALIZADO, finalizadoEm: new Date() },
          });
          await tx.historicoFasePedido.create({
            data: {
              empresaId,
              pedidoId,
              faseAnterior: ped.faseKanban,
              faseNova: ChaveEtapaSistema.PEDIDO_FINALIZADO,
              origem: 'CHECKLIST',
              usuarioId: ator.id,
              motivo: 'Checklist 100% (comissao)',
            },
          });
        }
      }
      const atualizado = await tx.pedido.findFirstOrThrow({
        where: { id: pedidoId, empresaId },
        include: INCLUDE_COMPLETO,
      });
      return this.serializarPedido(atualizado);
    });
  }

  private async afirmarEcolumeEConverter(empresaId: string, ator: Ator) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.invalido('PEDIDO_INDISPONIVEL', 'Pedidos so na personalizacao ECOLUME');
    }
    const ctx = await this.permissoes.resolver({ ...ator, empresaId });
    if (!possuiPermissao(ctx, PermissaoComercial.CONVERTER_PEDIDO)) {
      throw Erros.semPermissao();
    }
  }

  private async carregarContextoConversao(empresaId: string, orcamentoId: string, tx?: Tx) {
    const db = tx ?? this.prisma;
    const orcamento = await db.orcamento.findFirst({
      where: { id: orcamentoId, empresaId },
      include: { itens: { orderBy: { ordem: 'asc' } } },
    });
    if (!orcamento) {
      throw Erros.naoEncontrado('ORCAMENTO_NAO_ENCONTRADO', 'Orcamento nao encontrado');
    }
    if (orcamento.itens.length === 0) {
      throw Erros.invalido('ORCAMENTO_SEM_ITENS', 'Inclua itens antes de gerar o pedido');
    }
    if (
      orcamento.status === StatusOrcamento.CANCELADO ||
      orcamento.status === StatusOrcamento.RECUSADO ||
      orcamento.status === StatusOrcamento.SUBSTITUIDO ||
      orcamento.status === StatusOrcamento.CONVERTIDO
    ) {
      throw Erros.invalido(
        'ORCAMENTO_NAO_CONVERSIVEL',
        'Orcamento nao elegivel para conversao',
      );
    }
    const existente = await db.pedido.findFirst({
      where: { orcamentoId: orcamento.id },
      select: { id: true, numero: true },
    });
    if (existente) {
      throw Erros.conflito(
        'ORCAMENTO_JA_TEM_PEDIDO',
        `Orcamento ja possui o pedido ${existente.numero}`,
      );
    }
    const oportunidade = await db.oportunidade.findFirst({
      where: { id: orcamento.oportunidadeId, empresaId },
      select: {
        id: true,
        etapaId: true,
        parceiroId: true,
        rtNegocio: true,
        etapa: { select: { id: true, nome: true } },
      },
    });
    if (!oportunidade) {
      throw Erros.naoEncontrado('OPORTUNIDADE_NAO_ENCONTRADA', 'Negocio nao encontrado');
    }
    const outrosOrcamentos = await db.orcamento.findMany({
      where: {
        empresaId,
        oportunidadeId: orcamento.oportunidadeId,
        id: { not: orcamento.id },
        status: { in: STATUS_SUBSTITUIVEIS },
      },
      select: { id: true, numero: true, status: true, total: true },
      orderBy: { criadoEm: 'asc' },
    });
    return { orcamento, oportunidade, outrosOrcamentos };
  }

  private async preverEstoque(
    empresaId: string,
    itens: Array<{ produtoId: string | null; quantidade: number }>,
  ) {
    const qtdPorProduto = new Map<string, number>();
    for (const item of itens) {
      if (!item.produtoId) continue;
      qtdPorProduto.set(
        item.produtoId,
        (qtdPorProduto.get(item.produtoId) ?? 0) + item.quantidade,
      );
    }
    const ids = [...qtdPorProduto.keys()];
    const produtos = ids.length
      ? await this.prisma.produto.findMany({
          where: { empresaId, id: { in: ids } },
          select: { id: true, estoqueAtual: true, controlaEstoque: true, nome: true },
        })
      : [];
    const porProduto = new Map<
      string,
      {
        saldoAtual: number;
        saldoPrevisto: number;
        controlaEstoque: boolean;
        nome: string;
      }
    >();
    const negativos: Array<{ produtoId: string; nome: string; saldoPrevisto: number }> = [];
    for (const p of produtos) {
      const qtd = qtdPorProduto.get(p.id) ?? 0;
      const saldoPrevisto = p.controlaEstoque ? p.estoqueAtual - qtd : p.estoqueAtual;
      porProduto.set(p.id, {
        saldoAtual: p.estoqueAtual,
        saldoPrevisto,
        controlaEstoque: p.controlaEstoque,
        nome: p.nome,
      });
      if (p.controlaEstoque && saldoPrevisto < 0) {
        negativos.push({ produtoId: p.id, nome: p.nome, saldoPrevisto });
      }
    }
    return { porProduto, negativos };
  }

  /**
   * Base = TOTAL_PEDIDO (P1 / ECOL-02). RT% = rtNegocio snapshot, não rtPadrao atual.
   * Líquido não habilitado até regra do contador.
   */
  private preverComissao(
    oportunidade: { parceiroId: string | null; rtNegocio: Prisma.Decimal | number | null },
    totalPedido: number,
  ) {
    if (!oportunidade.parceiroId) return null;
    const rt = Number(oportunidade.rtNegocio ?? 0);
    if (!(rt > 0)) return null;
    const base = arredondarDinheiro(totalPedido);
    const valor = arredondarDinheiro((base * rt) / 100);
    return {
      parceiroId: oportunidade.parceiroId,
      rtPercentual: rt,
      baseCalculo: base,
      valorComissao: valor,
      status: StatusComissaoPedido.A_PAGAR,
      baseOrigem: 'TOTAL_PEDIDO' as const,
    };
  }

  private async criarChecklist(
    tx: Tx,
    empresaId: string,
    pedidoId: string,
    temCompra: boolean,
    temComissao: boolean,
  ) {
    const itens: Array<{
      tipo: (typeof TipoChecklistPedido)[keyof typeof TipoChecklistPedido];
      aplicavel: boolean;
      automatico: boolean;
      ordem: number;
    }> = [
      { tipo: TipoChecklistPedido.PAGAMENTO_RECEBIDO, aplicavel: true, automatico: false, ordem: 0 },
      {
        tipo: TipoChecklistPedido.ITENS_COMPRADOS,
        aplicavel: temCompra,
        automatico: false,
        ordem: 1,
      },
      { tipo: TipoChecklistPedido.MATERIAL_SEPARADO, aplicavel: true, automatico: false, ordem: 2 },
      { tipo: TipoChecklistPedido.NF_EMITIDA, aplicavel: true, automatico: true, ordem: 3 },
      { tipo: TipoChecklistPedido.ENTREGUE, aplicavel: true, automatico: false, ordem: 4 },
      {
        tipo: TipoChecklistPedido.COMISSAO_PAGA,
        aplicavel: temComissao,
        automatico: true,
        ordem: 5,
      },
    ];
    await tx.checklistItemPedido.createMany({
      data: itens.map((i) => ({
        empresaId,
        pedidoId,
        tipo: i.tipo,
        rotulo: ROTULOS_CHECKLIST[i.tipo],
        aplicavel: i.aplicavel,
        automatico: i.automatico,
        concluido: false,
        ordem: i.ordem,
      })),
    });
  }

  /**
   * ECOL-19: pré-venda é derivada dos ORCs abertos. Com pedido e sem ORC aberto,
   * o negócio some da pré-venda; não usamos etapa PEDIDO_CONFIRMADO no funil do negócio
   * (essa coluna é do card de pedido). Se ainda houver ORC aberto, garante Orçamento em aberto.
   */
  private async sincronizarEtapaAposConversao(
    tx: Tx,
    empresaId: string,
    oportunidade: { id: string; etapaId: string; etapa: { id: string; nome: string } },
    usuarioId: string,
  ) {
    const abertos = await tx.orcamento.count({
      where: {
        empresaId,
        oportunidadeId: oportunidade.id,
        status: {
          in: [
            StatusOrcamento.RASCUNHO,
            StatusOrcamento.ENVIADO,
            StatusOrcamento.ACEITO,
          ],
        },
      },
    });
    if (abertos === 0) return;

    const etapa = await tx.etapaFunil.findFirst({
      where: {
        empresaId,
        chaveSistema: ChaveEtapaSistema.ORCAMENTO_EM_ABERTO,
        ativo: true,
      },
    });
    if (!etapa || etapa.id === oportunidade.etapaId) return;
    await tx.oportunidade.update({
      where: { id: oportunidade.id },
      data: { etapaId: etapa.id },
    });
    await tx.historicoEtapaOportunidade.create({
      data: {
        empresaId,
        oportunidadeId: oportunidade.id,
        etapaId: etapa.id,
        etapaNome: etapa.nome,
        etapaAnteriorId: oportunidade.etapaId,
        etapaAnteriorNome: oportunidade.etapa.nome,
        origem: OrigemHistoricoEtapa.MANUAL,
        usuarioId,
      },
    });
  }

  private serializarPedido(
    pedido: Prisma.PedidoGetPayload<{ include: typeof INCLUDE_COMPLETO }>,
  ) {
    const pagamentos = pedido.pagamentos ?? [];
    const valorRecebido = arredondarDinheiro(
      pagamentos
        .filter((p) => p.status === StatusPagamentoPedido.RECEBIDO)
        .reduce((a, p) => a + Number(p.valor), 0),
    );
    const total = arredondarDinheiro(pedido.total);
    return {
      ...pedido,
      valorRecebido,
      valorAReceber: arredondarDinheiro(total - valorRecebido),
      pagamentos: pagamentos.map((p) => ({
        ...p,
        valor: Number(p.valor),
      })),
      comissao: pedido.comissao
        ? {
            ...pedido.comissao,
            rtPercentual: Number(pedido.comissao.rtPercentual),
            baseCalculo: Number(pedido.comissao.baseCalculo),
            valorComissao: Number(pedido.comissao.valorComissao),
          }
        : null,
    };
  }

  private async reservarNumero(tx: Tx, empresaId: string): Promise<string> {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${`${empresaId}:pedido-numero`}))
    `;
    const lista = await tx.pedido.findMany({
      where: { empresaId, numero: { startsWith: 'PED-' } },
      select: { numero: true },
    });
    let max = 0;
    for (const p of lista) {
      const m = /^PED-(\d+)$/.exec(p.numero);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `PED-${String(max + 1).padStart(4, '0')}`;
  }
}

/** Reexport para testes unitários de modelos. */
export { montarLinhasPagamento, arredondarDinheiro };
