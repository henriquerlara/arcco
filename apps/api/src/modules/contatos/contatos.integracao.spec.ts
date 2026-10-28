import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { NaturezaPessoa, TipoContato } from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ContatosService } from './contatos.service';
import type { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';

const ATIVO = process.env.ECOL_CONTATO === '1' || process.env.ECOL_PRODUTO === '1';
const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];
const CPF_OK = '52998224725';
const CNPJ_OK = '11222333000181';

describe.skipIf(!ATIVO)('ECOL-09a no banco', () => {
  const auditoria = new AuditoriaService(platform as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const campos = {
    validarPara: async (_e: string, _ent: unknown, dados: unknown) => dados ?? {},
  } as unknown as CamposPersonalizadosService;
  const contatos = new ContatosService(
    operacional as never,
    platform as never,
    campos,
    permissoes,
  );

  let ecolumeId = '';
  let outraId = '';
  let padraoId = '';

  beforeAll(async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `CLI09 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const outra = await platform.empresa.create({
      data: {
        nome: `CLI09B ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `CLI09P ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { onboardingConcluido: true },
      },
    });
    empresas.push(ecolume.id, outra.id, padrao.id);
    ecolumeId = ecolume.id;
    outraId = outra.id;
    padraoId = padrao.id;
  });

  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.contato.deleteMany({ where: { empresaId } });
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  });

  it('PF e PJ mínimos, busca e filtros', async () => {
    const pf = await contatos.criar(ecolumeId, {
      nome: `Maria ${sufixo}`,
      telefone: '11981001001',
      natureza: NaturezaPessoa.PF,
      cidade: 'Campinas',
      uf: 'SP',
      tipo: TipoContato.OUTRO,
      dadosPersonalizados: {},
    });
    const pj = await contatos.criar(ecolumeId, {
      nome: `Empresa ${sufixo} LTDA`,
      telefone: '11981001002',
      natureza: NaturezaPessoa.PJ,
      nomeFantasia: `Fantasia ${sufixo}`,
      documento: CNPJ_OK,
      cidade: 'Campinas',
      uf: 'SP',
      pessoasEmpresa: [{ nome: 'Contato PJ', cargo: 'Compras' }],
      tipo: TipoContato.EMPRESA,
      dadosPersonalizados: {},
    });
    expect(pf.natureza).toBe('PF');
    expect(pj.documento).toBe(CNPJ_OK);

    const listaPf = await contatos.listar(ecolumeId, {
      pagina: 1,
      porPagina: 20,
      natureza: 'PF',
    });
    expect(listaPf.dados.some((c) => c.id === pf.id)).toBe(true);
    expect(listaPf.dados.every((c) => c.natureza === 'PF')).toBe(true);

    const busca = await contatos.listar(ecolumeId, {
      pagina: 1,
      porPagina: 20,
      busca: `Fantasia ${sufixo}`,
    });
    expect(busca.dados.some((c) => c.id === pj.id)).toBe(true);

    const cidade = await contatos.listar(ecolumeId, {
      pagina: 1,
      porPagina: 20,
      cidade: 'Campinas',
    });
    expect(cidade.dados.length).toBeGreaterThanOrEqual(2);
  });

  it('duplicidade por CPF e isolamento multiempresa', async () => {
    await contatos.criar(ecolumeId, {
      nome: `Doc A ${sufixo}`,
      telefone: '11982002001',
      natureza: NaturezaPessoa.PF,
      documento: CPF_OK,
      tipo: TipoContato.OUTRO,
      dadosPersonalizados: {},
    });
    await expect(
      contatos.criar(ecolumeId, {
        nome: 'Dup',
        telefone: '11982002002',
        natureza: NaturezaPessoa.PF,
        documento: CPF_OK,
        tipo: TipoContato.OUTRO,
        dadosPersonalizados: {},
      }),
    ).rejects.toMatchObject({ codigo: 'CONTATO_DUPLICADO' });

    const outra = await contatos.criar(outraId, {
      nome: `Doc B ${sufixo}`,
      telefone: '11982002001',
      natureza: NaturezaPessoa.PF,
      documento: CPF_OK,
      tipo: TipoContato.OUTRO,
      dadosPersonalizados: {},
    });
    expect(outra.empresaId).toBe(outraId);

    const legado = await contatos.criar(padraoId, {
      nome: `Legado ${sufixo}`,
      telefone: '11983003001',
      tipo: TipoContato.ARQUITETO,
      dadosPersonalizados: {},
    });
    expect(legado.natureza).toBeNull();
    expect(legado.tipo).toBe(TipoContato.ARQUITETO);
  });

  it('edita endereço sem alterar obra e rejeita CNPJ inválido', async () => {
    const criado = await contatos.criar(ecolumeId, {
      nome: `Edit ${sufixo}`,
      telefone: '11984004001',
      natureza: NaturezaPessoa.PJ,
      tipo: TipoContato.EMPRESA,
      dadosPersonalizados: {},
    });
    const editado = await contatos.atualizar(ecolumeId, criado.id, {
      cidade: 'Santos',
      uf: 'SP',
      logradouro: 'Rua da Praia',
      numero: '10',
    });
    expect(editado.cidade).toBe('Santos');
    expect(editado.logradouro).toBe('Rua da Praia');

    await expect(
      contatos.atualizar(ecolumeId, criado.id, { documento: '11111111111111' }),
    ).rejects.toMatchObject({ codigo: 'CNPJ_INVALIDO' });
  });
});
