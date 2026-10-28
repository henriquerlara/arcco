import { Injectable } from '@nestjs/common';
import type {
  ajusteEstoqueSchema,
  criarProdutoSchema,
  entradaEstoqueSchema,
} from '@arcco/contratos';
import {
  calcularPrecoSugerido,
  PermissaoComercial,
  possuiPermissao,
  statusEstoqueEcolume,
  TipoAuditoria,
  TipoMovimentacaoEstoque,
  type StatusEstoqueEcolume,
} from '@arcco/contratos';
import type { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { calcularCustoAposEntrada, precisaCustoReferenciaSaldo } from './custo-medio';

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
  ncm?: string | null;
  nomeFiscal?: string | null;
  descricaoComercial?: string | null;
  codigoFornecedor?: string | null;
  ean?: string | null;
  cest?: string | null;
  origemFiscal?: string | null;
  codigoInterno?: string | null;
};
type EntradaEstoqueInput = z.infer<typeof entradaEstoqueSchema>;
type AjusteEstoqueInput = z.infer<typeof ajusteEstoqueSchema>;

/**
 * Efeito já aplicado por `entrada`, `baixarPorOrcamento` e `ajuste`.
 * ENTRADA soma a quantidade gravada. BAIXA subtrai a quantidade gravada.
 * AJUSTE grava o delta (saldo contado menos saldo anterior), com sinal.
 * Não existe saldo inicial fora da movimentação: cadastro com saldo positivo
 * grava uma ENTRADA. Tolerância só absorve ruído de float, não divergência real.
 */
const TOLERANCIA_SALDO = 1e-6;

export function efeitoNoSaldo(tipo: TipoMovimentacaoEstoque, quantidade: number): number {
  if (tipo === TipoMovimentacaoEstoque.BAIXA) return -quantidade;
  if (tipo === TipoMovimentacaoEstoque.ENTRADA || tipo === TipoMovimentacaoEstoque.AJUSTE) {
    return quantidade;
  }
  const desconhecido: never = tipo;
  throw Erros.invalido('MOVIMENTACAO_DESCONHECIDA', `Tipo de movimentacao nao reconhecido: ${String(desconhecido)}`);
}

/** Some só na resposta da empresa com a flag. Custo continua sujeito à ECOL-26a. */
const CAMPOS_SO_ECOLUME = new Set([
  'nomeFiscal',
  'descricaoComercial',
  'codigoFornecedor',
  'ean',
  'cest',
  'origemFiscal',
  'codigoInterno',
  'fatorConversao',
  'ipi',
  'margem',
  'custoMedio',
  'ultimoPreco',
  'precoUnitarioCusto',
  'custoReferenciaSaldo',
  'motivo',
]);

function numeroDoCodigo(codigo: string | null): number {
  const encontrado = codigo?.match(/^CI-(\d+)$/);
  return encontrado ? Number(encontrado[1]) : 0;
}

function omitirEstruturaNova<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map((item) => omitirEstruturaNova(item)) as T;
  if (!valor || typeof valor !== 'object') return valor;
  if (valor instanceof Date) return valor;
  if (Prisma.Decimal.isDecimal(valor)) return Number(valor) as T;
  const saida: Record<string, unknown> = {};
  for (const [campo, conteudo] of Object.entries(valor as Record<string, unknown>)) {
    if (CAMPOS_SO_ECOLUME.has(campo)) continue;
    saida[campo] = omitirEstruturaNova(conteudo);
  }
  return saida as T;
}

/** Resposta HTTP e testes continuam com number; o banco guarda DECIMAL(18,4). */
function normalizarDecimais<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map((item) => normalizarDecimais(item)) as T;
  if (!valor || typeof valor !== 'object') return valor;
  if (valor instanceof Date) return valor;
  if (Prisma.Decimal.isDecimal(valor)) return Number(valor) as T;
  const saida: Record<string, unknown> = {};
  for (const [campo, conteudo] of Object.entries(valor as Record<string, unknown>)) {
    saida[campo] = normalizarDecimais(conteudo);
  }
  return saida as T;
}

function numeroOuNulo(valor: Prisma.Decimal | number | null | undefined): number | null {
  if (valor == null) return null;
  return Number(valor);
}

