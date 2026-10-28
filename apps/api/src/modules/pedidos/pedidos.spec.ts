import { describe, expect, it } from 'vitest';
import { StatusOrcamento, StatusPedido } from '@arcco/contratos';
import { Prisma } from '@prisma/client';
import { PedidosService } from './pedidos.service';
import type { PrismaService } from '../../database/prisma.service';
import type { PermissoesService } from '../permissoes/permissoes.service';

type Item = {
  id: string;
  orcamentoId: string;
  produtoId: string | null;
  nome: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  desconto: number;
  totalLinha: number;
  ordem: number;
  codigoInterno: string | null;
};

type Orc = {
  id: string;
  empresaId: string;
  oportunidadeId: string;
  numero: string;
  status: string;
  observacoes: string | null;
  descontoValor: number;
  descontoTipo: string;
  descontoPercentual: number | null;
  subtotal: number;
  total: number;
  itens: Item[];
};

function montar(ecolume: boolean) {
  const orcs: Orc[] = [];
  const pedidos: Array<Record<string, unknown> & { itens: Item[] }> = [];
  let seq = 0;

  const tx = {
    $executeRaw: async () => undefined,
    orcamento: {
      findFirst: async ({
        where,
      }: {
        where: { id: string; empresaId: string };
        include?: unknown;
      }) => {
        const o = orcs.find((x) => x.id === where.id && x.empresaId === where.empresaId);
        return o ? { ...o, itens: [...o.itens] } : null;
      },
    },
    pedido: {
      findFirst: async ({ where }: { where: { orcamentoId?: string; id?: string; empresaId?: string } }) => {
        return (
          pedidos.find((p) => {
            if (where.orcamentoId && p.orcamentoId !== where.orcamentoId) return false;
            if (where.id && p.id !== where.id) return false;
            if (where.empresaId && p.empresaId !== where.empresaId) return false;
            return true;
          }) ?? null
        );
      },
      findMany: async ({ where }: { where: { empresaId: string; numero?: { startsWith?: string }; oportunidadeId?: string } }) => {
        return pedidos
          .filter((p) => {
            if (p.empresaId !== where.empresaId) return false;
            if (where.oportunidadeId && p.oportunidadeId !== where.oportunidadeId) return false;
            const sw = where.numero?.startsWith;
            if (sw && !String(p.numero).startsWith(sw)) return false;
            return true;
          })
          .map((p) => ({ numero: p.numero }));
      },
      create: async ({
        data,
      }: {
        data: Record<string, unknown> & {
          itens?: { create: Array<Record<string, unknown>> };
        };
        include?: unknown;
      }) => {
        if (pedidos.some((p) => p.orcamentoId === data.orcamentoId)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique', {
            code: 'P2002',
            clientVersion: 'test',
          });
        }
        seq += 1;
        const id = `ped-${seq}`;
        const itens = (data.itens?.create ?? []).map((item, i) => ({
          id: `ip-${id}-${i}`,
          pedidoId: id,
          produtoId: (item.produtoId as string | null) ?? null,
          nome: String(item.nome),
          unidade: String(item.unidade),
          quantidade: Number(item.quantidade),
          precoUnitario: Number(item.precoUnitario),
          desconto: Number(item.desconto ?? 0),
          totalLinha: Number(item.totalLinha),
          ordem: Number(item.ordem ?? i),
          codigoInterno: (item.codigoInterno as string | null) ?? null,
        }));
        const pedido = {
          id,
          ...data,
          itens,
          criadoEm: new Date(),
          atualizadoEm: new Date(),
        };
        pedidos.push(pedido as never);
        return pedido;
      },
    },
    oportunidade: {
      findFirst: async ({ where }: { where: { id: string; empresaId: string } }) =>
        where.id === 'opp-1' && where.empresaId === 'emp' ? { id: 'opp-1' } : null,
    },
    historicoFasePedido: {
      create: async () => ({}),
    },
  };

  const prisma = {
    ...tx,
    $transaction: async <T>(fn: (c: typeof tx) => Promise<T>) => fn(tx),
    pedido: {
      ...tx.pedido,
      findMany: async (args: {
        where: { empresaId: string; oportunidadeId?: string };
        include?: unknown;
        orderBy?: unknown;
      }) =>
        pedidos.filter(
          (p) =>
            p.empresaId === args.where.empresaId &&
            (!args.where.oportunidadeId || p.oportunidadeId === args.where.oportunidadeId),
        ),
      findFirst: tx.pedido.findFirst,
    },
    oportunidade: tx.oportunidade,
  };

  const permissoes = {
    empresaEcolume: async () => ecolume,
  } as unknown as PermissoesService;

  const servico = new PedidosService(
    prisma as unknown as PrismaService,
    permissoes,
    {} as never,
    {} as never,
  );

  function seedOrc(parcial: Partial<Orc> & { id: string; itens: Item[] }) {
    const o: Orc = {
      empresaId: 'emp',
      oportunidadeId: 'opp-1',
      numero: 'ORC-0001',
      status: StatusOrcamento.ENVIADO,
      observacoes: null,
      descontoValor: 0,
      descontoTipo: 'VALOR',
      descontoPercentual: null,
      subtotal: 100,
      total: 100,
      ...parcial,
    };
    orcs.push(o);
    return o;
  }

  return { servico, orcs, pedidos, seedOrc, prisma };
}

