import { describe, expect, it } from 'vitest';
import { PerfilUsuario, PermissaoComercial, PersonalizacaoComercial, publicarResposta, resolverPermissoes } from '@arcco/contratos';
import { AppError } from '../../common/erros/erros';
import type { PlatformPrismaService } from '../../database/platform-prisma.service';
import { PermissoesService } from './permissoes.service';

const auditoriaNula = {
  registrarPermissao: async () => undefined,
} as unknown as import('../auditoria/auditoria.service').AuditoriaService;

function criarPermissoes(api: PlatformPrismaService) {
  return new PermissoesService(api, auditoriaNula);
}

interface UsuarioFake {
  id: string;
  empresaId: string;
  perfil: string;
}

interface ConcessaoFake {
  empresaId: string;
  usuarioId: string;
  chave: string;
}

function plataforma(opcoes: {
  empresas: Record<string, unknown>;
  usuarios: UsuarioFake[];
  concessoes?: ConcessaoFake[];
}) {
  const concessoes = opcoes.concessoes ?? [];
  const consultas: unknown[] = [];
  const api = {
    empresa: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const configuracoes = opcoes.empresas[where.id];
        return configuracoes === undefined ? null : { configuracoes };
      },
    },
    usuario: {
      findFirst: async ({ where }: { where: { id: string; empresaId: string } }) =>
        opcoes.usuarios.find((u) => u.id === where.id && u.empresaId === where.empresaId) ?? null,
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(api),
    concessaoPermissao: {
      findMany: async ({ where }: { where: { empresaId: string; usuarioId: string } }) => {
        consultas.push(where);
        return concessoes
          .filter((c) => c.empresaId === where.empresaId && c.usuarioId === where.usuarioId)
          .map((c) => ({ chave: c.chave }));
      },
      create: async ({ data }: { data: ConcessaoFake }) => {
        concessoes.push(data);
        return data;
      },
      deleteMany: async ({ where }: { where: { usuarioId: string; chave: { in: string[] } } }) => {
        const remover = new Set(where.chave.in);
        for (let i = concessoes.length - 1; i >= 0; i -= 1) {
          if (concessoes[i].usuarioId === where.usuarioId && remover.has(concessoes[i].chave)) {
            concessoes.splice(i, 1);
          }
        }
      },
    },
  };
  return { api: api as unknown as PlatformPrismaService, consultas, concessoes };
}

const produto = {
  id: 'p1',
  nome: 'Spot',
  precoVenda: 89.9,
  custoMedio: 40,
  ultimoPreco: 42,
  ipi: 5,
  st: 4,
  margem: 30,
  lucroEstimado: 12,
};

const metricas = {
  oportunidades: {
    abertas: 2,
    valorPipeline: 500,
    ganhasNoPeriodo: 1,
    valorGanhoNoPeriodo: 200,
    ticketMedioGanho: 200,
    taxaConversao: 1,
  },
  funil: [{ etapaId: 'e1', nome: 'Aberto', quantidade: 2, valor: 500 }],
  faturamento: 1642.56,
  comissao: 164.26,
  pagamentos: [{ valorPago: 100 }],
};

