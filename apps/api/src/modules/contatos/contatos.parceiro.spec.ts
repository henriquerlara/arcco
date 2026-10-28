import { describe, expect, it } from 'vitest';
import { NaturezaPessoa, RT_PADRAO_PARCEIRO, TipoContato, TipoParceiro } from '@arcco/contratos';
import { ContatosService } from './contatos.service';
import type { PrismaService } from '../../database/prisma.service';
import type { PlatformPrismaService } from '../../database/platform-prisma.service';
import type { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';
import type { PermissoesService } from '../permissoes/permissoes.service';

type ContatoFake = Record<string, unknown> & {
  id: string;
  empresaId: string;
  telefoneNormalizado: string;
  documento: string | null;
  ehParceiro: boolean;
};

function montar(ecolume = true) {
  const contatos: ContatoFake[] = [];
  let seq = 0;
  const prisma = {
    contato: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const hit =
          contatos.find((c) => {
            if (where.empresaId && c.empresaId !== where.empresaId) return false;
            if (typeof where.id === 'string' && c.id !== where.id) return false;
            if (
              where.id &&
              typeof where.id === 'object' &&
              'not' in (where.id as object) &&
              c.id === (where.id as { not: string }).not
            ) {
              return false;
            }
            if (where.telefoneNormalizado && c.telefoneNormalizado !== where.telefoneNormalizado)
              return false;
            if (where.documento && c.documento !== where.documento) return false;
            return true;
          }) ?? null;
        if (!hit) return null;
        return {
          ...hit,
          contatosObras: [],
          oportunidades: [],
          _count: { oportunidades: 0, contatosObras: 0 },
        };
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        contatos
          .filter((c) => {
            if (where.empresaId && c.empresaId !== where.empresaId) return false;
            if (where.ehParceiro !== undefined && c.ehParceiro !== where.ehParceiro) return false;
            return true;
          })
          .map((c) => ({
            ...c,
            _count: { oportunidades: 0, contatosObras: 0 },
          })),
      count: async ({ where }: { where: Record<string, unknown> }) =>
        contatos.filter((c) => !where.empresaId || c.empresaId === where.empresaId).length,
      create: async ({ data }: { data: ContatoFake }) => {
        const criado = { ...data, id: `p-${++seq}`, rtPadrao: data.rtPadrao ?? null };
        contatos.push(criado);
        return criado;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const alvo = contatos.find((c) => c.id === where.id)!;
        Object.assign(alvo, data);
        return alvo;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const i = contatos.findIndex((c) => c.id === where.id);
        return contatos.splice(i, 1)[0];
      },
    },
    comissaoPedido: { findMany: async () => [] },
    $queryRaw: async () => contatos.map((c) => ({ id: c.id })),
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  } as unknown as PrismaService;

  return {
    contatos,
    servico: new ContatosService(
      prisma,
      {
        usuario: { findFirst: async () => null },
        empresa: {
          findUnique: async () => ({
            configuracoes: { personalizacaoComercial: 'ECOLUME', rtPadraoParceiro: 10 },
          }),
        },
      } as unknown as PlatformPrismaService,
      {
        validarPara: async (_e: string, _ent: unknown, dados: unknown) => dados ?? {},
      } as unknown as CamposPersonalizadosService,
      { empresaEcolume: async () => ecolume } as unknown as PermissoesService,
    ),
  };
}

