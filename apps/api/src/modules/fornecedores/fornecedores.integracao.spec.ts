import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PerfilUsuario, digitosCnpj } from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { FornecedoresService } from './fornecedores.service';

const ATIVO = process.env.ECOL_FORNECEDOR === '1' || process.env.ECOL_PRODUTO === '1';
const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

/** CNPJ válido de teste (Receita formula). */
const CNPJ_A = '11222333000181';
const CNPJ_B = '34028316000103';

describe.skipIf(!ATIVO)('ECOL-03 no banco', () => {
  const auditoria = new AuditoriaService(platform as never, operacional as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const fornecedores = new FornecedoresService(operacional as never, permissoes, auditoria);

  let ecolumeId = '';
  let outraId = '';
  let padraoId = '';

  beforeAll(async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `FORN03 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const outra = await platform.empresa.create({
      data: {
        nome: `FORN03B ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `FORN03P ${sufixo}`,
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
      await operacional.produto.updateMany({ where: { empresaId }, data: { fornecedorId: null } });
      await operacional.fornecedor.deleteMany({ where: { empresaId } });
      await operacional.produto.deleteMany({ where: { empresaId } });
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  });

  it('cria e lê fornecedor com ST%', async () => {
    const criado = await fornecedores.criar(ecolumeId, {
      nome: 'Lumina LTDA',
      nomeCurto: 'Lumina',
      cnpj: CNPJ_A,
      aliquotaSt: 18,
      contatoNome: 'Ana',
      telefone: '11999990000',
      email: 'ana@teste.local',
      observacoes: 'principal',
      ativo: true,
    });
    expect(criado.cnpj).toBe(digitosCnpj(CNPJ_A));
    expect(criado.aliquotaSt).toBe(18);
    const lido = await fornecedores.obter(ecolumeId, criado.id);
    expect(lido.nome).toBe('Lumina LTDA');
    const lista = await fornecedores.listar(ecolumeId, 'Lumina');
    expect(lista.some((item) => item.id === criado.id)).toBe(true);
  });

  it('edita e recusa CNPJ inválido ou duplicado', async () => {
    const base = await fornecedores.criar(ecolumeId, {
      nome: 'Outro',
      cnpj: CNPJ_B,
      aliquotaSt: 0,
      ativo: true,
    });
    await expect(
      fornecedores.criar(ecolumeId, { nome: 'Dup', cnpj: CNPJ_A, aliquotaSt: 1, ativo: true }),
    ).rejects.toMatchObject({ codigo: 'CNPJ_DUPLICADO' });

    await expect(
      fornecedores.criar(ecolumeId, { nome: 'X', cnpj: '11111111111111', aliquotaSt: 0, ativo: true }),
    ).rejects.toMatchObject({ codigo: 'CNPJ_INVALIDO' });

    const editado = await fornecedores.atualizar(ecolumeId, base.id, {
      nome: 'Outro SA',
      aliquotaSt: 12.5,
    });
    expect(editado.nome).toBe('Outro SA');
    expect(editado.aliquotaSt).toBe(12.5);
  });

  it('exclusão bloqueada com produto vinculado e libera sem vínculo', async () => {
    const forn = await fornecedores.criar(ecolumeId, {
      nome: 'Temp',
      cnpj: '60746948000112',
      aliquotaSt: 4,
      ativo: true,
    });
    const produto = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Spot',
        sku: `F3-${sufixo}`,
        precoVenda: 10,
        estoqueAtual: 2,
        codigoFornecedor: 'SKU-FORN',
        fornecedorId: forn.id,
      },
    });
    expect(produto.codigoFornecedor).toBe('SKU-FORN');
    await expect(fornecedores.remover(ecolumeId, forn.id)).rejects.toMatchObject({
      codigo: 'FORNECEDOR_EM_USO',
    });

    const desv = await fornecedores.vincularProduto(ecolumeId, produto.id, null);
    expect(desv.fornecedorId).toBeNull();
    expect(desv.codigoFornecedor).toBe('SKU-FORN');
    expect(desv.precoVenda).toBe(10);
    expect(desv.estoqueAtual).toBe(2);

    await fornecedores.remover(ecolumeId, forn.id);
    await expect(fornecedores.obter(ecolumeId, forn.id)).rejects.toMatchObject({
      codigo: 'FORNECEDOR_NAO_ENCONTRADO',
    });
  });

  it('isola empresas e omite na empresa sem flag', async () => {
    const daA = (await fornecedores.listar(ecolumeId))[0]!;
    await expect(fornecedores.obter(outraId, daA.id)).rejects.toMatchObject({
      codigo: 'FORNECEDOR_NAO_ENCONTRADO',
    });
    await expect(fornecedores.listar(padraoId)).rejects.toMatchObject({
      codigo: 'FORNECEDOR_INDISPONIVEL',
    });

    const daB = await fornecedores.criar(outraId, {
      nome: 'B',
      cnpj: CNPJ_A,
      aliquotaSt: 5,
      ativo: true,
    });
    expect(daB.cnpj).toBe(CNPJ_A);
    expect((await fornecedores.listar(ecolumeId)).every((item) => item.id !== daB.id)).toBe(true);
  });

  it('ST% some sem VER_CUSTOS e vínculo não altera preço', async () => {
    const forn = await fornecedores.criar(ecolumeId, {
      nome: 'Perm',
      cnpj: '00000000000191',
      aliquotaSt: 9,
      ativo: true,
    });
    const vendedor = await platform.usuario.create({
      data: {
        empresaId: ecolumeId,
        nome: 'v',
        email: `forn.${sufixo}@teste.arcco.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.VENDEDOR,
      },
    });
    const oculto = await permissoes.filtrar(
      { id: vendedor.id, empresaId: ecolumeId, perfil: PerfilUsuario.VENDEDOR },
      forn,
    );
    expect(oculto).not.toHaveProperty('aliquotaSt');
    expect(oculto.nome).toBe('Perm');

    const produto = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'P',
        sku: `FP-${sufixo}`,
        precoVenda: 55,
        estoqueAtual: 3,
        codigoFornecedor: 'ABC',
      },
    });
    const vinculo = await fornecedores.vincularProduto(ecolumeId, produto.id, forn.id);
    expect(vinculo.fornecedorId).toBe(forn.id);
    expect(vinculo.codigoFornecedor).toBe('ABC');
    expect(vinculo.precoVenda).toBe(55);
  });
});
