import { describe, expect, it } from 'vitest';
import {
  ChaveEtapaSistema,
  NaturezaPessoa,
  OrigemNegocio,
  PrioridadeOportunidade,
  TipoContato,
  TipoEtapaFunil,
  TipoParceiro,
} from '@arcco/contratos';
import { OportunidadesService } from './oportunidades.service';
import { AppError } from '../../common/erros/erros';
import type { PrismaService } from '../../database/prisma.service';
import type { PlatformPrismaService } from '../../database/platform-prisma.service';
import type { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';
import type { ContatosService } from '../contatos/contatos.service';
import type { EventosService } from '../eventos/eventos.service';
import type { PermissoesService } from '../permissoes/permissoes.service';
import type { ProdutosService } from '../produtos/produtos.service';

type ContatoFake = {
  id: string;
  empresaId: string;
  nome: string;
  ehParceiro: boolean;
  rtPadrao: number | null;
};

type OppFake = Record<string, unknown> & {
  id: string;
  empresaId: string;
  codigo: string;
  contatoId: string;
  parceiroId: string | null;
  rtNegocio: unknown;
  origemNegocio: string | null;
  titulo: string;
  responsavelId: string | null;
  etapaId: string;
};

function montar(ecolume: boolean) {
  const contatos: ContatoFake[] = [
    {
      id: 'cli-1',
      empresaId: 'emp',
      nome: 'Cliente A',
      ehParceiro: false,
      rtPadrao: null,
    },
    {
      id: 'par-1',
      empresaId: 'emp',
      nome: 'Parceiro B',
      ehParceiro: true,
      rtPadrao: 10,
    },
  ];
  const opps: OppFake[] = [];
  const etapa = {
    id: 'et-novo',
    empresaId: 'emp',
    nome: 'Novo contato',
    ordem: 1,
    tipo: TipoEtapaFunil.ABERTA,
    chaveSistema: ChaveEtapaSistema.NOVO_CONTATO,
    ativo: true,
  };
  let seq = 0;

  const prisma = {
    contato: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        contatos.find((c) => {
          if (where.id && c.id !== where.id) return false;
          if (where.empresaId && c.empresaId !== where.empresaId) return false;
          if (where.ehParceiro !== undefined && c.ehParceiro !== where.ehParceiro) return false;
          return true;
        }) ?? null,
    },
    etapaFunil: {
      findFirst: async ({
        where,
      }: {
        where: { empresaId?: string; chaveSistema?: string; id?: string; ativo?: boolean };
      }) => {
        if (where.id && where.id === etapa.id) return etapa;
        if (where.chaveSistema && where.chaveSistema !== etapa.chaveSistema) return null;
        return etapa;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        if (where.id === etapa.id) Object.assign(etapa, data);
        return etapa;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: `et-${++seq}`,
        ...data,
      }),
    },
    oportunidade: {
      findFirst: async ({
        where,
      }: {
        where: { empresaId?: string; codigo?: { startsWith?: string } };
      }) => {
        const lista = opps.filter((o) => o.empresaId === where.empresaId);
        const pref = where.codigo?.startsWith;
        const filtrada = pref ? lista.filter((o) => String(o.codigo).startsWith(pref)) : lista;
        return filtrada.sort((a, b) => String(b.codigo).localeCompare(String(a.codigo)))[0] ?? null;
      },
      create: async ({ data }: { data: OppFake }) => {
        const criada = {
          ...data,
          id: `op-${++seq}`,
          contato: contatos.find((c) => c.id === data.contatoId),
          parceiro: data.parceiroId ? contatos.find((c) => c.id === data.parceiroId) : null,
          etapa,
          categoria: null,
          obra: null,
        };
        opps.push(criada);
        return criada;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const alvo = opps.find((o) => o.id === where.id)!;
        Object.assign(alvo, data);
        return { ...alvo, contato: contatos[0], parceiro: null, etapa, categoria: null, obra: null };
      },
      findMany: async () => opps,
      count: async () => opps.length,
    },
    historicoEtapaOportunidade: { create: async () => ({}) },
    arquivo: {
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
    },
    $executeRaw: async () => undefined,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  } as unknown as PrismaService;

  const contatosServico = {
    criar: async () => {
      const c = {
        id: `cli-rapido-${++seq}`,
        empresaId: 'emp',
        nome: 'Rapido',
        ehParceiro: false,
        rtPadrao: null,
      };
      contatos.push(c);
      return c;
    },
  } as unknown as ContatosService;

  return {
    opps,
    contatos,
    servico: new OportunidadesService(
      prisma,
      {
        usuario: {
          findFirst: async ({ where }: { where: { id: string } }) =>
            where.id === 'user-1' ? { id: 'user-1', nome: 'Eu', email: 'eu@x' } : null,
          findMany: async () => [{ id: 'user-1', nome: 'Eu', email: 'eu@x' }],
        },
      } as unknown as PlatformPrismaService,
      {
        validarPara: async (_e: string, _t: unknown, d: unknown) => d ?? {},
      } as unknown as CamposPersonalizadosService,
      { registrar: async () => undefined } as unknown as EventosService,
      {} as unknown as ProdutosService,
      { empresaEcolume: async () => ecolume } as unknown as PermissoesService,
      contatosServico,
    ),
  };
}