describe('permissões financeiras', () => {
  it('proprietário da empresa com flag recebe os campos autorizados', async () => {
    const { api } = plataforma({
      empresas: { a: { personalizacaoComercial: PersonalizacaoComercial.ECOLUME } },
      usuarios: [{ id: 'dono', empresaId: 'a', perfil: PerfilUsuario.PROPRIETARIO }],
    });
    const servico = criarPermissoes(api);
    const ator = { id: 'dono', empresaId: 'a', perfil: PerfilUsuario.PROPRIETARIO };

    const publicado = await servico.filtrar(ator, produto);
    expect(publicado).toMatchObject({ precoVenda: 89.9, custoMedio: 40, margem: 30 });
    expect(await servico.chavesDaSessao(ator)).toContain(PermissaoComercial.VER_CUSTOS);
  });

  it('usuário sem concessão não recebe custo, faturamento, pagamento nem comissão', async () => {
    const { api } = plataforma({
      empresas: { a: { personalizacaoComercial: PersonalizacaoComercial.ECOLUME } },
      usuarios: [{ id: 'vend', empresaId: 'a', perfil: PerfilUsuario.VENDEDOR }],
    });
    const servico = criarPermissoes(api);
    const ator = { id: 'vend', empresaId: 'a', perfil: PerfilUsuario.VENDEDOR };

    const item = await servico.filtrar(ator, {
      ...produto,
      precoUnitario: 89.9,
      totalLinha: 89.9,
    });
    expect(item).toEqual({ id: 'p1', nome: 'Spot', precoVenda: 89.9, precoUnitario: 89.9, totalLinha: 89.9 });

    const painel = await servico.filtrar(ator, metricas);
    expect(painel.oportunidades).toEqual({ abertas: 2, ganhasNoPeriodo: 1, taxaConversao: 1 });
    expect(painel.funil).toEqual([{ etapaId: 'e1', nome: 'Aberto', quantidade: 2 }]);
    expect(painel).not.toHaveProperty('faturamento');
    expect(painel).not.toHaveProperty('comissao');
    expect(painel).not.toHaveProperty('pagamentos');
  });

  it('consulta e corpo com campo restrito são recusados no acesso direto', async () => {
    const { api } = plataforma({
      empresas: { a: { personalizacaoComercial: PersonalizacaoComercial.ECOLUME } },
      usuarios: [{ id: 'vend', empresaId: 'a', perfil: PerfilUsuario.VENDEDOR }],
    });
    const servico = criarPermissoes(api);
    const ator = { id: 'vend', empresaId: 'a', perfil: PerfilUsuario.VENDEDOR };

    await expect(servico.afirmarEntrada(ator, { custoMedio: 10 }, {})).rejects.toBeInstanceOf(AppError);
    await expect(servico.afirmarEntrada(ator, {}, { orderBy: 'margem' })).rejects.toMatchObject({
      codigo: 'SEM_PERMISSAO',
    });
    await expect(servico.afirmarEntrada(ator, { precoVenda: 90 }, {})).resolves.toBeUndefined();
  });

  it('a mesma chave concedida numa empresa não aparece na sessão da outra', async () => {
    const { api, consultas } = plataforma({
      empresas: {
        a: { personalizacaoComercial: PersonalizacaoComercial.ECOLUME },
        b: { personalizacaoComercial: PersonalizacaoComercial.ECOLUME },
      },
      usuarios: [
        { id: 'vend-a', empresaId: 'a', perfil: PerfilUsuario.VENDEDOR },
        { id: 'vend-b', empresaId: 'b', perfil: PerfilUsuario.VENDEDOR },
      ],
      concessoes: [{ empresaId: 'a', usuarioId: 'vend-a', chave: PermissaoComercial.VER_CUSTOS }],
    });
    const servico = criarPermissoes(api);

    const daA = await servico.filtrar(
      { id: 'vend-a', empresaId: 'a', perfil: PerfilUsuario.VENDEDOR },
      produto,
    );
    const daB = await servico.filtrar(
      { id: 'vend-b', empresaId: 'b', perfil: PerfilUsuario.VENDEDOR },
      produto,
    );

    expect(daA.custoMedio).toBe(40);
    expect(daB).not.toHaveProperty('custoMedio');
    expect(consultas).toEqual([
      { empresaId: 'a', usuarioId: 'vend-a' },
      { empresaId: 'b', usuarioId: 'vend-b' },
    ]);
  });

  it('empresa sem a flag mantém custo e ticket mesmo para vendedor sem concessão', async () => {
    const { api } = plataforma({
      empresas: { a: { onboardingConcluido: true } },
      usuarios: [{ id: 'vend', empresaId: 'a', perfil: PerfilUsuario.VENDEDOR }],
    });
    const servico = criarPermissoes(api);
    const ator = { id: 'vend', empresaId: 'a', perfil: PerfilUsuario.VENDEDOR };

    expect(await servico.filtrar(ator, produto)).toMatchObject({ custoMedio: 40, precoVenda: 89.9 });
    expect(await servico.filtrar(ator, metricas)).toMatchObject({
      oportunidades: { ticketMedioGanho: 200, valorPipeline: 500 },
      funil: [{ valor: 500 }],
    });
    expect(await servico.chavesDaSessao(ator)).toBeNull();
    await expect(servico.afirmarEntrada(ator, { custoMedio: 1 }, { orderBy: 'margem' })).resolves.toBeUndefined();
  });

  it('não concede permissão de usuário de outra empresa', async () => {
    const { api } = plataforma({
      empresas: { a: {}, b: {} },
      usuarios: [{ id: 'vend-a', empresaId: 'a', perfil: PerfilUsuario.VENDEDOR }],
    });
    const servico = criarPermissoes(api);
    await expect(
      servico.conceder('b', 'vend-a', [PermissaoComercial.VER_CUSTOS]),
    ).rejects.toMatchObject({ codigo: 'USUARIO_NAO_ENCONTRADO' });
  });

  it('ausência de concessão na empresa com flag não libera o dado', async () => {
    const { api } = plataforma({
      empresas: { a: { personalizacaoComercial: PersonalizacaoComercial.ECOLUME } },
      usuarios: [{ id: 'gestor', empresaId: 'a', perfil: PerfilUsuario.GESTOR }],
    });
    const servico = criarPermissoes(api);
    const ator = { id: 'gestor', empresaId: 'a', perfil: PerfilUsuario.GESTOR };

    expect(await servico.chavesDaSessao(ator)).toEqual([]);
    expect(await servico.filtrar(ator, produto)).not.toHaveProperty('custoMedio');
  });

  it('com a chave gravada, o custo volta e o faturamento continua oculto', async () => {
    const base = plataforma({
      empresas: { a: { personalizacaoComercial: PersonalizacaoComercial.ECOLUME } },
      usuarios: [{ id: 'vend', empresaId: 'a', perfil: PerfilUsuario.VENDEDOR }],
    });
    const servico = criarPermissoes(base.api);
    await servico.conceder('a', 'vend', [PermissaoComercial.VER_CUSTOS]);
    const ator = { id: 'vend', empresaId: 'a', perfil: PerfilUsuario.VENDEDOR };

    const publicado = await servico.filtrar(ator, { ...produto, ticketMedioGanho: 10 });
    expect(publicado.custoMedio).toBe(40);
    expect(publicado).not.toHaveProperty('ticketMedioGanho');
  });

  it('não reescreve binário nem preço comercial dentro de lista aninhada', () => {
    const ctx = resolverPermissoes({
      configuracoes: { personalizacaoComercial: PersonalizacaoComercial.ECOLUME },
      perfil: PerfilUsuario.ATENDENTE,
      concedidas: [],
    });
    const bytes = new Uint8Array([1, 2, 3]);
    expect(publicarResposta(ctx, bytes)).toBe(bytes);
    expect(publicarResposta(ctx, [{ itens: [{ precoUnitario: 12, custoMedio: 4 }] }])).toEqual([
      { itens: [{ precoUnitario: 12 }] },
    ]);
  });
});
