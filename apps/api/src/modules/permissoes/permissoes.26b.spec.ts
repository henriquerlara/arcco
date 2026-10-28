import { describe, expect, it } from 'vitest';
import {
  PerfilUsuario,
  PermissaoComercial,
  PersonalizacaoComercial,
} from '@arcco/contratos';
import type { PlatformPrismaService } from '../../database/platform-prisma.service';
import { PermissoesService } from './permissoes.service';

const auditoria = {
  registrarPermissao: async () => undefined,
} as unknown as import('../auditoria/auditoria.service').AuditoriaService;

describe('ECOL-26b PermissoesService definir/conjuntos', () => {
  function montar() {
    const concessoes: Array<{
      empresaId: string;
      usuarioId: string;
      chave: string;
      conjuntoId?: string | null;
    }> = [];
    const conjuntos: Array<{
      id: string;
      empresaId: string;
      nome: string;
      chaves: string[];
    }> = [];
    let seq = 0;

    const api = {
      empresa: {
        findUnique: async () => ({
          configuracoes: { personalizacaoComercial: PersonalizacaoComercial.ECOLUME },
        }),
      },
      usuario: {
        findFirst: async ({ where }: { where: { id: string; empresaId: string } }) => {
          if (where.id === 'admin') {
            return { id: 'admin', perfil: PerfilUsuario.PROPRIETARIO, nome: 'A', email: 'a@x', ativo: true };
          }
          if (where.id === 'vend') {
            return { id: 'vend', perfil: PerfilUsuario.VENDEDOR, nome: 'V', email: 'v@x', ativo: true };
          }
          if (where.id === 'gestor') {
            return { id: 'gestor', perfil: PerfilUsuario.GESTOR, nome: 'G', email: 'g@x', ativo: true };
          }
          return null;
        },
      },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(api),
      concessaoPermissao: {
        findMany: async ({ where }: { where: { empresaId: string; usuarioId: string } }) =>
          concessoes
            .filter((c) => c.empresaId === where.empresaId && c.usuarioId === where.usuarioId)
            .map((c) => ({ chave: c.chave, conjuntoId: c.conjuntoId ?? null })),
        create: async ({
          data,
        }: {
          data: { empresaId: string; usuarioId: string; chave: string; conjuntoId?: string | null };
        }) => {
          concessoes.push(data);
          return data;
        },
        deleteMany: async ({ where }: { where: { empresaId: string; usuarioId: string } }) => {
          for (let i = concessoes.length - 1; i >= 0; i -= 1) {
            if (
              concessoes[i].empresaId === where.empresaId &&
              concessoes[i].usuarioId === where.usuarioId
            ) {
              concessoes.splice(i, 1);
            }
          }
        },
      },
      conjuntoPermissao: {
        findMany: async ({ where }: { where: { empresaId: string } }) =>
          conjuntos.filter((c) => c.empresaId === where.empresaId),
        findFirst: async ({ where }: { where: { id?: string; empresaId: string } }) =>
          conjuntos.find(
            (c) => c.empresaId === where.empresaId && (!where.id || c.id === where.id),
          ) ?? null,
        create: async ({
          data,
        }: {
          data: { empresaId: string; nome: string; chaves: string[] };
        }) => {
          const c = { id: `cj-${++seq}`, ...data };
          conjuntos.push(c);
          return c;
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { nome?: string; chaves?: string[] };
        }) => {
          const c = conjuntos.find((x) => x.id === where.id)!;
          Object.assign(c, data);
          return c;
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const i = conjuntos.findIndex((x) => x.id === where.id);
          if (i >= 0) conjuntos.splice(i, 1);
        },
      },
    };

    return {
      concessoes,
      conjuntos,
      servico: new PermissoesService(api as unknown as PlatformPrismaService, auditoria),
    };
  }

  const admin = {
    id: 'admin',
    empresaId: 'emp',
    perfil: PerfilUsuario.PROPRIETARIO,
  };

  it('admin define permissões; gestor não administra', async () => {
    const { servico, concessoes } = montar();
    await servico.definir(
      'emp',
      'vend',
      [PermissaoComercial.ABA_AGENDA, PermissaoComercial.ESCOPO_AGENDA_PROPRIAS],
      admin,
    );
    expect(concessoes.map((c) => c.chave).sort()).toEqual([
      PermissaoComercial.ABA_AGENDA,
      PermissaoComercial.ESCOPO_AGENDA_PROPRIAS,
    ]);

    await expect(
      servico.definir('emp', 'vend', [PermissaoComercial.VER_CUSTOS], {
        id: 'gestor',
        empresaId: 'emp',
        perfil: PerfilUsuario.GESTOR,
      }),
    ).rejects.toMatchObject({ codigo: 'SEM_PERMISSAO' });
  });

  it('bloqueia autoelevação e edição de admin', async () => {
    const { servico } = montar();
    await expect(
      servico.definir('emp', 'gestor', [PermissaoComercial.VER_CUSTOS], {
        id: 'gestor',
        empresaId: 'emp',
        perfil: PerfilUsuario.GESTOR,
      }),
    ).rejects.toMatchObject({ codigo: 'SEM_PERMISSAO' });

    await expect(
      servico.definir('emp', 'admin', [PermissaoComercial.VER_CUSTOS], admin),
    ).rejects.toMatchObject({ codigo: 'ADMIN_IMUTAVEL' });
  });

  it('conjunto é template: atualizar não muda usuário; aplicar copia', async () => {
    const { servico, concessoes, conjuntos } = montar();
    const cj = await servico.criarConjunto(
      'emp',
      { nome: 'Vendas', chaves: [PermissaoComercial.ABA_NEGOCIOS, PermissaoComercial.VER_NEGOCIOS_TODOS] },
      admin,
    );
    await servico.aplicarConjunto('emp', cj.id, 'vend', admin);
    expect(concessoes.filter((c) => c.usuarioId === 'vend').map((c) => c.chave).sort()).toEqual([
      PermissaoComercial.ABA_NEGOCIOS,
      PermissaoComercial.VER_NEGOCIOS_TODOS,
    ]);

    await servico.atualizarConjunto(
      'emp',
      cj.id,
      { chaves: [PermissaoComercial.ABA_CLIENTES] },
      admin,
    );
    expect(conjuntos[0]?.chaves).toEqual([PermissaoComercial.ABA_CLIENTES]);
    // usuário permanece com snapshot anterior
    expect(concessoes.filter((c) => c.usuarioId === 'vend').map((c) => c.chave)).toContain(
      PermissaoComercial.ABA_NEGOCIOS,
    );
  });

  it('revogação efetiva na resolução seguinte', async () => {
    const { servico } = montar();
    await servico.definir('emp', 'vend', [PermissaoComercial.VER_CUSTOS], admin);
    let ctx = await servico.resolver({
      id: 'vend',
      empresaId: 'emp',
      perfil: PerfilUsuario.VENDEDOR,
    });
    expect(ctx.modo === 'ecolume' && ctx.chaves.has(PermissaoComercial.VER_CUSTOS)).toBe(true);

    await servico.definir('emp', 'vend', [], admin);
    ctx = await servico.resolver({
      id: 'vend',
      empresaId: 'emp',
      perfil: PerfilUsuario.VENDEDOR,
    });
    expect(ctx.modo === 'ecolume' && ctx.chaves.has(PermissaoComercial.VER_CUSTOS)).toBe(false);
  });
});