describe('ECOL-10a parceiro no Contato', () => {
  it('ativa parceiro com RT padrão 10% e tipo; desativa preservando dados', async () => {
    const { servico, contatos } = montar(true);
    const base = await servico.criar('emp', {
      nome: 'Studio Luz',
      telefone: '11990001111',
      natureza: NaturezaPessoa.PJ,
      tipo: TipoContato.EMPRESA,
      dadosPersonalizados: {},
    });
    expect(base.ehParceiro).toBe(false);

    const parceiro = await servico.atualizar('emp', base.id as string, {
      ehParceiro: true,
      tipoParceiro: TipoParceiro.ARQUITETO_DESIGNER,
      chavePix: 'email@parceiro.local',
      banco: '001',
      agencia: '1234',
      conta: '56789-0',
      titularNome: 'Studio Luz',
      titularDocumento: '11222333000181',
      observacoesParceria: 'RT mensal',
    });
    expect(parceiro.ehParceiro).toBe(true);
    expect(parceiro.tipoParceiro).toBe(TipoParceiro.ARQUITETO_DESIGNER);
    expect(parceiro.rtPadrao).toBe(RT_PADRAO_PARCEIRO);
    expect(parceiro.chavePix).toBe('email@parceiro.local');

    const listaParceiros = await servico.listar('emp', {
      pagina: 1,
      porPagina: 20,
      parceiro: 'true',
    });
    expect(listaParceiros.dados.every((c) => c.ehParceiro)).toBe(true);
    expect(listaParceiros.dados.some((c) => c.id === base.id)).toBe(true);

    const listaClientes = await servico.listar('emp', { pagina: 1, porPagina: 20 });
    expect(listaClientes.dados.some((c) => c.id === base.id)).toBe(true);

    const desmarcado = await servico.atualizar('emp', base.id as string, { ehParceiro: false });
    expect(desmarcado.ehParceiro).toBe(false);
    expect(contatos[0]?.chavePix).toBe('email@parceiro.local');
    expect(contatos[0]?.tipoParceiro).toBe(TipoParceiro.ARQUITETO_DESIGNER);
    expect(contatos[0]?.observacoesParceria).toBe('RT mensal');

    const soParceiros = await servico.listar('emp', {
      pagina: 1,
      porPagina: 20,
      parceiro: 'true',
    });
    expect(soParceiros.dados.some((c) => c.id === base.id)).toBe(false);
  });

  it('edita RT decimal e tipos; legado sem flag ignora parceria', async () => {
    const { servico } = montar(true);
    const p = await servico.criar('emp', {
      nome: 'Instalador',
      telefone: '11990002222',
      natureza: NaturezaPessoa.PF,
      ehParceiro: true,
      tipoParceiro: TipoParceiro.INSTALADOR_ELETRICISTA,
      rtPadrao: 12.5,
      tipo: TipoContato.OUTRO,
      dadosPersonalizados: {},
    });
    expect(p.rtPadrao).toBe(12.5);
    expect(p.tipoParceiro).toBe(TipoParceiro.INSTALADOR_ELETRICISTA);

    const editado = await servico.atualizar('emp', p.id as string, {
      tipoParceiro: TipoParceiro.CONSTRUTORA,
      rtPadrao: 7.25,
    });
    expect(editado.tipoParceiro).toBe(TipoParceiro.CONSTRUTORA);
    expect(editado.rtPadrao).toBe(7.25);

    const legado = montar(false);
    const sem = await legado.servico.criar('emp-p', {
      nome: 'Legado',
      telefone: '11990003333',
      tipo: TipoContato.ARQUITETO,
      ehParceiro: true,
      tipoParceiro: TipoParceiro.ARQUITETO_DESIGNER,
      dadosPersonalizados: {},
    });
    expect(sem.ehParceiro).toBe(false);
    expect(sem.tipoParceiro).toBeUndefined();
  });

  it('exige tipo ao marcar parceiro e isola empresa', async () => {
    const { servico } = montar(true);
    const a = await servico.criar('emp-a', {
      nome: 'A',
      telefone: '11990004444',
      natureza: NaturezaPessoa.PF,
      tipo: TipoContato.OUTRO,
      dadosPersonalizados: {},
    });
    await expect(
      servico.atualizar('emp-a', a.id as string, { ehParceiro: true }),
    ).rejects.toMatchObject({ codigo: 'TIPO_PARCEIRO_OBRIGATORIO' });

    await servico.atualizar('emp-a', a.id as string, {
      ehParceiro: true,
      tipoParceiro: TipoParceiro.CONSTRUTORA,
    });
    const b = await servico.criar('emp-b', {
      nome: 'B',
      telefone: '11990004444',
      natureza: NaturezaPessoa.PF,
      ehParceiro: true,
      tipoParceiro: TipoParceiro.CONSTRUTORA,
      tipo: TipoContato.OUTRO,
      dadosPersonalizados: {},
    });
    expect(b.empresaId).toBe('emp-b');
    const listaB = await servico.listar('emp-b', {
      pagina: 1,
      porPagina: 20,
      parceiro: 'true',
    });
    expect(listaB.dados.every((c) => c.empresaId === 'emp-b')).toBe(true);
  });
});