@Injectable()
export class ProdutosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly permissoes: PermissoesService,
  ) {}

  private async expor<T>(empresaId: string, valor: T): Promise<T> {
    const normalizado = normalizarDecimais(valor);
    if (await this.permissoes.empresaEcolume(empresaId)) return normalizado;
    return omitirEstruturaNova(normalizado);
  }

  private async proximoCodigo(tx: Prisma.TransactionClient, empresaId: string): Promise<string> {
    const existentes = await tx.produto.findMany({
      where: { empresaId, codigoInterno: { not: null } },
      select: { codigoInterno: true },
    });
    const maior = existentes.reduce((max, item) => Math.max(max, numeroDoCodigo(item.codigoInterno)), 0);
    return `CI-${String(maior + 1).padStart(6, '0')}`;
  }

  private async gravarCodigo(
    tx: Prisma.TransactionClient,
    empresaId: string,
    id: string,
    codigo: string,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE "produtos"
      SET "codigoInterno" = ${codigo}
      WHERE "id" = ${id}
        AND "empresaId" = ${empresaId}
        AND "codigoInterno" IS NULL
    `;
  }

  /**
   * Atribui código interno só onde está vazio, na ordem de criação.
   * Não altera saldo, preço, SKU nem código já gravado. Sem a flag, não grava.
   */
  async garantirCodigosInternos(empresaId: string): Promise<number> {
    if (!(await this.permissoes.empresaEcolume(empresaId))) return 0;
    return this.prisma.$transaction(async (tx) => {
      const produtos = await tx.produto.findMany({
        where: { empresaId },
        orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
        select: { id: true, codigoInterno: true },
      });
      let maior = produtos.reduce((max, item) => Math.max(max, numeroDoCodigo(item.codigoInterno)), 0);
      let atribuidos = 0;
      for (const produto of produtos) {
        if (produto.codigoInterno) continue;
        maior += 1;
        const codigo = `CI-${String(maior).padStart(6, '0')}`;
        await this.gravarCodigo(tx, empresaId, produto.id, codigo);
        atribuidos += 1;
      }
      return atribuidos;
    });
  }

  async listar(empresaId: string, apenasAtivos = false) {
    const ecolume = await this.permissoes.empresaEcolume(empresaId);
    if (!ecolume) {
      const produtos = await this.prisma.produto.findMany({
        where: { empresaId, ...(apenasAtivos ? { ativo: true } : {}) },
        orderBy: [{ nome: 'asc' }],
      });
      return this.expor(empresaId, produtos);
    }
    const produtos = await this.prisma.produto.findMany({
      where: { empresaId, ...(apenasAtivos ? { ativo: true } : {}) },
      orderBy: [{ nome: 'asc' }],
      include: {
        fornecedor: { select: { id: true, nome: true, aliquotaSt: true } },
      },
    });
    // Anexo de preço sugerido (§10.3) — visível sem VER_CUSTOS.
    const comSugerido = produtos.map((p) => {
      const st =
        p.fornecedor?.aliquotaSt == null ? null : Number(p.fornecedor.aliquotaSt);
      const ultimo = p.ultimoPreco == null ? null : Number(p.ultimoPreco);
      return {
        ...p,
        precoSugerido: calcularPrecoSugerido({
          ultimoPreco: ultimo,
          ipiPercentual: p.ipi,
          aliquotaStPercentual: st,
          margem: p.margem,
        }),
      };
    });
    return this.expor(empresaId, comSugerido);
  }

  /** Lista operacional de estoque. Com ECOLUME: status 7.11, busca ampliada e filtros. */
  async listarEstoque(
    empresaId: string,
    filtros: {
      busca?: string;
      soCriticos?: boolean;
      soComControle?: boolean;
      fornecedorId?: string;
      status?: StatusEstoqueEcolume;
    } = {},
  ) {
    if (await this.permissoes.empresaEcolume(empresaId)) {
      return this.listarEstoqueEcolume(empresaId, filtros);
    }

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
      return this.expor(empresaId, comStatus.filter((p) => p.critico));
    }
    return this.expor(empresaId, comStatus);
  }

  private async listarEstoqueEcolume(
    empresaId: string,
    filtros: {
      busca?: string;
      soCriticos?: boolean;
      fornecedorId?: string;
      status?: StatusEstoqueEcolume;
    },
  ) {
    const termo = filtros.busca?.trim();
    const produtos = await this.prisma.produto.findMany({
      where: {
        empresaId,
        ativo: true,
        ...(filtros.fornecedorId ? { fornecedorId: filtros.fornecedorId } : {}),
        ...(termo
          ? {
              OR: [
                { nome: { contains: termo, mode: 'insensitive' } },
                { descricaoComercial: { contains: termo, mode: 'insensitive' } },
                { nomeFiscal: { contains: termo, mode: 'insensitive' } },
                { codigoInterno: { contains: termo, mode: 'insensitive' } },
                { codigoFornecedor: { contains: termo, mode: 'insensitive' } },
                { ean: { contains: termo } },
                { sku: { contains: termo, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        fornecedor: {
          select: { id: true, nome: true, nomeCurto: true, aliquotaSt: true },
        },
      },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
    });

    let linhas = produtos.map((p) => {
      const ultimoPreco = p.ultimoPreco == null ? null : Number(p.ultimoPreco);
      const custoMedio = p.custoMedio == null ? null : Number(p.custoMedio);
      const aliquotaSt =
        p.fornecedor?.aliquotaSt == null ? null : Number(p.fornecedor.aliquotaSt);
      const status = statusEstoqueEcolume(p);
      return {
        id: p.id,
        nome: p.nome,
        sku: p.sku,
        unidade: p.unidade,
        estoqueAtual: p.estoqueAtual,
        estoqueMinimo: p.estoqueMinimo,
        controlaEstoque: p.controlaEstoque,
        ativo: p.ativo,
        precoVenda: p.precoVenda,
        codigoInterno: p.codigoInterno,
        nomeFiscal: p.nomeFiscal,
        descricaoComercial: p.descricaoComercial ?? p.nome,
        codigoFornecedor: p.codigoFornecedor,
        ean: p.ean,
        fornecedorId: p.fornecedorId,
        fornecedor: p.fornecedor
          ? {
              id: p.fornecedor.id,
              nome: p.fornecedor.nome,
              nomeCurto: p.fornecedor.nomeCurto,
              aliquotaSt,
            }
          : null,
        ipi: p.ipi,
        margem: p.margem,
        custoMedio,
        ultimoPreco,
        precoSugerido: calcularPrecoSugerido({
          ultimoPreco,
          ipiPercentual: p.ipi,
          aliquotaStPercentual: aliquotaSt,
          margem: p.margem,
        }),
        status,
        critico: status === 'BAIXO' || status === 'A_COMPRAR',
        zerado: false,
      };
    });

    if (filtros.status) {
      linhas = linhas.filter((l) => l.status === filtros.status);
    } else if (filtros.soCriticos) {
      linhas = linhas.filter((l) => l.status === 'BAIXO' || l.status === 'A_COMPRAR');
    }

    return this.expor(empresaId, linhas);
  }

  async resumoEstoque(empresaId: string) {
    if (await this.permissoes.empresaEcolume(empresaId)) {
      const produtos = await this.prisma.produto.findMany({
        where: { empresaId, ativo: true },
        select: {
          controlaEstoque: true,
          estoqueAtual: true,
          estoqueMinimo: true,
        },
      });
      let abaixoMinimo = 0;
      let aComprar = 0;
      let sobEncomenda = 0;
      for (const p of produtos) {
        const status = statusEstoqueEcolume(p);
        if (status === 'BAIXO') abaixoMinimo += 1;
        else if (status === 'A_COMPRAR') aComprar += 1;
        else if (status === 'SOB_ENCOMENDA') sobEncomenda += 1;
      }
      return {
        produtosCadastrados: produtos.length,
        abaixoMinimo,
        aComprar,
        sobEncomenda,
        // Compatível com clientes que ainda leem as chaves legadas.
        totalComControle: produtos.filter((p) => p.controlaEstoque).length,
        criticos: abaixoMinimo + aComprar,
        zerados: 0,
      };
    }

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

  /** Histórico global (aba Movimentações). Só ECOLUME. */
  async listarMovimentacoesEstoque(
    empresaId: string,
    filtros: {
      produtoId?: string;
      tipo?: TipoMovimentacaoEstoque;
      de?: string;
      ate?: string;
      usuarioId?: string;
      limite?: number;
    } = {},
  ) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.naoEncontrado(
        'MOVIMENTACOES_INDISPONIVEL',
        'Historico global de movimentacoes disponivel apenas na personalizacao ECOLUME',
      );
    }
    const de = filtros.de ? new Date(filtros.de) : undefined;
    const ate = filtros.ate ? new Date(filtros.ate) : undefined;
    const movimentos = await this.prisma.movimentacaoEstoque.findMany({
      where: {
        empresaId,
        ...(filtros.produtoId ? { produtoId: filtros.produtoId } : {}),
        ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
        ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
        ...(de || ate
          ? {
              criadoEm: {
                ...(de && !Number.isNaN(de.getTime()) ? { gte: de } : {}),
                ...(ate && !Number.isNaN(ate.getTime()) ? { lte: ate } : {}),
              },
            }
          : {}),
      },
      include: {
        produto: {
          select: {
            id: true,
            nome: true,
            descricaoComercial: true,
            codigoInterno: true,
            unidade: true,
          },
        },
      },
      orderBy: { criadoEm: 'desc' },
      take: Math.min(filtros.limite ?? 200, 500),
    });
    return this.expor(empresaId, movimentos);
  }

  /** Saldo negativo agrupado por fornecedor. Sem pedidos (ECOL-16). */
  async listaCompra(empresaId: string) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.naoEncontrado(
        'LISTA_COMPRA_INDISPONIVEL',
        'Lista de compra disponivel apenas na personalizacao ECOLUME',
      );
    }
    const produtos = await this.prisma.produto.findMany({
      where: {
        empresaId,
        ativo: true,
        controlaEstoque: true,
        estoqueAtual: { lt: 0 },
      },
      include: {
        fornecedor: { select: { id: true, nome: true, nomeCurto: true, cnpj: true } },
      },
      orderBy: [{ nome: 'asc' }],
    });

    type Grupo = {
      fornecedorId: string | null;
      fornecedorNome: string;
      fornecedorCnpj: string | null;
      itens: Array<{
        produtoId: string;
        descricaoComercial: string;
        codigoInterno: string | null;
        codigoFornecedor: string | null;
        unidade: string;
        saldo: number;
        quantidadeFaltante: number;
      }>;
      totalFaltante: number;
    };

    const mapa = new Map<string, Grupo>();
    for (const p of produtos) {
      const chave = p.fornecedorId ?? '__sem_fornecedor__';
      let grupo = mapa.get(chave);
      if (!grupo) {
        grupo = {
          fornecedorId: p.fornecedorId,
          fornecedorNome: p.fornecedor?.nomeCurto || p.fornecedor?.nome || 'Sem fornecedor',
          fornecedorCnpj: p.fornecedor?.cnpj ?? null,
          itens: [],
          totalFaltante: 0,
        };
        mapa.set(chave, grupo);
      }
      const faltante = Math.abs(p.estoqueAtual);
      grupo.itens.push({
        produtoId: p.id,
        descricaoComercial: p.descricaoComercial ?? p.nome,
        codigoInterno: p.codigoInterno,
        codigoFornecedor: p.codigoFornecedor,
        unidade: p.unidade,
        saldo: p.estoqueAtual,
        quantidadeFaltante: faltante,
      });
      grupo.totalFaltante += faltante;
    }

    return [...mapa.values()].sort((a, b) => a.fornecedorNome.localeCompare(b.fornecedorNome, 'pt-BR'));
  }

  buscar(empresaId: string, id: string) {
    return this.prisma.produto.findFirst({ where: { id, empresaId } });
  }

  async obter(empresaId: string, id: string) {
    const produto = await this.buscar(empresaId, id);
    if (!produto) throw Erros.naoEncontrado('PRODUTO_NAO_ENCONTRADO', 'Produto nao encontrado');
    return this.expor(empresaId, {
      ...produto,
      critico: produto.controlaEstoque && produto.estoqueAtual <= produto.estoqueMinimo,
      zerado: produto.controlaEstoque && produto.estoqueAtual <= 0,
    });
  }

  async listarMovimentacoes(empresaId: string, produtoId: string, limite = 100) {
    await this.obter(empresaId, produtoId);
    const movimentos = await this.prisma.movimentacaoEstoque.findMany({
      where: { empresaId, produtoId },
      orderBy: { criadoEm: 'desc' },
      take: Math.min(limite, 200),
    });
    return this.expor(empresaId, movimentos);
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
          ncm: dto.ncm?.replace(/\D/g, '') || null,
          nomeFiscal: dto.nomeFiscal ?? null,
          descricaoComercial: dto.descricaoComercial ?? null,
          codigoFornecedor: dto.codigoFornecedor ?? null,
          ean: dto.ean ?? null,
          cest: dto.cest ?? null,
          origemFiscal: dto.origemFiscal ?? null,
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
        await this.auditoria.registrar(tx, {
          empresaId,
          usuarioId,
          tipo: TipoAuditoria.ENTRADA_ESTOQUE,
          entidade: 'produto',
          entidadeId: produto.id,
          anterior: { estoqueAtual: 0 },
          posterior: { estoqueAtual: saldoInicial, quantidade: saldoInicial },
        });
      }

      if (await this.permissoes.empresaEcolume(empresaId)) {
        const codigo = await this.proximoCodigo(tx, empresaId);
        await this.gravarCodigo(tx, empresaId, produto.id, codigo);
      }

      return tx.produto.findFirstOrThrow({ where: { id: produto.id } });
    }).then((produto) => this.expor(empresaId, produto));
  }

  /**
   * ECOL-15 — cadastro rápido a partir do orçamento.
   * Saldo 0, código interno, último preço de referência; sem movimento e sem custo médio.
   */
  async criarCadastroRapidoTx(
    tx: Prisma.TransactionClient,
    empresaId: string,
    entrada: {
      nome: string;
      descricaoComercial?: string | null;
      unidade?: string;
      fornecedorId: string;
      custoReferencia: number;
      ipi?: number | null;
      margem?: number | null;
      precoVenda?: number;
    },
  ) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.invalido('CADASTRO_RAPIDO_INDISPONIVEL', 'Cadastro rapido so na personalizacao ECOLUME');
    }
    const fornecedor = await tx.fornecedor.findFirst({
      where: { id: entrada.fornecedorId, empresaId, ativo: true },
      select: { id: true, aliquotaSt: true },
    });
    if (!fornecedor) {
      throw Erros.naoEncontrado('FORNECEDOR_NAO_ENCONTRADO', 'Fornecedor nao encontrado');
    }
    if (entrada.custoReferencia == null || !Number.isFinite(entrada.custoReferencia) || entrada.custoReferencia < 0) {
      throw Erros.invalido('CUSTO_REFERENCIA_OBRIGATORIO', 'Informe o custo de referencia do item novo');
    }

    const produto = await tx.produto.create({
      data: {
        empresaId,
        nome: entrada.nome.trim(),
        descricaoComercial: (entrada.descricaoComercial ?? entrada.nome).trim(),
        unidade: entrada.unidade?.trim() || 'un',
        fornecedorId: fornecedor.id,
        ipi: entrada.ipi ?? 0,
        margem: entrada.margem ?? null,
        precoVenda: entrada.precoVenda ?? 0,
        estoqueAtual: 0,
        estoqueMinimo: 0,
        controlaEstoque: true,
        ativo: true,
        custoMedio: null,
        ultimoPreco: new Prisma.Decimal(entrada.custoReferencia.toFixed(4)),
      },
    });

    const codigo = await this.proximoCodigo(tx, empresaId);
    await this.gravarCodigo(tx, empresaId, produto.id, codigo);

    return tx.produto.findFirstOrThrow({
      where: { id: produto.id, empresaId },
      include: { fornecedor: { select: { aliquotaSt: true } } },
    });
  }

  async atualizar(
    empresaId: string,
    id: string,
    dto: AtualizarProdutoInput,
    usuarioId?: string | null,
  ) {
    const atual = await this.obter(empresaId, id);
    if (dto.codigoInterno !== undefined && dto.codigoInterno !== atual.codigoInterno) {
      throw Erros.invalido('CODIGO_INTERNO_IMUTAVEL', 'O codigo interno nao pode ser alterado');
    }
    return this.prisma.$transaction(async (tx) => {
      const produto = await tx.produto.update({
        where: { id },
        data: {
          sku: dto.sku === undefined ? undefined : dto.sku?.trim() || null,
          nome: dto.nome,
          descricao: dto.descricao,
          unidade: dto.unidade,
          ncm: dto.ncm === undefined ? undefined : dto.ncm?.replace(/\D/g, '') || null,
          nomeFiscal: dto.nomeFiscal,
          descricaoComercial: dto.descricaoComercial,
          codigoFornecedor: dto.codigoFornecedor,
          ean: dto.ean,
          cest: dto.cest,
          origemFiscal: dto.origemFiscal,
          precoVenda: dto.precoVenda,
          estoqueMinimo: dto.estoqueMinimo,
          controlaEstoque: dto.controlaEstoque,
          ativo: dto.ativo,
        },
      });
      if (dto.precoVenda !== undefined && dto.precoVenda !== atual.precoVenda) {
        await this.auditoria.registrar(tx, {
          empresaId,
          usuarioId,
          tipo: TipoAuditoria.ALTERACAO_PRECO,
          entidade: 'produto',
          entidadeId: id,
          anterior: { precoVenda: atual.precoVenda },
          posterior: { precoVenda: dto.precoVenda },
        });
      }
      return this.expor(empresaId, produto);
    });
  }

  async remover(
    empresaId: string,
    id: string,
    ator?: { id: string; perfil: string } | null,
  ) {
    await this.obter(empresaId, id);
    if (ator && (await this.permissoes.empresaEcolume(empresaId))) {
      await this.permissoes.afirmar(
        { id: ator.id, empresaId, perfil: ator.perfil },
        PermissaoComercial.EXCLUIR_PRODUTO,
      );
      const movimentos = await this.prisma.movimentacaoEstoque.count({
        where: { empresaId, produtoId: id },
      });
      if (movimentos > 0) {
        throw Erros.invalido(
          'PRODUTO_COM_MOVIMENTACAO',
          'Nao e possivel excluir produto com movimentacao de estoque',
        );
      }
    }
    const produto = await this.prisma.produto.update({ where: { id }, data: { ativo: false } });
    return this.expor(empresaId, produto);
  }

  async entrada(empresaId: string, id: string, dto: EntradaEstoqueInput, usuarioId?: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT 1 FROM "produtos"
        WHERE "id" = ${id} AND "empresaId" = ${empresaId}
        FOR UPDATE
      `;
      const produto = await tx.produto.findFirst({ where: { id, empresaId } });
      if (!produto) throw Erros.naoEncontrado('PRODUTO_NAO_ENCONTRADO', 'Produto nao encontrado');
      if (!produto.controlaEstoque) {
        throw Erros.invalido('SEM_CONTROLE_ESTOQUE', 'Este produto nao controla estoque');
      }

      const ecolume = await this.permissoes.empresaEcolume(empresaId);
      const custoInformado =
        ecolume && dto.precoUnitarioCusto !== undefined ? dto.precoUnitarioCusto : null;
      const custoMedioAnterior = numeroOuNulo(produto.custoMedio);
      const ultimoPrecoAnterior = numeroOuNulo(produto.ultimoPreco);
      const referenciaSaldo =
        ecolume && dto.custoReferenciaSaldo !== undefined ? dto.custoReferenciaSaldo : null;

      if (
        custoInformado != null &&
        precisaCustoReferenciaSaldo(produto.estoqueAtual, custoMedioAnterior) &&
        referenciaSaldo == null
      ) {
        throw Erros.invalido(
          'CUSTO_REFERENCIA_OBRIGATORIO',
          'Informe o custo de referencia do saldo existente antes de registrar a entrada com custo',
        );
      }

      const custos =
        custoInformado == null
          ? null
          : calcularCustoAposEntrada({
              saldoAnterior: produto.estoqueAtual,
              custoMedioAnterior,
              quantidadeEntrada: dto.quantidade,
              precoUnitario: custoInformado,
              custoReferenciaSaldo: referenciaSaldo,
            });

      const saldoApos = produto.estoqueAtual + dto.quantidade;
      await tx.produto.update({
        where: { id },
        data: {
          estoqueAtual: saldoApos,
          ...(custos
            ? {
                custoMedio: new Prisma.Decimal(custos.custoMedio.toFixed(4)),
                ultimoPreco: new Prisma.Decimal(custos.ultimoPreco.toFixed(4)),
              }
            : {}),
        },
      });
      await tx.movimentacaoEstoque.create({
        data: {
          empresaId,
          produtoId: id,
          tipo: TipoMovimentacaoEstoque.ENTRADA,
          quantidade: dto.quantidade,
          saldoApos,
          observacao: dto.observacao ?? null,
          usuarioId: usuarioId ?? null,
          precoUnitarioCusto:
            custoInformado == null ? null : new Prisma.Decimal(custoInformado.toFixed(4)),
        },
      });
      await this.auditoria.registrar(tx, {
        empresaId,
        usuarioId,
        tipo: TipoAuditoria.ENTRADA_ESTOQUE,
        entidade: 'produto',
        entidadeId: id,
        anterior: {
          estoqueAtual: produto.estoqueAtual,
          custoMedio: custoMedioAnterior,
          ultimoPreco: ultimoPrecoAnterior,
        },
        posterior: {
          estoqueAtual: saldoApos,
          quantidade: dto.quantidade,
          ...(custos
            ? {
                precoUnitarioCusto: custoInformado,
                ...(referenciaSaldo != null ? { custoReferenciaSaldo: referenciaSaldo } : {}),
                custoMedio: custos.custoMedio,
                ultimoPreco: custos.ultimoPreco,
              }
            : {}),
        },
      });
      return this.expor(empresaId, await tx.produto.findFirstOrThrow({ where: { id } }));
    });
  }

  async ajuste(
    empresaId: string,
    id: string,
    dto: AjusteEstoqueInput,
    usuario?: { id: string; perfil: string } | string,
  ) {
    const usuarioId = typeof usuario === 'string' ? usuario : usuario?.id;
    const perfil = typeof usuario === 'string' ? undefined : usuario?.perfil;

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT 1 FROM "produtos"
        WHERE "id" = ${id} AND "empresaId" = ${empresaId}
        FOR UPDATE
      `;
      const produto = await tx.produto.findFirst({ where: { id, empresaId } });
      if (!produto) throw Erros.naoEncontrado('PRODUTO_NAO_ENCONTRADO', 'Produto nao encontrado');
      if (!produto.controlaEstoque) {
        throw Erros.invalido('SEM_CONTROLE_ESTOQUE', 'Este produto nao controla estoque');
      }

      const ecolume = await this.permissoes.empresaEcolume(empresaId);
      if (ecolume) {
        if (!usuarioId || !perfil) {
          throw Erros.semPermissao();
        }
        const ctx = await this.permissoes.resolver({ id: usuarioId, empresaId, perfil });
        if (!possuiPermissao(ctx, PermissaoComercial.AJUSTAR_ESTOQUE)) {
          throw Erros.semPermissao();
        }
        if (!dto.motivo) {
          throw Erros.invalido('MOTIVO_OBRIGATORIO', 'Informe o motivo do ajuste');
        }
      } else {
        if (dto.saldoContado === undefined) {
          throw Erros.invalido('SALDO_CONTADO_OBRIGATORIO', 'Informe o saldo contado');
        }
        if (!dto.observacao || dto.observacao.trim().length < 2) {
          throw Erros.invalido('MOTIVO_OBRIGATORIO', 'Informe o motivo do ajuste');
        }
      }

      let saldoApos: number;
      if (dto.diferenca !== undefined && dto.saldoContado !== undefined) {
        const esperado = produto.estoqueAtual + dto.diferenca;
        if (Math.abs(esperado - dto.saldoContado) >= TOLERANCIA_SALDO) {
          throw Erros.invalido(
            'AJUSTE_INCONSISTENTE',
            'Saldo final e diferenca nao batem com o estoque atual',
          );
        }
        saldoApos = dto.saldoContado;
      } else if (dto.diferenca !== undefined) {
        saldoApos = produto.estoqueAtual + dto.diferenca;
      } else {
        saldoApos = dto.saldoContado!;
        if (ecolume) {
          if (dto.saldoAnteriorEsperado === undefined) {
            throw Erros.invalido(
              'SALDO_ESPERADO_OBRIGATORIO',
              'Informe o saldo anterior esperado ao ajustar pelo saldo final',
            );
          }
          if (Math.abs(dto.saldoAnteriorEsperado - produto.estoqueAtual) >= TOLERANCIA_SALDO) {
            throw Erros.conflito(
              'SALDO_DESATUALIZADO',
              'O saldo mudou desde a leitura. Atualize e tente de novo',
            );
          }
        }
      }

      const delta = saldoApos - produto.estoqueAtual;
      if (Math.abs(delta) < TOLERANCIA_SALDO) {
        return this.expor(empresaId, produto);
      }

      const custoMedioAnterior = numeroOuNulo(produto.custoMedio);
      const ultimoPrecoAnterior = numeroOuNulo(produto.ultimoPreco);
      const custoInformado =
        ecolume && delta > 0 && dto.precoUnitarioCusto !== undefined ? dto.precoUnitarioCusto : null;
      const referenciaSaldo =
        ecolume && dto.custoReferenciaSaldo !== undefined ? dto.custoReferenciaSaldo : null;

      if (
        custoInformado != null &&
        precisaCustoReferenciaSaldo(produto.estoqueAtual, custoMedioAnterior) &&
        referenciaSaldo == null
      ) {
        throw Erros.invalido(
          'CUSTO_REFERENCIA_OBRIGATORIO',
          'Informe o custo de referencia do saldo existente antes de registrar o ajuste com custo',
        );
      }

      const custos =
        custoInformado == null
          ? null
          : calcularCustoAposEntrada({
              saldoAnterior: produto.estoqueAtual,
              custoMedioAnterior,
              quantidadeEntrada: delta,
              precoUnitario: custoInformado,
              custoReferenciaSaldo: referenciaSaldo,
            });

      await tx.produto.update({
        where: { id },
        data: {
          estoqueAtual: saldoApos,
          ...(custos
            ? {
                custoMedio: new Prisma.Decimal(custos.custoMedio.toFixed(4)),
                ultimoPreco: new Prisma.Decimal(custos.ultimoPreco.toFixed(4)),
              }
            : {}),
        },
      });
      await tx.movimentacaoEstoque.create({
        data: {
          empresaId,
          produtoId: id,
          tipo: TipoMovimentacaoEstoque.AJUSTE,
          quantidade: delta,
          saldoApos,
          observacao: dto.observacao?.trim() || null,
          motivo: ecolume ? (dto.motivo ?? null) : null,
          usuarioId: usuarioId ?? null,
          precoUnitarioCusto:
            custoInformado == null ? null : new Prisma.Decimal(custoInformado.toFixed(4)),
        },
      });
      await this.auditoria.registrar(tx, {
        empresaId,
        usuarioId,
        tipo: TipoAuditoria.AJUSTE_ESTOQUE,
        entidade: 'produto',
        entidadeId: id,
        anterior: {
          estoqueAtual: produto.estoqueAtual,
          custoMedio: custoMedioAnterior,
          ultimoPreco: ultimoPrecoAnterior,
        },
        posterior: {
          estoqueAtual: saldoApos,
          quantidade: delta,
          ...(ecolume && dto.motivo ? { motivo: dto.motivo } : {}),
          ...(dto.observacao?.trim() ? { observacao: dto.observacao.trim() } : {}),
          ...(custos
            ? {
                precoUnitarioCusto: custoInformado,
                ...(referenciaSaldo != null ? { custoReferenciaSaldo: referenciaSaldo } : {}),
                custoMedio: custos.custoMedio,
                ultimoPreco: custos.ultimoPreco,
              }
            : {}),
        },
      });
      return this.expor(empresaId, await tx.produto.findFirstOrThrow({ where: { id } }));
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
      await this.auditoria.registrar(tx, {
        empresaId,
        usuarioId,
        tipo: TipoAuditoria.SAIDA_ESTOQUE,
        entidade: 'produto',
        entidadeId: produto.id,
        anterior: { estoqueAtual: produto.estoqueAtual },
        posterior: {
          estoqueAtual: saldoApos,
          quantidade: item.quantidade,
          orcamentoId,
          oportunidadeId,
        },
      });
    }
  }

  /**
   * ECOL-17 — baixa pelo pedido. Saldo negativo permitido; não altera custo médio
   * nem último preço. Produtos ordenados por id para evitar deadlock.
   * Idempotente: se já houver BAIXA com este pedidoId, não baixa de novo.
   */
  async baixarPorPedido(
    tx: Prisma.TransactionClient,
    empresaId: string,
    pedido: {
      id: string;
      numero: string;
      oportunidadeId: string;
      orcamentoId: string;
      itens: Array<{ produtoId: string | null; quantidade: number; nome: string; ordem: number }>;
    },
    usuarioId?: string | null,
  ): Promise<{ separacao: Array<{ produtoId: string; nome: string; quantidade: number; ordem: number; saldoApos: number }>; compra: Array<{ produtoId: string; nome: string; quantidadeFalta: number; ordem: number }> }> {
    const jaBaixou = await tx.movimentacaoEstoque.findFirst({
      where: { empresaId, pedidoId: pedido.id, tipo: TipoMovimentacaoEstoque.BAIXA },
      select: { id: true },
    });
    if (jaBaixou) {
      return { separacao: [], compra: [] };
    }

    const agregados = new Map<string, { quantidade: number; nome: string; ordem: number }>();
    for (const item of pedido.itens) {
      if (!item.produtoId) continue;
      const atual = agregados.get(item.produtoId);
      if (atual) {
        atual.quantidade += item.quantidade;
        atual.ordem = Math.min(atual.ordem, item.ordem);
      } else {
        agregados.set(item.produtoId, {
          quantidade: item.quantidade,
          nome: item.nome,
          ordem: item.ordem,
        });
      }
    }

    const ids = [...agregados.keys()].sort();
    const separacao: Array<{
      produtoId: string;
      nome: string;
      quantidade: number;
      ordem: number;
      saldoApos: number;
    }> = [];
    const compra: Array<{
      produtoId: string;
      nome: string;
      quantidadeFalta: number;
      ordem: number;
    }> = [];

    for (const produtoId of ids) {
      await tx.$executeRaw`
        SELECT 1 FROM "produtos"
        WHERE "id" = ${produtoId} AND "empresaId" = ${empresaId}
        FOR UPDATE
      `;
      const produto = await tx.produto.findFirst({ where: { id: produtoId, empresaId } });
      const agg = agregados.get(produtoId)!;
      if (!produto || !produto.controlaEstoque) continue;

      const saldoAnterior = produto.estoqueAtual;
      const saldoApos = saldoAnterior - agg.quantidade;
      await tx.produto.update({
        where: { id: produto.id },
        data: { estoqueAtual: saldoApos },
      });
      await tx.movimentacaoEstoque.create({
        data: {
          empresaId,
          produtoId: produto.id,
          tipo: TipoMovimentacaoEstoque.BAIXA,
          quantidade: agg.quantidade,
          saldoApos,
          orcamentoId: pedido.orcamentoId,
          oportunidadeId: pedido.oportunidadeId,
          pedidoId: pedido.id,
          observacao: `Baixa pelo pedido ${pedido.numero}`,
          usuarioId: usuarioId ?? null,
        },
      });
      await this.auditoria.registrar(tx, {
        empresaId,
        usuarioId,
        tipo: TipoAuditoria.SAIDA_ESTOQUE,
        entidade: 'produto',
        entidadeId: produto.id,
        anterior: { estoqueAtual: saldoAnterior },
        posterior: {
          estoqueAtual: saldoApos,
          quantidade: agg.quantidade,
          pedidoId: pedido.id,
          orcamentoId: pedido.orcamentoId,
          oportunidadeId: pedido.oportunidadeId,
        },
      });

      separacao.push({
        produtoId: produto.id,
        nome: agg.nome || produto.nome,
        quantidade: agg.quantidade,
        ordem: agg.ordem,
        saldoApos,
      });
      if (saldoApos < 0) {
        compra.push({
          produtoId: produto.id,
          nome: agg.nome || produto.nome,
          quantidadeFalta: Math.abs(saldoApos),
          ordem: agg.ordem,
        });
      }
    }

    return { separacao, compra };
  }

  /**
   * ECOL-18 — estorno das BAIXAs reais do pedido (não recalcula pelo cadastro).
   * ENTRADA sem alterar custo médio / último preço. Idempotente por motivo ESTORNO_PEDIDO.
   */
  async estornarPorPedido(
    tx: Prisma.TransactionClient,
    empresaId: string,
    pedido: { id: string; numero: string; oportunidadeId: string; orcamentoId: string },
    usuarioId?: string | null,
  ): Promise<{ estornos: number }> {
    const jaEstornou = await tx.movimentacaoEstoque.findFirst({
      where: {
        empresaId,
        pedidoId: pedido.id,
        tipo: TipoMovimentacaoEstoque.ENTRADA,
        motivo: 'ESTORNO_PEDIDO',
      },
      select: { id: true },
    });
    if (jaEstornou) {
      return { estornos: 0 };
    }

    const baixas = await tx.movimentacaoEstoque.findMany({
      where: {
        empresaId,
        pedidoId: pedido.id,
        tipo: TipoMovimentacaoEstoque.BAIXA,
      },
      orderBy: [{ produtoId: 'asc' }, { criadoEm: 'asc' }],
    });
    if (baixas.length === 0) return { estornos: 0 };

    const porProduto = new Map<string, number>();
    for (const b of baixas) {
      porProduto.set(b.produtoId, (porProduto.get(b.produtoId) ?? 0) + b.quantidade);
    }
    const ids = [...porProduto.keys()].sort();
    let estornos = 0;

    for (const produtoId of ids) {
      const quantidade = porProduto.get(produtoId)!;
      await tx.$executeRaw`
        SELECT 1 FROM "produtos"
        WHERE "id" = ${produtoId} AND "empresaId" = ${empresaId}
        FOR UPDATE
      `;
      const produto = await tx.produto.findFirst({ where: { id: produtoId, empresaId } });
      if (!produto) continue;

      const saldoAnterior = produto.estoqueAtual;
      const saldoApos = saldoAnterior + quantidade;
      await tx.produto.update({
        where: { id: produto.id },
        data: { estoqueAtual: saldoApos },
      });
      await tx.movimentacaoEstoque.create({
        data: {
          empresaId,
          produtoId: produto.id,
          tipo: TipoMovimentacaoEstoque.ENTRADA,
          quantidade,
          saldoApos,
          orcamentoId: pedido.orcamentoId,
          oportunidadeId: pedido.oportunidadeId,
          pedidoId: pedido.id,
          motivo: 'ESTORNO_PEDIDO',
          observacao: `Estorno do pedido ${pedido.numero}`,
          usuarioId: usuarioId ?? null,
        },
      });
      await this.auditoria.registrar(tx, {
        empresaId,
        usuarioId,
        tipo: TipoAuditoria.ENTRADA_ESTOQUE,
        entidade: 'produto',
        entidadeId: produto.id,
        anterior: { estoqueAtual: saldoAnterior },
        posterior: {
          estoqueAtual: saldoApos,
          quantidade,
          pedidoId: pedido.id,
          motivo: 'ESTORNO_PEDIDO',
        },
      });
      estornos += 1;
    }

    return { estornos };
  }

  async reconciliar(empresaId: string) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.naoEncontrado(
        'RECONCILIACAO_INDISPONIVEL',
        'A reconciliacao de estoque nao esta disponivel para esta empresa',
      );
    }

    const produtos = await this.prisma.produto.findMany({
      where: { empresaId },
      select: { id: true, sku: true, codigoInterno: true, estoqueAtual: true },
      orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
    });
    const grupos = await this.prisma.movimentacaoEstoque.groupBy({
      by: ['produtoId', 'tipo'],
      where: { empresaId },
      _sum: { quantidade: true },
    });

    const saldoPorProduto = new Map<string, number>();
    for (const grupo of grupos) {
      const quantidade = grupo._sum.quantidade ?? 0;
      const efeito = efeitoNoSaldo(grupo.tipo, quantidade);
      saldoPorProduto.set(grupo.produtoId, (saldoPorProduto.get(grupo.produtoId) ?? 0) + efeito);
    }

    return {
      itens: produtos.map((produto) => {
        const saldoMovimentacoes = saldoPorProduto.get(produto.id) ?? 0;
        const diferenca = produto.estoqueAtual - saldoMovimentacoes;
        return {
          produtoId: produto.id,
          sku: produto.sku,
          codigoInterno: produto.codigoInterno,
          estoqueAtual: produto.estoqueAtual,
          saldoMovimentacoes,
          diferenca,
          consistente: Math.abs(diferenca) < TOLERANCIA_SALDO,
        };
      }),
    };
  }
}
