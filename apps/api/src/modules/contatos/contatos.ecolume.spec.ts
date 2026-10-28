import { describe, expect, it } from 'vitest';
import { NaturezaPessoa, TipoContato } from '@arcco/contratos';
import { ContatosService } from './contatos.service';
import { AppError } from '../../common/erros/erros';
import type { PrismaService } from '../../database/prisma.service';
import type { PlatformPrismaService } from '../../database/platform-prisma.service';
import type { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';
import type { PermissoesService } from '../permissoes/permissoes.service';

type ContatoFake = {
  id: string;
  empresaId: string;
  nome: string;
  telefone: string;
  telefoneNormalizado: string;
  email: string | null;
  tipo: string;
  empresaNome: string | null;
  documento: string | null;
  origem: string | null;
  observacoes: string | null;
  responsavelId: string | null;
  dadosPersonalizados: object;
  natureza: string | null;
  nomeFantasia: string | null;
  inscricaoEstadual: string | null;
  ieIsento: boolean;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  telefonesExtras: unknown;
  pessoasEmpresa: unknown;
  ehParceiro: boolean;
};

const CPF_OK = '52998224725';
const CNPJ_OK = '11222333000181';

function montar(ecolume: boolean) {
  const contatos: ContatoFake[] = [];
  let seq = 0;

  const prisma = {
    contato: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        return (
          contatos.find((c) => {
            if (where.empresaId && c.empresaId !== where.empresaId) return false;
            if (typeof where.id === 'string' && c.id !== where.id) return false;
            if (
              where.id &&
              typeof where.id === 'object' &&
              where.id !== null &&
              'not' in (where.id as object) &&
              c.id === (where.id as { not: string }).not
            ) {
              return false;
            }
            if (where.telefoneNormalizado && c.telefoneNormalizado !== where.telefoneNormalizado)
              return false;
            if (where.documento && c.documento !== where.documento) return false;
            return true;
          }) ?? null
        );
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        contatos.filter((c) => {
          if (where.empresaId && c.empresaId !== where.empresaId) return false;
          if (where.natureza && c.natureza !== where.natureza) return false;
          if (where.ehParceiro !== undefined && c.ehParceiro !== where.ehParceiro) return false;
          return true;
        }),
      count: async ({ where }: { where: Record<string, unknown> }) =>
        contatos.filter((c) => !where.empresaId || c.empresaId === where.empresaId).length,
      create: async ({ data }: { data: ContatoFake }) => {
        const criado = { ...data, id: `c-${++seq}` };
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
    $queryRaw: async () => contatos.map((c) => ({ id: c.id })),
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  } as unknown as PrismaService;

  const campos = {
    validarPara: async (_e: string, _ent: unknown, dados: unknown) => dados ?? {},
  } as unknown as CamposPersonalizadosService;

  const platform = {
    usuario: { findFirst: async () => null },
  } as unknown as PlatformPrismaService;

  const permissoes = {
    empresaEcolume: async () => ecolume,
  } as unknown as PermissoesService;

  return {
    contatos,
    servico: new ContatosService(prisma, platform, campos, permissoes),
  };
}

describe('ECOL-09a ContatosService', () => {
  it('PF mínimo com flag e rejeita CPF inválido', async () => {
    const { servico } = montar(true);
    const pf = await servico.criar('emp-a', {
      nome: 'Maria Silva',
      telefone: '11988887777',
      natureza: NaturezaPessoa.PF,
      tipo: TipoContato.OUTRO,
      dadosPersonalizados: {},
    });
    expect(pf.natureza).toBe('PF');
    expect(pf.documento).toBeNull();

    await expect(
      servico.criar('emp-a', {
        nome: 'Joao',
        telefone: '11988886666',
        natureza: NaturezaPessoa.PF,
        documento: '11111111111',
        tipo: TipoContato.OUTRO,
        dadosPersonalizados: {},
      }),
    ).rejects.toMatchObject({ codigo: 'CPF_INVALIDO' });
  });

  it('PJ com fantasia, IE isento, pessoas e endereço do cliente', async () => {
    const { servico } = montar(true);
    const pj = await servico.criar('emp-a', {
      nome: 'Lumina Comercio LTDA',
      telefone: '11977776666',
      natureza: NaturezaPessoa.PJ,
      nomeFantasia: 'Lumina',
      ieIsento: true,
      inscricaoEstadual: '123',
      documento: CNPJ_OK,
      cep: '01310-100',
      logradouro: 'Av Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      cidade: 'Sao Paulo',
      uf: 'sp',
      pessoasEmpresa: [
        { nome: 'Ana Contato', cargo: 'Compras', telefone: '11911112222', email: 'ana@x.local' },
      ],
      telefonesExtras: [{ numero: '11933334444' }],
      tipo: TipoContato.EMPRESA,
      dadosPersonalizados: {},
    });
    expect(pj.natureza).toBe('PJ');
    expect(pj.documento).toBe(CNPJ_OK);
    expect(pj.ieIsento).toBe(true);
    expect(pj.inscricaoEstadual).toBeNull();
    expect(pj.uf).toBe('SP');
    expect(pj.cidade).toBe('Sao Paulo');
    expect(Array.isArray(pj.pessoasEmpresa)).toBe(true);
    expect((pj.pessoasEmpresa as { nome: string }[])[0]?.nome).toBe('Ana Contato');
  });

  it('duplicidade por telefone e CPF com detalhes do contato existente', async () => {
    const { servico } = montar(true);
    const base = await servico.criar('emp-a', {
      nome: 'Base',
      telefone: '11955554444',
      natureza: NaturezaPessoa.PF,
      documento: CPF_OK,
      tipo: TipoContato.OUTRO,
      dadosPersonalizados: {},
    });

    try {
      await servico.criar('emp-a', {
        nome: 'Outro',
        telefone: '11955554444',
        natureza: NaturezaPessoa.PF,
        tipo: TipoContato.OUTRO,
        dadosPersonalizados: {},
      });
      expect.fail('deveria falhar');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      const err = e as AppError;
      expect(err.codigo).toBe('CONTATO_DUPLICADO');
      expect((err.detalhes as { contato: { id: string } }).contato.id).toBe(base.id);
    }

    try {
      await servico.criar('emp-a', {
        nome: 'Outro CPF',
        telefone: '11955553333',
        natureza: NaturezaPessoa.PF,
        documento: CPF_OK,
        tipo: TipoContato.OUTRO,
        dadosPersonalizados: {},
      });
      expect.fail('deveria falhar');
    } catch (e) {
      expect((e as AppError).codigo).toBe('CONTATO_DUPLICADO');
      expect((e as AppError).detalhes).toMatchObject({ motivo: 'documento' });
    }
  });

  it('isolamento: documento igual em outra empresa e legado sem flag', async () => {
    const { servico } = montar(true);
    await servico.criar('emp-a', {
      nome: 'A',
      telefone: '11911110001',
      natureza: NaturezaPessoa.PF,
      documento: CPF_OK,
      tipo: TipoContato.OUTRO,
      dadosPersonalizados: {},
    });
    const b = await servico.criar('emp-b', {
      nome: 'B',
      telefone: '11911110001',
      natureza: NaturezaPessoa.PF,
      documento: CPF_OK,
      tipo: TipoContato.OUTRO,
      dadosPersonalizados: {},
    });
    expect(b.empresaId).toBe('emp-b');

    const legado = montar(false);
    const semFlag = await legado.servico.criar('emp-p', {
      nome: 'Legado',
      telefone: '11922220000',
      tipo: TipoContato.ARQUITETO,
      empresaNome: 'Escritorio',
      dadosPersonalizados: {},
    });
    expect(semFlag.natureza).toBeNull();
    expect(semFlag.tipo).toBe(TipoContato.ARQUITETO);
  });

  it('exige natureza na flag e permite cadastro sem documento', async () => {
    const { servico } = montar(true);
    await expect(
      servico.criar('emp-a', {
        nome: 'Sem tipo',
        telefone: '11900001111',
        tipo: TipoContato.OUTRO,
        dadosPersonalizados: {},
      }),
    ).rejects.toMatchObject({ codigo: 'NATUREZA_OBRIGATORIA' });

    const ok = await servico.criar('emp-a', {
      nome: 'Sem doc',
      telefone: '11900002222',
      natureza: NaturezaPessoa.PJ,
      tipo: TipoContato.EMPRESA,
      dadosPersonalizados: {},
    });
    expect(ok.documento).toBeNull();
  });
});