describe('ECOL-11 Negócio', () => {
  it('cria NEG direto e via parceiro com RT copiada', async () => {
    const { servico } = montar(true);
    const direto = await servico.criar(
      'emp',
      {
        contatoId: 'cli-1',
        titulo: 'Cliente A — Projeto',
        origemNegocio: OrigemNegocio.CLIENTE_DIRETO,
        responsavelId: 'user-1',
        prioridade: PrioridadeOportunidade.MEDIA,
        dadosPersonalizados: {},
      },
      { usuarioId: 'user-1' },
    );
    expect(direto.codigo).toBe('NEG-0001');
    expect(direto.titulo).toBe('Cliente A — Projeto');
    expect(direto.origemNegocio).toBe(OrigemNegocio.CLIENTE_DIRETO);
    expect(direto.parceiroId).toBeNull();

    const via = await servico.criar(
      'emp',
      {
        contatoId: 'cli-1',
        titulo: 'Obra B',
        origemNegocio: OrigemNegocio.VIA_PARCEIRO,
        parceiroId: 'par-1',
        responsavelId: 'user-1',
        prioridade: PrioridadeOportunidade.MEDIA,
        dadosPersonalizados: {},
      },
      { usuarioId: 'user-1' },
    );
    expect(via.codigo).toBe('NEG-0002');
    expect(via.parceiroId).toBe('par-1');
    expect(via.rtNegocio).toBe(10);
  });

  it('recusa parceiro obrigatório e grava RT do negócio independente do parceiro', async () => {
    const { servico, contatos } = montar(true);
    await expect(
      servico.criar(
        'emp',
        {
          contatoId: 'cli-1',
          origemNegocio: OrigemNegocio.VIA_PARCEIRO,
          responsavelId: 'user-1',
          prioridade: PrioridadeOportunidade.MEDIA,
          dadosPersonalizados: {},
        },
        { usuarioId: 'user-1' },
      ),
    ).rejects.toMatchObject({ codigo: 'PARCEIRO_OBRIGATORIO' });

    const neg = await servico.criar(
      'emp',
      {
        contatoId: 'cli-1',
        titulo: 'X',
        origemNegocio: OrigemNegocio.VIA_PARCEIRO,
        parceiroId: 'par-1',
        rtNegocio: 12,
        responsavelId: 'user-1',
        prioridade: PrioridadeOportunidade.MEDIA,
        dadosPersonalizados: {},
      },
      { usuarioId: 'user-1' },
    );
    expect(neg.rtNegocio).toBe(12);
    contatos[1]!.rtPadrao = 99;
    expect(neg.rtNegocio).toBe(12);
  });

  it('legado gera OP- e cadastro mínimo só com flag', async () => {
    const legado = montar(false);
    const op = await legado.servico.criar(
      'emp',
      {
        contatoId: 'cli-1',
        prioridade: PrioridadeOportunidade.MEDIA,
        dadosPersonalizados: {},
      },
      { usuarioId: 'user-1' },
    );
    expect(op.codigo).toBe('OP-0001');
    expect(op.titulo).toBe('OP-0001');

    const ecolume = montar(true);
    await expect(
      ecolume.servico.criar(
        'emp',
        {
          clienteMinimo: {
            nome: 'Novo',
            telefone: '11999998888',
            natureza: NaturezaPessoa.PF,
          },
          titulo: 'Novo — Projeto',
          origemNegocio: OrigemNegocio.CLIENTE_DIRETO,
          responsavelId: 'user-1',
          prioridade: PrioridadeOportunidade.MEDIA,
          dadosPersonalizados: {},
        },
        { usuarioId: 'user-1' },
      ),
    ).resolves.toMatchObject({ codigo: 'NEG-0001' });

    await expect(
      legado.servico.criar(
        'emp',
        {
          clienteMinimo: { nome: 'X', telefone: '11999997777' },
          prioridade: PrioridadeOportunidade.MEDIA,
          dadosPersonalizados: {},
        },
        { usuarioId: 'user-1' },
      ),
    ).rejects.toBeInstanceOf(AppError);
  });
});
