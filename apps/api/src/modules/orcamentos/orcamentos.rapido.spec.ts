import { describe, expect, it } from 'vitest';
import { StatusOrcamento } from '@arcco/contratos';
import { Prisma } from '@prisma/client';
import { OrcamentosService } from './orcamentos.service';
import { montarItemEcolume } from './formula-item';
import type { PrismaService } from '../../database/prisma.service';
import type { PlatformPrismaService } from '../../database/platform-prisma.service';
import type { ArquivosService } from '../arquivos/arquivos.service';
import type { PermissoesService } from '../permissoes/permissoes.service';
import type { ProdutosService } from '../produtos/produtos.service';
import type { WhatsAppService } from '../whatsapp/whatsapp.service';

describe('ECOL-15 item avulso (fórmula)', () => {
  it('aceita linha sem produto com preço manual quando há VER_CUSTOS', () => {
    const r = montarItemEcolume(
      {
        nome: 'Avulso demo',
        unidade: 'un',
        quantidade: 2,
        precoUnitario: 50,
        desconto: 0,
        precoManual: true,
      },
      null,
      0,
      true,
    );
    expect(r.erro).toBeUndefined();
    expect(r.item.produtoId).toBeNull();
    expect(r.item.nome).toBe('Avulso demo');
    expect(r.item.precoUnitario).toBe(50);
    expect(r.item.totalLinha).toBe(100);
    expect(r.item.precoManual).toBe(true);
  });

  it('bloqueia preço avulso sem VER_CUSTOS (depende ECOL-02)', () => {
    const r = montarItemEcolume(
      {
        nome: 'Avulso',
        unidade: 'un',
        quantidade: 1,
        precoUnitario: 10,
        desconto: 0,
      },
      null,
      0,
      false,
    );
    expect(r.erro?.codigo).toBe('PRECO_ALTERACAO_INDISPONIVEL');
  });
});