describe('ECOL-16 Pedidos (estrutura)', () => {
  it('numera PED-#### e copia snapshot do orçamento', async () => {
    const { servico, seedOrc, pedidos } = montar(true);
    seedOrc({
      id: 'orc-1',
      descontoValor: 10,
      subtotal: 110,
      total: 100,
      itens: [
        {
          id: 'i1',
          orcamentoId: 'orc-1',
          produtoId: 'prod-1',
          nome: 'Desc comercial',
          unidade: 'un',
          quantidade: 2,
          precoUnitario: 55,
          desconto: 0,
          totalLinha: 110,
          ordem: 0,
          codigoInterno: 'CI-000001',
        },
        {
          id: 'i2',
          orcamentoId: 'orc-1',
          produtoId: null,
          nome: 'Avulso',
          unidade: 'un',
          quantidade: 1,
          precoUnitario: 0,
          desconto: 0,
          totalLinha: 0,
          ordem: 1,
          codigoInterno: null,
        },
      ],
    });

    const ped = await servico.criarEstruturaAPartirDeOrcamento('emp', 'orc-1', 'u1');
    expect(ped.numero).toBe('PED-0001');
    expect(ped.status).toBe(StatusPedido.CONFIRMADO);
    expect(ped.total).toBe(100);
    expect(ped.descontoValor).toBe(10);
    expect(ped.itens).toHaveLength(2);
    expect(ped.itens[0]!.nome).toBe('Desc comercial');
    expect(ped.itens[0]!.codigoInterno).toBe('CI-000001');
    expect(ped.itens[0]!.precoUnitario).toBe(55);
    expect(ped.itens[1]!.produtoId).toBeNull();
    expect(ped.itens[1]!.nome).toBe('Avulso');
    expect(pedidos).toHaveLength(1);
  });

  it('recusa segundo pedido no mesmo orçamento', async () => {
    const { servico, seedOrc } = montar(true);
    seedOrc({
      id: 'orc-1',
      itens: [
        {
          id: 'i1',
          orcamentoId: 'orc-1',
          produtoId: null,
          nome: 'X',
          unidade: 'un',
          quantidade: 1,
          precoUnitario: 10,
          desconto: 0,
          totalLinha: 10,
          ordem: 0,
          codigoInterno: null,
        },
      ],
    });
    await servico.criarEstruturaAPartirDeOrcamento('emp', 'orc-1', 'u1');
    await expect(servico.criarEstruturaAPartirDeOrcamento('emp', 'orc-1', 'u1')).rejects.toMatchObject({
      codigo: 'ORCAMENTO_JA_TEM_PEDIDO',
    });
  });

  it('dois orçamentos do mesmo negócio geram dois PED', async () => {
    const { servico, seedOrc } = montar(true);
    const item = (orcId: string, nome: string): Item => ({
      id: `${orcId}-i`,
      orcamentoId: orcId,
      produtoId: 'p1',
      nome,
      unidade: 'un',
      quantidade: 1,
      precoUnitario: 20,
      desconto: 0,
      totalLinha: 20,
      ordem: 0,
      codigoInterno: null,
    });
    seedOrc({ id: 'orc-a', numero: 'ORC-0001', itens: [item('orc-a', 'A')] });
    seedOrc({ id: 'orc-b', numero: 'ORC-0002', itens: [item('orc-b', 'B')] });

    const a = await servico.criarEstruturaAPartirDeOrcamento('emp', 'orc-a', 'u1');
    const b = await servico.criarEstruturaAPartirDeOrcamento('emp', 'orc-b', 'u1');
    expect(a.numero).toBe('PED-0001');
    expect(b.numero).toBe('PED-0002');
    expect(a.oportunidadeId).toBe(b.oportunidadeId);
    expect(a.itens[0]!.nome).toBe('A');
    expect(b.itens[0]!.nome).toBe('B');
  });

  it('não altera status do orçamento (sem CONVERTIDO prematuro)', async () => {
    const { servico, seedOrc, orcs } = montar(true);
    seedOrc({
      id: 'orc-1',
      status: StatusOrcamento.ENVIADO,
      itens: [
        {
          id: 'i1',
          orcamentoId: 'orc-1',
          produtoId: null,
          nome: 'Y',
          unidade: 'un',
          quantidade: 1,
          precoUnitario: 5,
          desconto: 0,
          totalLinha: 5,
          ordem: 0,
          codigoInterno: null,
        },
      ],
    });
    await servico.criarEstruturaAPartirDeOrcamento('emp', 'orc-1', 'u1');
    expect(orcs[0]!.status).toBe(StatusOrcamento.ENVIADO);
  });

  it('empresa sem flag: PEDIDO_INDISPONIVEL', async () => {
    const { servico, seedOrc } = montar(false);
    seedOrc({
      id: 'orc-1',
      itens: [
        {
          id: 'i1',
          orcamentoId: 'orc-1',
          produtoId: null,
          nome: 'L',
          unidade: 'un',
          quantidade: 1,
          precoUnitario: 1,
          desconto: 0,
          totalLinha: 1,
          ordem: 0,
          codigoInterno: null,
        },
      ],
    });
    await expect(servico.criarEstruturaAPartirDeOrcamento('emp', 'orc-1', 'u1')).rejects.toMatchObject({
      codigo: 'PEDIDO_INDISPONIVEL',
    });
  });

  it('snapshot permanece após mutar orçamento em memória', async () => {
    const { servico, seedOrc, orcs } = montar(true);
    seedOrc({
      id: 'orc-1',
      total: 80,
      itens: [
        {
          id: 'i1',
          orcamentoId: 'orc-1',
          produtoId: 'prod',
          nome: 'Original',
          unidade: 'un',
          quantidade: 1,
          precoUnitario: 80,
          desconto: 0,
          totalLinha: 80,
          ordem: 0,
          codigoInterno: 'CI-9',
        },
      ],
    });
    const ped = await servico.criarEstruturaAPartirDeOrcamento('emp', 'orc-1', 'u1');
    orcs[0]!.itens[0]!.nome = 'HACK';
    orcs[0]!.itens[0]!.precoUnitario = 1;
    orcs[0]!.total = 1;
    expect(ped.itens[0]!.nome).toBe('Original');
    expect(ped.itens[0]!.precoUnitario).toBe(80);
    expect(ped.total).toBe(80);
  });

  it('controller não expõe criação estrutural — conversão é ECOL-17', async () => {
    const ctrl = await import('./pedidos.controller');
    const proto = ctrl.PedidosController.prototype as Record<string, unknown>;
    expect(typeof proto.listarPorOportunidade).toBe('function');
    expect(typeof proto.obter).toBe('function');
    expect(typeof proto.converter).toBe('function');
    expect(typeof proto.previsualizar).toBe('function');
    expect(proto.criar).toBeUndefined();
    expect(proto.criarEstruturaAPartirDeOrcamento).toBeUndefined();
  });
});
