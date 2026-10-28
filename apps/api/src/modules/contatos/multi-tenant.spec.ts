import { describe, expect, it } from 'vitest';
import { ContatosService } from './contatos.service';
import { AppError } from '../../common/erros/erros';
import type { PrismaService } from '../../database/prisma.service';
import type { PlatformPrismaService } from '../../database/platform-prisma.service';
import type { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';
import type { PermissoesService } from '../permissoes/permissoes.service';

/**
 * Teste de isolamento multi-tenant: garante que um usuario de uma empresa nunca
 * acessa/edita registros de outra empresa. Usa um Prisma em memoria para nao depender
 * de banco de dados.
 */

interface ContatoFake {
  id: string;
  empresaId: string;
  nome: string;
  telefoneNormalizado: string;
}

function criarPrismaFake(contatos: ContatoFake[]): PrismaService {
  const casa = (registro: ContatoFake, where: Record<string, unknown>): boolean =>
    Object.entries(where)
      .filter(([, v]) => typeof v !== 'object')
      .every(
        ([chave, valor]) => (registro as unknown as Record<string, unknown>)[chave] === valor,
      );

  const comRelacoes = (contato: ContatoFake) => ({
    ...contato,
    contatosObras: [],
    oportunidades: [],
    _count: { oportunidades: 0, contatosObras: 0 },
  });

  const api = {
    contato: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const contato = contatos.find((c) => casa(c, where));
        return contato ? comRelacoes(contato) : null;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        contatos.filter((c) => casa(c, where)).map(comRelacoes),
      count: async ({ where }: { where: Record<string, unknown> }) =>
        contatos.filter((c) => casa(c, where)).length,
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
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };

  return api as unknown as PrismaService;
}

const camposFake = {
  validarPara: async (_e: string, _ent: unknown, dados: unknown) => dados ?? {},
} as unknown as CamposPersonalizadosService;

const platformFake = {
  usuario: { findFirst: async () => null },
} as unknown as PlatformPrismaService;

const permissoesFake = {
  empresaEcolume: async () => false,
} as unknown as PermissoesService;

const EMPRESA_A = 'empresa-a';
const EMPRESA_B = 'empresa-b';

function montar() {
  const contatos: ContatoFake[] = [
    { id: 'c1', empresaId: EMPRESA_A, nome: 'Contato A', telefoneNormalizado: '5511900000001' },
    { id: 'c2', empresaId: EMPRESA_B, nome: 'Contato B', telefoneNormalizado: '5511900000002' },
  ];
  const prisma = criarPrismaFake(contatos);
  return {
    servico: new ContatosService(prisma, platformFake, camposFake, permissoesFake),
    contatos,
  };
}

describe('Isolamento multi-tenant de contatos', () => {
  it('empresa acessa apenas o proprio contato', async () => {
    const { servico } = montar();
    const contato = await servico.obter(EMPRESA_A, 'c1');
    expect(contato.nome).toBe('Contato A');
  });

  it('empresa NAO acessa contato de outra empresa', async () => {
    const { servico } = montar();
    await expect(servico.obter(EMPRESA_A, 'c2')).rejects.toBeInstanceOf(AppError);
  });

  it('nao permite atualizar contato de outra empresa', async () => {
    const { servico } = montar();
    await expect(
      servico.atualizar(EMPRESA_A, 'c2', { nome: 'Hack' }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('nao permite remover contato de outra empresa', async () => {
    const { servico, contatos } = montar();
    await expect(servico.remover(EMPRESA_A, 'c2')).rejects.toBeInstanceOf(AppError);
    expect(contatos).toHaveLength(2);
  });

  it('listagem retorna apenas contatos da empresa autenticada', async () => {
    const { servico } = montar();
    const resultado = await servico.listar(EMPRESA_A, { pagina: 1, porPagina: 20 });
    expect(resultado.dados).toHaveLength(1);
    expect(resultado.dados[0]!.empresaId).toBe(EMPRESA_A);
  });
});
