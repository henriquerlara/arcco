import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { MotivoAjusteEstoque, PerfilUsuario, PermissaoComercial } from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ProdutosService } from './produtos.service';

/** Banco local. Não altera as contas de demonstração além da leitura do que a migração preservou. */
const ATIVO = process.env.ECOL_PRODUTO === '1';
const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

const SEED = [
  { sku: 'SPOT-01', precoVenda: 89.9, estoqueAtual: 40 },
  { sku: 'FITA-5M', precoVenda: 149, estoqueAtual: 3 },
  { sku: 'PERF-AL', precoVenda: 62.5, estoqueAtual: 25 },
];

describe.skipIf(!ATIVO)('ECOL-04a no banco', { timeout: 30_000 }, () => {
  const auditoria = new AuditoriaService(platform as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const produtos = new ProdutosService(operacional as never, auditoria, permissoes);

  let ecolumeId = '';
  let padraoId = '';
  let usuarioId = '';

  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.movimentacaoEstoque.deleteMany({ where: { empresaId } });
      await operacional.produto.deleteMany({ where: { empresaId } });
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  }, 120_000);

  // testTimeout 5s estoura sob suíte concorrente no Postgres compartilhado.
  it('a migração preserva saldo, preço e movimentação dos produtos já existentes', async () => {
    for (const esperado of SEED) {
      const produto = await operacional.produto.findFirst({ where: { sku: esperado.sku } });
      expect(produto).toMatchObject({
        precoVenda: esperado.precoVenda,
        estoqueAtual: esperado.estoqueAtual,
        codigoInterno: null,
        custoMedio: null,
        ultimoPreco: null,
      });
    }
    expect(await operacional.movimentacaoEstoque.count()).toBeGreaterThanOrEqual(3);
    // Isola o seed: outras suítes ECOL no mesmo banco podem gravar custo em produtos novos.
    const seedIds = (
      await operacional.produto.findMany({
        where: { sku: { in: SEED.map((s) => s.sku) } },
        select: { id: true },
      })
    ).map((p) => p.id);
    const comPrecoNoSeed = await operacional.movimentacaoEstoque.count({
      where: { produtoId: { in: seedIds }, precoUnitarioCusto: { not: null } },
    });
    expect(comPrecoNoSeed).toBe(0);
  });

  it('cria produto na empresa com flag e código interno, sem mexer no saldo alheio', async () => {
    const antes = await operacional.produto.findFirstOrThrow({ where: { sku: 'SPOT-01' } });
    const ecolume = await platform.empresa.create({
      data: {
        nome: `PROD04 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `PAD04 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { onboardingConcluido: true },
      },
    });
    empresas.push(ecolume.id, padrao.id);
    ecolumeId = ecolume.id;
    padraoId = padrao.id;
    const usuario = await platform.usuario.create({
      data: {
        empresaId: ecolumeId,
        nome: 'ator',
        email: `ecol04a.${sufixo}@teste.arcco.local`,
        senhaHash: 'nao-e-segredo-de-login',
        perfil: PerfilUsuario.VENDEDOR,
      },
    });
    usuarioId = usuario.id;

    const criado = await produtos.criar(
      ecolumeId,
      { nome: `Luminaria ${sufixo}`, precoVenda: 20, nomeFiscal: 'Luminaria fiscal', saldoInicial: 2 },
      usuarioId,
    );
    expect(criado.codigoInterno).toBe('CI-000001');
    expect(criado.nomeFiscal).toBe('Luminaria fiscal');
    expect(criado.estoqueAtual).toBe(2);
    expect(criado.custoMedio).toBeNull();
    const depois = await operacional.produto.findFirstOrThrow({ where: { id: antes.id } });
    expect(depois.estoqueAtual).toBe(antes.estoqueAtual);
    expect(depois.precoVenda).toBe(antes.precoVenda);
  });

  it('gera códigos vazios sem renomear e sem alterar saldo, inclusive negativo', async () => {
    const semMovimento = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Sem movimento',
        precoVenda: 8,
        estoqueAtual: 0,
        criadoEm: new Date('2026-01-01T00:00:01.000Z'),
      },
    });
    const comMovimento = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Com movimento',
        precoVenda: 9,
        estoqueAtual: 5,
        criadoEm: new Date('2026-01-01T00:00:02.000Z'),
      },
    });
    await operacional.movimentacaoEstoque.create({
      data: {
        empresaId: ecolumeId,
        produtoId: comMovimento.id,
        tipo: 'ENTRADA',
        quantidade: 5,
        saldoApos: 5,
      },
    });
    const negativo = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Negativo',
        precoVenda: 4,
        estoqueAtual: -2,
        criadoEm: new Date('2026-01-01T00:00:03.000Z'),
      },
    });

    expect(await produtos.garantirCodigosInternos(ecolumeId)).toBe(3);
    expect(await produtos.garantirCodigosInternos(ecolumeId)).toBe(0);

    const linhas = await operacional.produto.findMany({
      where: { id: { in: [semMovimento.id, comMovimento.id, negativo.id] } },
      orderBy: { criadoEm: 'asc' },
    });
    expect(linhas.map((item) => item.codigoInterno)).toEqual(['CI-000002', 'CI-000003', 'CI-000004']);
    expect(linhas.map((item) => item.estoqueAtual)).toEqual([0, 5, -2]);
    expect(linhas.map((item) => item.precoVenda)).toEqual([8, 9, 4]);
    expect(await operacional.movimentacaoEstoque.count({ where: { produtoId: comMovimento.id } })).toBe(1);

    await expect(
      produtos.atualizar(ecolumeId, semMovimento.id, { codigoInterno: 'CI-999999', nome: 'Sem movimento' }, usuarioId),
    ).rejects.toMatchObject({ codigo: 'CODIGO_INTERNO_IMUTAVEL' });
    const intacto = await operacional.produto.findFirstOrThrow({ where: { id: semMovimento.id } });
    expect(intacto.codigoInterno).toBe('CI-000002');
    expect(intacto.estoqueAtual).toBe(0);
  });

  it('isola o código e omite a estrutura nova na empresa sem flag', async () => {
    const outro = await produtos.criar(padraoId, { nome: `Legado ${sufixo}`, precoVenda: 15, saldoInicial: 1 });
    expect(outro).not.toHaveProperty('codigoInterno');
    expect(outro).not.toHaveProperty('nomeFiscal');
    expect(outro).not.toHaveProperty('custoMedio');
    expect(outro.estoqueAtual).toBe(1);
    expect(outro.precoVenda).toBe(15);
    expect(await produtos.garantirCodigosInternos(padraoId)).toBe(0);
    const gravado = await operacional.produto.findFirstOrThrow({ where: { id: outro.id } });
    expect(gravado.codigoInterno).toBeNull();

    const segunda = await produtos.criar(ecolumeId, { nome: `Outra ${sufixo}`, precoVenda: 3 });
    expect(segunda.codigoInterno).toBe('CI-000005');
    const daPadrao = await operacional.produto.findMany({ where: { empresaId: padraoId, codigoInterno: 'CI-000001' } });
    expect(daPadrao).toHaveLength(0);
  });

  it('esconde custo, IPI e margem de quem não tem a permissão', async () => {
    const produto = await operacional.produto.findFirstOrThrow({ where: { empresaId: ecolumeId, codigoInterno: 'CI-000001' } });
    await operacional.produto.update({
      where: { id: produto.id },
      data: { custoMedio: 7, ultimoPreco: 6, ipi: 1, margem: 20 },
    });
    const bruto = await produtos.obter(ecolumeId, produto.id);
    const semPermissao = await permissoes.filtrar(
      { id: usuarioId, empresaId: ecolumeId, perfil: PerfilUsuario.VENDEDOR },
      bruto,
    );
    expect(semPermissao).not.toHaveProperty('custoMedio');
    expect(semPermissao).not.toHaveProperty('ultimoPreco');
    expect(semPermissao).not.toHaveProperty('ipi');
    expect(semPermissao).not.toHaveProperty('margem');
    expect(semPermissao.precoVenda).toBe(20);
    expect(semPermissao.codigoInterno).toBe('CI-000001');

    await permissoes.conceder(ecolumeId, usuarioId, [PermissaoComercial.VER_CUSTOS], usuarioId);
    const comPermissao = await permissoes.filtrar(
      { id: usuarioId, empresaId: ecolumeId, perfil: PerfilUsuario.VENDEDOR },
      await produtos.obter(ecolumeId, produto.id),
    );
    expect(comPermissao.custoMedio).toBe(7);
    expect(comPermissao.precoVenda).toBe(20);
    const saldo = await operacional.produto.findFirstOrThrow({ where: { id: produto.id } });
    expect(saldo.estoqueAtual).toBe(2);
  });

  it('entrada e ajuste continuam só no saldo', async () => {
    const produto = await operacional.produto.findFirstOrThrow({ where: { empresaId: ecolumeId, codigoInterno: 'CI-000001' } });
    const movimentosAntes = await operacional.movimentacaoEstoque.count({ where: { produtoId: produto.id } });
    const atualizado = await produtos.entrada(ecolumeId, produto.id, { quantidade: 1 }, usuarioId);
    expect(atualizado.estoqueAtual).toBe(3);
    expect(atualizado.custoMedio).toBe(7);
    const ajustado = await produtos.ajuste(
      ecolumeId,
      produto.id,
      {
        saldoContado: 3,
        saldoAnteriorEsperado: 3,
        motivo: MotivoAjusteEstoque.INVENTARIO,
        observacao: 'conferencia',
      },
      { id: usuarioId, perfil: PerfilUsuario.PROPRIETARIO },
    );
    expect(ajustado.estoqueAtual).toBe(3);
    expect(await operacional.movimentacaoEstoque.count({ where: { produtoId: produto.id } })).toBe(movimentosAntes + 1);
    const spot = await operacional.produto.findFirstOrThrow({ where: { sku: 'SPOT-01' } });
    expect(spot.estoqueAtual).toBe(40);
    expect(spot.precoVenda).toBe(89.9);
  });
});
