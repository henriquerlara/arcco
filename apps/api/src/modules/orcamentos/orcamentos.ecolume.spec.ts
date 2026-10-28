import { describe, expect, it } from 'vitest';
import { StatusOrcamento } from '@arcco/contratos';
import { OrcamentosService } from './orcamentos.service';
import { AppError } from '../../common/erros/erros';
import type { PrismaService } from '../../database/prisma.service';
import type { PlatformPrismaService } from '../../database/platform-prisma.service';
import type { ArquivosService } from '../arquivos/arquivos.service';
import type { PermissoesService } from '../permissoes/permissoes.service';
import type { ProdutosService } from '../produtos/produtos.service';
import type { WhatsAppService } from '../whatsapp/whatsapp.service';

type OrcFake = {
  id: string;
  empresaId: string;
  oportunidadeId: string;
  numero: string;
  versao: number;
  status: string;
  vigente: boolean;
  observacoes: string | null;
  descontoValor: number;
  subtotal: number;
  total: number;
  validadeEm: Date | null;
  arquivoId: string | null;
  enviadoEm: Date | null;
  aceitoEm: Date | null;
  convertidoEm: Date | null;
  orcamentoOrigemId: string | null;
  criadoPorId: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
  itens: Array<{
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
    produto: null;
  }>;
};

function montar(ecolume: boolean) {
  const orcs: OrcFake[] = [];
  let seqId = 0;
  const oportunidade = {
    id: 'opp-1',
    empresaId: 'emp',
    valorEstimado: 0,
    codigoOrcamento: null as string | null,
    dadosPersonalizados: {},
  };

  const tx = {
    $executeRaw: async () => undefined,
    orcamento: {
      findFirst: async ({
        where,
        orderBy,
        select,
      }: {
        where: Record<string, unknown>;
        orderBy?: { versao: string };
        select?: { versao: true };
      }) => {
        let lista = orcs.filter((o) => {
          if (where.empresaId && o.empresaId !== where.empresaId) return false;
          if (where.oportunidadeId && o.oportunidadeId !== where.oportunidadeId) return false;
          if (where.id && o.id !== where.id) return false;
          return true;
        });
        if (orderBy?.versao === 'desc') {
          lista = [...lista].sort((a, b) => b.versao - a.versao);
        }
        const hit = lista[0] ?? null;
        if (!hit) return null;
        if (select?.versao) return { versao: hit.versao };
        return hit;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        return orcs
          .filter((o) => {
            if (where.empresaId && o.empresaId !== where.empresaId) return false;
            const num = where.numero as { startsWith?: string } | undefined;
            if (num?.startsWith && !o.numero.startsWith(num.startsWith)) return false;
            return true;
          })
          .map((o) => ({ numero: o.numero }));
      },
      count: async ({ where }: { where: { empresaId: string } }) =>
        orcs.filter((o) => o.empresaId === where.empresaId).length,
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        for (const o of orcs) {
          if (where.empresaId && o.empresaId !== where.empresaId) continue;
          if (where.oportunidadeId && o.oportunidadeId !== where.oportunidadeId) continue;
          if (where.vigente !== undefined && o.vigente !== where.vigente) continue;
          if (where.status && o.status !== where.status) continue;
          const notId = (where.id as { not?: string } | undefined)?.not;
          if (notId && o.id === notId) continue;
          Object.assign(o, data);
        }
        return { count: 1 };
      },
      create: async ({
        data,
        include: _include,
      }: {
        data: Record<string, unknown> & {
          itens?: { create: Array<Record<string, unknown>> };
        };
        include?: unknown;
      }) => {
        seqId += 1;
        const id = `orc-${seqId}`;
        const itensCreate = data.itens?.create ?? [];
        const itens = itensCreate.map((item, i) => ({
          id: `item-${id}-${i}`,
          orcamentoId: id,
          produtoId: (item.produtoId as string | null) ?? null,
          nome: String(item.nome),
          unidade: String(item.unidade),
          quantidade: Number(item.quantidade),
          precoUnitario: Number(item.precoUnitario),
          desconto: Number(item.desconto ?? 0),
          totalLinha: Number(item.totalLinha),
          ordem: Number(item.ordem ?? i),
          produto: null,
        }));
        const orc: OrcFake = {
          id,
          empresaId: String(data.empresaId),
          oportunidadeId: String(data.oportunidadeId),
          numero: String(data.numero),
          versao: Number(data.versao),
          status: String(data.status),
          vigente: Boolean(data.vigente),
          observacoes: (data.observacoes as string | null) ?? null,
          descontoValor: Number(data.descontoValor ?? 0),
          subtotal: Number(data.subtotal ?? 0),
          total: Number(data.total ?? 0),
          validadeEm: (data.validadeEm as Date | null) ?? null,
          arquivoId: null,
          enviadoEm: null,
          aceitoEm: null,
          convertidoEm: null,
          orcamentoOrigemId: (data.orcamentoOrigemId as string | null) ?? null,
          criadoPorId: (data.criadoPorId as string | null) ?? null,
          criadoEm: new Date(),
          atualizadoEm: new Date(),
          itens,
        };
        orcs.push(orc);
        return {
          ...orc,
          orcamentoOrigem: orc.orcamentoOrigemId
            ? {
                id: orc.orcamentoOrigemId,
                numero: orcs.find((x) => x.id === orc.orcamentoOrigemId)?.numero ?? '',
              }
            : null,
        };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const o = orcs.find((x) => x.id === where.id);
        if (!o) throw new Error('missing');
        Object.assign(o, data);
        return o;
      },
    },
    itemOrcamento: {
      deleteMany: async ({ where }: { where: { orcamentoId: string } }) => {
        const o = orcs.find((x) => x.id === where.orcamentoId);
        if (o) o.itens = [];
        return { count: 1 };
      },
      createMany: async ({
        data,
      }: {
        data: Array<Record<string, unknown> & { orcamentoId: string }>;
      }) => {
        for (const row of data) {
          const o = orcs.find((x) => x.id === row.orcamentoId);
          if (!o) continue;
          o.itens.push({
            id: `item-${o.id}-${o.itens.length}`,
            orcamentoId: o.id,
            produtoId: (row.produtoId as string | null) ?? null,
            nome: String(row.nome),
            unidade: String(row.unidade),
            quantidade: Number(row.quantidade),
            precoUnitario: Number(row.precoUnitario),
            desconto: Number(row.desconto ?? 0),
            totalLinha: Number(row.totalLinha),
            ordem: Number(row.ordem ?? o.itens.length),
            produto: null,
          });
        }
        return { count: data.length };
      },
    },
    oportunidade: {
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        if (where.id === oportunidade.id) Object.assign(oportunidade, data);
        return oportunidade;
      },
      findFirst: async () => ({
        ...oportunidade,
        etapa: { id: oportunidade.etapaId, tipo: 'ABERTA', nome: 'Novo' },
      }),
    },
    // ECOL-19 — stubs para avancarParaOrcamentoEmAberto no mock unitário
    etapaFunil: {
      findFirst: async () => ({
        id: oportunidade.etapaId,
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
  };

  const prisma = {
    oportunidade: {
      findFirst: async ({ where }: { where: { id: string; empresaId: string } }) =>
        where.id === oportunidade.id && where.empresaId === oportunidade.empresaId
          ? oportunidade
          : null,
    },
    orcamento: {
      findFirst: async ({
        where,
        include: _include,
      }: {
        where: { id?: string; empresaId: string };
        include?: unknown;
      }) => {
        const o = orcs.find(
          (x) => x.empresaId === where.empresaId && (!where.id || x.id === where.id),
        );
        if (!o) return null;
        return {
          ...o,
          orcamentoOrigem: o.orcamentoOrigemId
            ? {
                id: o.orcamentoOrigemId,
                numero: orcs.find((x) => x.id === o.orcamentoOrigemId)?.numero ?? '',
              }
            : null,
        };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const o = orcs.find((x) => x.id === where.id);
        if (!o) throw new Error('missing');
        Object.assign(o, data);
        return o;
      },
      updateMany: tx.orcamento.updateMany,
    },
    $transaction: async <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx),
  };

  const permissoes = {
    empresaEcolume: async () => ecolume,
  } as unknown as PermissoesService;

  const produtos = {
    obter: async () => {
      throw new Error('não usado');
    },
    buscar: async () => null,
  } as unknown as ProdutosService;

  const servico = new OrcamentosService(
    prisma as unknown as PrismaService,
    {} as PlatformPrismaService,
    {} as ArquivosService,
    produtos,
    permissoes,
    {} as WhatsAppService,
  );

  return { servico, orcs, oportunidade };
}