describe('ECOL-15 cadastro rápido (serviço)', () => {
  function montar() {
    const orcs: Array<Record<string, unknown>> = [];
    const produtos: Array<Record<string, unknown>> = [];
    const movimentos: Array<Record<string, unknown>> = [];
    const fornecedores = [
      { id: 'forn-1', empresaId: 'emp', ativo: true, aliquotaSt: new Prisma.Decimal(0) },
    ];
    let seq = 0;

    const tx = {
      $executeRaw: async () => undefined,
      fornecedor: {
        findFirst: async ({ where }: { where: { id: string; empresaId: string } }) =>
          fornecedores.find((f) => f.id === where.id && f.empresaId === where.empresaId) ?? null,
      },
      produto: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          seq += 1;
          const p = {
            id: `prod-${seq}`,
            codigoInterno: null as string | null,
            ...data,
            fornecedor: { aliquotaSt: new Prisma.Decimal(0) },
          };
          produtos.push(p);
          return p;
        },
        findFirst: async ({
          where,
        }: {
          where: { id?: string; empresaId: string; codigoInterno?: unknown };
        }) => {
          const hit = produtos.find(
            (p) =>
              p.empresaId === where.empresaId && (!where.id || p.id === where.id),
          );
          return hit ?? null;
        },
        findFirstOrThrow: async ({ where }: { where: { id: string; empresaId: string } }) => {
          const hit = produtos.find((p) => p.id === where.id && p.empresaId === where.empresaId);
          if (!hit) throw new Error('missing produto');
          return hit;
        },
        findMany: async ({ where }: { where: { empresaId: string; codigoInterno?: unknown } }) =>
          produtos
            .filter((p) => p.empresaId === where.empresaId && p.codigoInterno != null)
            .map((p) => ({ codigoInterno: p.codigoInterno })),
      },
      movimentacaoEstoque: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          movimentos.push(data);
          return data;
        },
        findMany: async () => movimentos,
      },
      orcamento: {
        findFirst: async ({ where }: { where: { id?: string; empresaId: string } }) => {
          const o = orcs.find(
            (x) => x.empresaId === where.empresaId && (!where.id || x.id === where.id),
          );
          return o
            ? {
                ...o,
                orcamentoOrigem: null,
                itens: (o.itens as unknown[]) ?? [],
              }
            : null;
        },
        findMany: async ({ where }: { where: Record<string, unknown> }) => {
          return orcs
            .filter((o) => {
              if (where.empresaId && o.empresaId !== where.empresaId) return false;
              const num = where.numero as { startsWith?: string } | undefined;
              if (num?.startsWith && !String(o.numero).startsWith(num.startsWith)) return false;
              return true;
            })
            .map((o) => ({ numero: o.numero }));
        },
        updateMany: async () => ({ count: 0 }),
        create: async ({
          data,
          include: _i,
        }: {
          data: Record<string, unknown> & { itens?: { create: Array<Record<string, unknown>> } };
          include?: unknown;
        }) => {
          seq += 1;
          const id = `orc-${seq}`;
          const itens = (data.itens?.create ?? []).map((item, i) => ({
            id: `item-${id}-${i}`,
            orcamentoId: id,
            ...item,
            produto: item.produtoId
              ? produtos.find((p) => p.id === item.produtoId) ?? null
              : null,
          }));
          const orc = {
            id,
            ...data,
            status: StatusOrcamento.RASCUNHO,
            arquivoId: null,
            enviadoEm: null,
            orcamentoOrigemId: null,
            criadoEm: new Date(),
            atualizadoEm: new Date(),
            itens,
            orcamentoOrigem: null,
          };
          orcs.push(orc);
          return orc;
        },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const o = orcs.find((x) => x.id === where.id);
          if (!o) throw new Error('missing');
          Object.assign(o, data);
          return o;
        },
        count: async () => orcs.length,
      },
      itemOrcamento: {
        deleteMany: async () => ({ count: 0 }),
        createMany: async () => ({ count: 0 }),
      },
      oportunidade: {
        findFirst: async () => ({
          id: 'opp-1',
          empresaId: 'emp',
          etapaId: 'etapa-orc',
          valorEstimado: 0,
          codigoOrcamento: null,
          etapa: { id: 'etapa-orc', tipo: 'ABERTA', nome: 'Orçamento em aberto' },
        }),
        update: async () => ({}),
      },
      etapaFunil: {
        findFirst: async () => ({
          id: 'etapa-orc',
          nome: 'Orçamento em aberto',
          chaveSistema: 'ORCAMENTO_EM_ABERTO',
          ativo: true,
          tipo: 'ABERTA',
        }),
        update: async () => ({}),
        create: async () => ({}),
      },
      historicoEtapaOportunidade: {
        create: async () => ({}),
      },
      $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        // gravarCodigo: UPDATE produtos SET codigoInterno
        const id = values[1];
        const codigo = values[0];
        const p = produtos.find((x) => x.id === id);
        if (p && p.codigoInterno == null) p.codigoInterno = String(codigo);
        return 1;
      },
    };

    // Alias for nested $executeRaw tagged template from gravarCodigo
    (tx as { $executeRaw: typeof tx.$executeRaw }).$executeRaw = async (
      ...args: unknown[]
    ) => {
      if (Array.isArray(args[0])) {
        const values = args.slice(1);
        const codigo = values[0];
        const id = values[1];
        const p = produtos.find((x) => x.id === id);
        if (p && p.codigoInterno == null) p.codigoInterno = String(codigo);
        return 1;
      }
      return 1;
    };

    const prisma = {
      ...tx,
      $transaction: async <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx),
      produto: {
        ...tx.produto,
        findFirst: tx.produto.findFirst,
      },
      orcamento: {
        ...tx.orcamento,
        findFirst: async (args: { where: { id?: string; empresaId: string }; include?: unknown }) => {
          const o = await tx.orcamento.findFirst(args);
          if (!o) return null;
          return {
            ...o,
            itens: (o as { itens: unknown[] }).itens ?? [],
            orcamentoOrigem: null,
          };
        },
      },
      oportunidade: tx.oportunidade,
    };

    const produtosSvc = {
      criarCadastroRapidoTx: async (
        client: typeof tx,
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
      ) => {
        const forn = await client.fornecedor.findFirst({
          where: { id: entrada.fornecedorId, empresaId },
        });
        if (!forn) throw Object.assign(new Error('FORNECEDOR'), { codigo: 'FORNECEDOR_NAO_ENCONTRADO' });
        const criado = await client.produto.create({
          data: {
            empresaId,
            nome: entrada.nome,
            descricaoComercial: entrada.descricaoComercial ?? entrada.nome,
            unidade: entrada.unidade ?? 'un',
            fornecedorId: entrada.fornecedorId,
            ipi: entrada.ipi ?? 0,
            margem: entrada.margem ?? null,
            precoVenda: entrada.precoVenda ?? 0,
            estoqueAtual: 0,
            controlaEstoque: true,
            ativo: true,
            custoMedio: null,
            ultimoPreco: new Prisma.Decimal(entrada.custoReferencia.toFixed(4)),
          },
        });
        const codigo = `CI-${String(produtos.filter((p) => p.codigoInterno).length + 1).padStart(6, '0')}`;
        criado.codigoInterno = codigo;
        return criado;
      },
    } as unknown as ProdutosService;

    const permissoes = {
      empresaEcolume: async () => true,
    } as unknown as PermissoesService;

    const platform = {
      empresa: {
        findUnique: async () => ({
          configuracoes: { personalizacaoComercial: 'ECOLUME' },
        }),
      },
    } as unknown as PlatformPrismaService;

    const servico = new OrcamentosService(
      prisma as unknown as PrismaService,
      platform,
      {} as ArquivosService,
      produtosSvc,
      permissoes,
      {} as WhatsAppService,
    );

    return { servico, produtos, movimentos, orcs };
  }

  it('SIM cria produto com saldo 0, código, último preço e sem movimento', async () => {
    const { servico, produtos, movimentos } = montar();
    const orc = await servico.criar('emp', 'u1', {
      oportunidadeId: 'opp-1',
      descontoValor: 0,
      itens: [
        {
          nome: 'Stella rápida',
          unidade: 'un',
          quantidade: 1,
          custoBase: 120,
          ipiPercentual: 10,
          stPercentual: 30,
          margem: 1.6,
          baseCusto: 'INFORMADO',
          salvarNoCadastro: true,
          fornecedorId: 'forn-1',
        },
      ],
    });

    expect(orc.itens).toHaveLength(1);
    expect(orc.itens[0]!.produtoId).toBeTruthy();
    expect(orc.itens[0]!.nome).toBe('Stella rápida');
    expect(orc.itens[0]!.precoUnitario).toBeCloseTo(274.56, 2);

    expect(produtos).toHaveLength(1);
    expect(produtos[0]!.estoqueAtual).toBe(0);
    expect(produtos[0]!.custoMedio).toBeNull();
    expect(Number(produtos[0]!.ultimoPreco)).toBe(120);
    expect(produtos[0]!.codigoInterno).toMatch(/^CI-/);
    expect(movimentos).toHaveLength(0);
  });

  it('NÃO / avulso não cria produto', async () => {
    const { servico, produtos, movimentos } = montar();
    const orc = await servico.criar('emp', 'u1', {
      oportunidadeId: 'opp-1',
      descontoValor: 0,
      itens: [
        {
          nome: 'Só orçamento',
          unidade: 'un',
          quantidade: 3,
          precoUnitario: 40,
          precoManual: true,
          salvarNoCadastro: false,
        },
      ],
    });
    expect(orc.itens[0]!.produtoId).toBeNull();
    expect(orc.itens[0]!.nome).toBe('Só orçamento');
    expect(orc.itens[0]!.totalLinha).toBe(120);
    expect(produtos).toHaveLength(0);
    expect(movimentos).toHaveLength(0);
  });

  it('falha de fornecedor não grava produto parcial', async () => {
    const { servico, produtos } = montar();
    await expect(
      servico.criar('emp', 'u1', {
        oportunidadeId: 'opp-1',
        descontoValor: 0,
        itens: [
          {
            nome: 'Falhou',
            quantidade: 1,
            custoBase: 10,
            margem: 1.6,
            salvarNoCadastro: true,
            fornecedorId: 'forn-inexistente',
          },
        ],
      }),
    ).rejects.toBeTruthy();
    expect(produtos).toHaveLength(0);
  });
});
