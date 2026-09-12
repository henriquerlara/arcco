import { Injectable } from '@nestjs/common';
import type {
  ajusteEstoqueSchema,
  criarProdutoSchema,
  entradaEstoqueSchema,
} from '@arcco/contratos';
import { TipoMovimentacaoEstoque } from '@arcco/contratos';
import type { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';

type CriarProdutoInput = z.infer<typeof criarProdutoSchema>;
type AtualizarProdutoInput = {
  sku?: string | null;
  nome?: string;
  descricao?: string | null;
  unidade?: string;
  precoVenda?: number;
  estoqueMinimo?: number;
  controlaEstoque?: boolean;
  ativo?: boolean;
};
type EntradaEstoqueInput = z.infer<typeof entradaEstoqueSchema>;
type AjusteEstoqueInput = z.infer<typeof ajusteEstoqueSchema>;

@Injectable()
export class ProdutosService {
  constructor(private readonly prisma: PrismaService) {}

  listar(empresaId: string, apenasAtivos = false) {
    return this.prisma.produto.findMany({
      where: { empresaId, ...(apenasAtivos ? { ativo: true } : {}) },
      orderBy: [{ nome: 'asc' }],
    });
  }

  /** Lista operacional de estoque com status crítico. */
  async listarEstoque(
    empresaId: string,
    filtros: { busca?: string; soCriticos?: boolean; soComControle?: boolean } = {},
  ) {
    const produtos = await this.prisma.produto.findMany({
      where: {
        empresaId,
        ativo: true,
        ...(filtros.soComControle !== false ? { controlaEstoque: true } : {}),
        ...(filtros.busca
          ? {
              OR: [
                { nome: { contains: filtros.busca } },
                { sku: { contains: filtros.busca } },
              ],
            }
          : {}),
      },
      orderBy: [{ nome: 'asc' }],
    });

    const comStatus = produtos.map((p) => ({
      ...p,
      critico: p.controlaEstoque && p.estoqueAtual <= p.estoqueMinimo,
      zerado: p.controlaEstoque && p.estoqueAtual <= 0,
    }));

    if (filtros.soCriticos) {
      return comStatus.filter((p) => p.critico);
    }
    return comStatus;
  }

  async resumoEstoque(empresaId: string) {
    const produtos = await this.prisma.produto.findMany({
      where: { empresaId, ativo: true, controlaEstoque: true },
      select: { id: true, estoqueAtual: true, estoqueMinimo: true },
    });
    const criticos = produtos.filter((p) => p.estoqueAtual <= p.estoqueMinimo);
    const zerados = produtos.filter((p) => p.estoqueAtual <= 0);
    return {
      totalComControle: produtos.length,
      criticos: criticos.length,
      zerados: zerados.length,
    };
  }

  async obter(empresaId: string, id: string) {
    const produto = await this.prisma.produto.findFirst({ where: { id, empresaId } });
    if (!produto) throw Erros.naoEncontrado('PRODUTO_NAO_ENCONTRADO', 'Produto nao encontrado');
    return {
      ...produto,
      critico: produto.controlaEstoque && produto.estoqueAtual <= produto.estoqueMinimo,
      zerado: produto.controlaEstoque && produto.estoqueAtual <= 0,
    };
  }

  async listarMovimentacoes(empresaId: string, produtoId: string, limite = 100) {
    await this.obter(empresaId, produtoId);
    return this.prisma.movimentacaoEstoque.findMany({
      where: { empresaId, produtoId },
      orderBy: { criadoEm: 'desc' },
      take: Math.min(limite, 200),
    });
  }

  async criar(empresaId: string, dto: CriarProdutoInput, usuarioId?: string | null) {
    const saldoInicial = dto.saldoInicial ?? 0;
    const controla = dto.controlaEstoque ?? true;

    return this.prisma.$transaction(async (tx) => {
      const produto = await tx.produto.create({
        data: {
          empresaId,
          sku: dto.sku?.trim() || null,
          nome: dto.nome,
          descricao: dto.descricao ?? null,
          unidade: dto.unidade ?? 'un',
          precoVenda: dto.precoVenda ?? 0,
          estoqueAtual: controla ? saldoInicial : 0,
          estoqueMinimo: dto.estoqueMinimo ?? 0,
          controlaEstoque: controla,
          ativo: dto.ativo ?? true,
        },
      });

      if (controla && saldoInicial > 0) {
        await tx.movimentacaoEstoque.create({
          data: {
            empresaId,
            produtoId: produto.id,
            tipo: TipoMovimentacaoEstoque.ENTRADA,
            quantidade: saldoInicial,
            saldoApos: saldoInicial,
            observacao: 'Saldo inicial no cadastro',
            usuarioId: usuarioId ?? null,
          },
        });
      }

      return produto;
    });
  }

  async atualizar(empresaId: string, id: string, dto: AtualizarProdutoInput) {
    await this.obter(empresaId, id);
    return this.prisma.produto.update({
      where: { id },
      data: {
        sku: dto.sku === undefined ? undefined : dto.sku?.trim() || null,
        nome: dto.nome,
        descricao: dto.descricao,
        unidade: dto.unidade,
        precoVenda: dto.precoVenda,
        estoqueMinimo: dto.estoqueMinimo,
        controlaEstoque: dto.controlaEstoque,
        ativo: dto.ativo,
      },
    });
  }

  async remover(empresaId: string, id: string) {
    await this.obter(empresaId, id);
    return this.prisma.produto.update({ where: { id }, data: { ativo: false } });
  }

  async entrada(empresaId: string, id: string, dto: EntradaEstoqueInput, usuarioId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const produto = await tx.produto.findFirst({ where: { id, empresaId } });
      if (!produto) throw Erros.naoEncontrado('PRODUTO_NAO_ENCONTRADO', 'Produto nao encontrado');
      if (!produto.controlaEstoque) {
        throw Erros.invalido('SEM_CONTROLE_ESTOQUE', 'Este produto nao controla estoque');
      }
      const saldoApos = produto.estoqueAtual + dto.quantidade;
      await tx.produto.update({ where: { id }, data: { estoqueAtual: saldoApos } });
      await tx.movimentacaoEstoque.create({
        data: {
          empresaId,
          produtoId: id,
          tipo: TipoMovimentacaoEstoque.ENTRADA,
          quantidade: dto.quantidade,
          saldoApos,
          observacao: dto.observacao ?? null,
          usuarioId: usuarioId ?? null,
        },
      });
      return tx.produto.findFirstOrThrow({ where: { id } });
    });
  }

  async ajuste(empresaId: string, id: string, dto: AjusteEstoqueInput, usuarioId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const produto = await tx.produto.findFirst({ where: { id, empresaId } });
      if (!produto) throw Erros.naoEncontrado('PRODUTO_NAO_ENCONTRADO', 'Produto nao encontrado');
      if (!produto.controlaEstoque) {
        throw Erros.invalido('SEM_CONTROLE_ESTOQUE', 'Este produto nao controla estoque');
      }

      const delta = dto.saldoContado - produto.estoqueAtual;
      if (delta === 0) {
        return produto;
      }

      const saldoApos = dto.saldoContado;
      await tx.produto.update({ where: { id }, data: { estoqueAtual: saldoApos } });
      await tx.movimentacaoEstoque.create({
        data: {
          empresaId,
          produtoId: id,
          tipo: TipoMovimentacaoEstoque.AJUSTE,
          quantidade: delta,
          saldoApos,
          observacao: dto.observacao,
          usuarioId: usuarioId ?? null,
        },
      });
      return tx.produto.findFirstOrThrow({ where: { id } });
    });
  }

  async baixarPorOrcamento(
    tx: Prisma.TransactionClient,
    empresaId: string,
    orcamentoId: string,
    oportunidadeId: string,
    usuarioId?: string | null,
  ) {
    const orcamento = await tx.orcamento.findFirst({
      where: { id: orcamentoId, empresaId },
      include: { itens: true },
    });
    if (!orcamento) return;

    for (const item of orcamento.itens) {
      if (!item.produtoId) continue;
      const produto = await tx.produto.findFirst({ where: { id: item.produtoId, empresaId } });
      if (!produto || !produto.controlaEstoque) continue;

      const saldoApos = produto.estoqueAtual - item.quantidade;
      await tx.produto.update({
        where: { id: produto.id },
        data: { estoqueAtual: saldoApos },
      });
      await tx.movimentacaoEstoque.create({
        data: {
          empresaId,
          produtoId: produto.id,
          tipo: TipoMovimentacaoEstoque.BAIXA,
          quantidade: item.quantidade,
          saldoApos,
          orcamentoId,
          oportunidadeId,
          observacao: `Baixa pelo orçamento ${orcamento.numero}`,
          usuarioId: usuarioId ?? null,
        },
      });
    }
  }
}