describe('ECOL-12 Orçamento', () => {
  it('numera ORC-#### na ECOLUME e ORC-n-vN no legado', async () => {
    const eco = montar(true);
    const a = await eco.servico.criar('emp', 'u1', {
      oportunidadeId: 'opp-1',
      descontoValor: 0,
      itens: [{ nome: 'Item A', quantidade: 1, precoUnitario: 10, unidade: 'un' }],
    });
    const b = await eco.servico.criar('emp', 'u1', {
      oportunidadeId: 'opp-1',
      descontoValor: 0,
      itens: [{ nome: 'Item B', quantidade: 2, precoUnitario: 5, unidade: 'un' }],
    });
    expect(a.numero).toBe('ORC-0001');
    expect(b.numero).toBe('ORC-0002');
    expect(a.numero).not.toMatch(/-v\d+$/);

    const legado = montar(false);
    const l = await legado.servico.criar('emp', 'u1', {
      oportunidadeId: 'opp-1',
      descontoValor: 0,
      itens: [{ nome: 'Legado', quantidade: 1, precoUnitario: 1, unidade: 'un' }],
    });
    expect(l.numero).toMatch(/^ORC-\d{4}-v1$/);
  });

  it('trava edição após marcar enviado e grava enviadoEm', async () => {
    const { servico, orcs } = montar(true);
    const criado = await servico.criar('emp', 'u1', {
      oportunidadeId: 'opp-1',
      descontoValor: 0,
      itens: [{ nome: 'X', quantidade: 1, precoUnitario: 100, unidade: 'un' }],
    });
    const enviado = await servico.marcarEnviado('emp', criado.id);
    expect(enviado.status).toBe(StatusOrcamento.ENVIADO);
    expect(enviado.enviadoEm).toBeInstanceOf(Date);

    const tentativas = [
      { descontoValor: 5 },
      { itens: [{ nome: 'Hack', quantidade: 9, precoUnitario: 1, unidade: 'un' }] },
      {
        observacoes: 'alterar',
        itens: [{ nome: 'X', quantidade: 99, precoUnitario: 1, unidade: 'un', desconto: 50 }],
      },
    ];
    for (const dto of tentativas) {
      await expect(servico.atualizar('emp', criado.id, dto)).rejects.toMatchObject({
        codigo: 'ORCAMENTO_BLOQUEADO',
      });
    }

    for (const status of [
      StatusOrcamento.SUBSTITUIDO,
      StatusOrcamento.RECUSADO,
      StatusOrcamento.CONVERTIDO,
      StatusOrcamento.ACEITO,
      StatusOrcamento.CANCELADO,
    ]) {
      orcs[0]!.status = status;
      await expect(
        servico.atualizar('emp', criado.id, { descontoValor: 1 }),
      ).rejects.toMatchObject({ codigo: 'ORCAMENTO_BLOQUEADO' });
    }

    expect(orcs[0]!.itens[0]!.nome).toBe('X');
    expect(orcs[0]!.itens[0]!.quantidade).toBe(1);
    expect(orcs[0]!.itens[0]!.precoUnitario).toBe(100);
    expect(orcs[0]!.descontoValor).toBe(0);
  });

  it('duplica com novo número, origem e original intacto', async () => {
    const { servico, orcs } = montar(true);
    const origem = await servico.criar('emp', 'u1', {
      oportunidadeId: 'opp-1',
      observacoes: 'nota',
      descontoValor: 10,
      itens: [
        { nome: 'Lâmpada', quantidade: 2, precoUnitario: 50, unidade: 'un', desconto: 0 },
      ],
    });
    await servico.marcarEnviado('emp', origem.id);
    const copia = await servico.duplicar('emp', 'u1', origem.id);

    expect(copia.id).not.toBe(origem.id);
    expect(copia.numero).toBe('ORC-0002');
    expect(copia.status).toBe(StatusOrcamento.RASCUNHO);
    expect(copia.orcamentoOrigemId).toBe(origem.id);
    expect(copia.descontoValor).toBe(10);
    expect(copia.itens).toHaveLength(1);
    expect(copia.itens[0]).toMatchObject({
      nome: 'Lâmpada',
      quantidade: 2,
      precoUnitario: 50,
    });

    expect(orcs[0]!.status).toBe(StatusOrcamento.ENVIADO);
    expect(orcs[0]!.numero).toBe('ORC-0001');
    expect(orcs[0]!.itens[0]!.nome).toBe('Lâmpada');
  });

  it('substitui ENVIADO anterior e recusa transição inválida', async () => {
    const { servico, orcs } = montar(true);
    const a = await servico.criar('emp', 'u1', {
      oportunidadeId: 'opp-1',
      descontoValor: 0,
      itens: [{ nome: 'A', quantidade: 1, precoUnitario: 1, unidade: 'un' }],
    });
    await servico.marcarEnviado('emp', a.id);
    const b = await servico.criar('emp', 'u1', {
      oportunidadeId: 'opp-1',
      descontoValor: 0,
      itens: [{ nome: 'B', quantidade: 1, precoUnitario: 2, unidade: 'un' }],
    });
    await servico.marcarEnviado('emp', b.id);
    expect(orcs[0]!.status).toBe(StatusOrcamento.SUBSTITUIDO);
    expect(orcs[1]!.status).toBe(StatusOrcamento.ENVIADO);

    await expect(servico.marcarEnviado('emp', b.id)).rejects.toMatchObject({
      codigo: 'ORCAMENTO_NAO_ENVIAVEL',
    });
    await expect(servico.marcarRecusado('emp', a.id)).rejects.toBeInstanceOf(AppError);

    const recusado = await servico.marcarRecusado('emp', b.id);
    expect(recusado.status).toBe(StatusOrcamento.RECUSADO);
  });

  it('permite rascunho em branco na ECOLUME', async () => {
    const { servico } = montar(true);
    const branco = await servico.criar('emp', 'u1', {
      oportunidadeId: 'opp-1',
      descontoValor: 0,
      itens: [],
    });
    expect(branco.numero).toBe('ORC-0001');
    expect(branco.status).toBe(StatusOrcamento.RASCUNHO);
    expect(branco.itens).toHaveLength(0);
    await expect(servico.marcarEnviado('emp', branco.id)).rejects.toMatchObject({
      codigo: 'ORCAMENTO_SEM_ITENS',
    });
  });
});
