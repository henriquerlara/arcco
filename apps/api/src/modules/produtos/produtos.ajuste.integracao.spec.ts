import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { MotivoAjusteEstoque, PerfilUsuario, PermissaoComercial } from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ProdutosService } from './produtos.service';

const ATIVO = process.env.ECOL_PRODUTO === '1';
const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('ECOL-06 no banco', () => {
  const auditoria = new AuditoriaService(platform as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const produtos = new ProdutosService(operacional as never, auditoria, permissoes);

  let ecolumeId = '';
  let outraId = '';
  let padraoId = '';
  let donoId = '';
  let vendedorId = '';

  beforeAll(async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `AJ06 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const outra = await platform.empresa.create({
      data: {
        nome: `AJ06B ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `AJ06P ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { onboardingConcluido: true },
      },
    });
    empresas.push(ecolume.id, outra.id, padrao.id);
    ecolumeId = ecolume.id;
    outraId = outra.id;
    padraoId = padrao.id;

    const dono = await platform.usuario.create({
      data: {
        empresaId: ecolumeId,
        nome: 'dono',
        email: `aj06.dono.${sufixo}@teste.arcco.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    const vendedor = await platform.usuario.create({
      data: {
        empresaId: ecolumeId,
        nome: 'vend',
        email: `aj06.vend.${sufixo}@teste.arcco.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.VENDEDOR,
      },
    });
    donoId = dono.id;
    vendedorId = vendedor.id;
  });

  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.logAuditoria.deleteMany({ where: { empresaId } });
      await operacional.movimentacaoEstoque.deleteMany({ where: { empresaId } });
      await operacional.produto.deleteMany({ where: { empresaId } });
      await platform.logAuditoria.deleteMany({ where: { empresaId } });
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  });

  const ator = () => ({ id: donoId, perfil: PerfilUsuario.PROPRIETARIO });

  it('ajuste positivo e negativo por saldo final e por diferença', async () => {
    const p = await operacional.produto.create({
      data: { empresaId: ecolumeId, nome: 'A', sku: `A1-${sufixo}`, precoVenda: 10, estoqueAtual: 10 },
    });
    const up = await produtos.ajuste(
      ecolumeId,
      p.id,
      {
        saldoContado: 15,
        saldoAnteriorEsperado: 10,
        motivo: MotivoAjusteEstoque.INVENTARIO,
        observacao: 'subiu',
      },
      ator(),
    );
    expect(up.estoqueAtual).toBe(15);
    const down = await produtos.ajuste(
      ecolumeId,
      p.id,
      { diferenca: -4, motivo: MotivoAjusteEstoque.PERDA },
      ator(),
    );
    expect(down.estoqueAtual).toBe(11);
    const movs = await operacional.movimentacaoEstoque.findMany({
      where: { produtoId: p.id },
      orderBy: { criadoEm: 'asc' },
    });
    expect(movs.map((m) => m.quantidade)).toEqual([5, -4]);
    expect(movs.map((m) => m.motivo)).toEqual([MotivoAjusteEstoque.INVENTARIO, MotivoAjusteEstoque.PERDA]);
  });

  it('estoque inicial com custo e motivos obrigatórios', async () => {
    const p = await operacional.produto.create({
      data: { empresaId: ecolumeId, nome: 'Ini', sku: `INI-${sufixo}`, precoVenda: 8, estoqueAtual: 0 },
    });
    await expect(
      produtos.ajuste(ecolumeId, p.id, { diferenca: 5, observacao: 'sem motivo' }, ator()),
    ).rejects.toMatchObject({ codigo: 'MOTIVO_OBRIGATORIO' });

    const ok = await produtos.ajuste(
      ecolumeId,
      p.id,
      {
        diferenca: 5,
        motivo: MotivoAjusteEstoque.ESTOQUE_INICIAL,
        precoUnitarioCusto: 12,
      },
      ator(),
    );
    expect(ok.estoqueAtual).toBe(5);
    expect(ok.custoMedio).toBe(12);
    expect(ok.ultimoPreco).toBe(12);
    expect(ok.precoVenda).toBe(8);
  });

  it('ajuste negativo preserva custos; positivo sem custo também', async () => {
    const p = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'C',
        sku: `C-${sufixo}`,
        precoVenda: 20,
        estoqueAtual: 10,
        custoMedio: 7,
        ultimoPreco: 7,
      },
    });
    const semCusto = await produtos.ajuste(
      ecolumeId,
      p.id,
      { diferenca: 2, motivo: MotivoAjusteEstoque.DEVOLUCAO },
      ator(),
    );
    expect(semCusto.estoqueAtual).toBe(12);
    expect(semCusto.custoMedio).toBe(7);
    const neg = await produtos.ajuste(
      ecolumeId,
      p.id,
      { diferenca: -3, motivo: MotivoAjusteEstoque.AVARIA },
      ator(),
    );
    expect(neg.estoqueAtual).toBe(9);
    expect(neg.custoMedio).toBe(7);
    expect(neg.ultimoPreco).toBe(7);
  });

  it('saldo positivo com média nula exige referência no ajuste com custo', async () => {
    const p = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Ref',
        sku: `R-${sufixo}`,
        precoVenda: 5,
        estoqueAtual: 40,
        custoMedio: null,
      },
    });
    await expect(
      produtos.ajuste(
        ecolumeId,
        p.id,
        { diferenca: 10, motivo: MotivoAjusteEstoque.INVENTARIO, precoUnitarioCusto: 120 },
        ator(),
      ),
    ).rejects.toMatchObject({ codigo: 'CUSTO_REFERENCIA_OBRIGATORIO' });
    const intacto = await operacional.produto.findFirstOrThrow({ where: { id: p.id } });
    expect(intacto.estoqueAtual).toBe(40);
    expect(intacto.custoMedio).toBeNull();

    const ok = await produtos.ajuste(
      ecolumeId,
      p.id,
      {
        diferenca: 10,
        motivo: MotivoAjusteEstoque.INVENTARIO,
        precoUnitarioCusto: 120,
        custoReferenciaSaldo: 100,
      },
      ator(),
    );
    expect(ok.estoqueAtual).toBe(50);
    expect(ok.custoMedio).toBe(104);
  });

  it('delta zero não gera movimentação; saldo desatualizado falha', async () => {
    const p = await operacional.produto.create({
      data: { empresaId: ecolumeId, nome: 'Z', sku: `Z-${sufixo}`, precoVenda: 1, estoqueAtual: 4 },
    });
    const antes = await operacional.movimentacaoEstoque.count({ where: { produtoId: p.id } });
    await produtos.ajuste(
      ecolumeId,
      p.id,
      { saldoContado: 4, saldoAnteriorEsperado: 4, motivo: MotivoAjusteEstoque.INVENTARIO },
      ator(),
    );
    expect(await operacional.movimentacaoEstoque.count({ where: { produtoId: p.id } })).toBe(antes);

    await expect(
      produtos.ajuste(
        ecolumeId,
        p.id,
        { saldoContado: 8, saldoAnteriorEsperado: 3, motivo: MotivoAjusteEstoque.INVENTARIO },
        ator(),
      ),
    ).rejects.toMatchObject({ codigo: 'SALDO_DESATUALIZADO' });
  });

  it('auditoria e permissão AJUSTAR_ESTOQUE', async () => {
    const p = await operacional.produto.create({
      data: { empresaId: ecolumeId, nome: 'P', sku: `P-${sufixo}`, precoVenda: 2, estoqueAtual: 1 },
    });
    await expect(
      produtos.ajuste(
        ecolumeId,
        p.id,
        { diferenca: 1, motivo: MotivoAjusteEstoque.OUTRO },
        { id: vendedorId, perfil: PerfilUsuario.VENDEDOR },
      ),
    ).rejects.toMatchObject({ codigo: 'SEM_PERMISSAO' });

    await permissoes.conceder(ecolumeId, vendedorId, [PermissaoComercial.AJUSTAR_ESTOQUE], donoId);
    const logsAntes = await operacional.logAuditoria.count({ where: { empresaId: ecolumeId } });
    await produtos.ajuste(
      ecolumeId,
      p.id,
      { diferenca: 1, motivo: MotivoAjusteEstoque.OUTRO, observacao: 'ok' },
      { id: vendedorId, perfil: PerfilUsuario.VENDEDOR },
    );
    const logs = await operacional.logAuditoria.findMany({
      where: { empresaId: ecolumeId, entidadeId: p.id, tipo: 'AJUSTE_ESTOQUE' },
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs.at(-1)?.usuarioId).toBe(vendedorId);
    expect(JSON.stringify(logs.at(-1)?.posterior)).toContain(MotivoAjusteEstoque.OUTRO);
    expect(await operacional.logAuditoria.count({ where: { empresaId: ecolumeId } })).toBeGreaterThan(
      logsAntes,
    );
  });

  it('concorrência real e isolamento multiempresa', async () => {
    const a = await operacional.produto.create({
      data: { empresaId: ecolumeId, nome: 'Conc', sku: `CC-${sufixo}`, precoVenda: 1, estoqueAtual: 10 },
    });
    const b = await operacional.produto.create({
      data: { empresaId: outraId, nome: 'Outra', sku: `CO-${sufixo}`, precoVenda: 1, estoqueAtual: 10 },
    });
    await Promise.all([
      produtos.ajuste(ecolumeId, a.id, { diferenca: 3, motivo: MotivoAjusteEstoque.INVENTARIO }, ator()),
      produtos.ajuste(ecolumeId, a.id, { diferenca: 2, motivo: MotivoAjusteEstoque.INVENTARIO }, ator()),
      produtos.ajuste(
        outraId,
        b.id,
        { diferenca: 7, motivo: MotivoAjusteEstoque.INVENTARIO },
        { id: donoId, perfil: PerfilUsuario.PROPRIETARIO },
      ),
    ]);
    expect((await operacional.produto.findFirstOrThrow({ where: { id: a.id } })).estoqueAtual).toBe(15);
    expect((await operacional.produto.findFirstOrThrow({ where: { id: b.id } })).estoqueAtual).toBe(17);
    await expect(
      produtos.ajuste(ecolumeId, b.id, { diferenca: 1, motivo: MotivoAjusteEstoque.OUTRO }, ator()),
    ).rejects.toMatchObject({ codigo: 'PRODUTO_NAO_ENCONTRADO' });
  });

  it('empresa sem flag mantém legado e reconciliação após ajuste', async () => {
    const p = await operacional.produto.create({
      data: { empresaId: padraoId, nome: 'Leg', sku: `L-${sufixo}`, precoVenda: 3, estoqueAtual: 2 },
    });
    const legado = await produtos.ajuste(padraoId, p.id, {
      saldoContado: 5,
      observacao: 'contagem',
    });
    expect(legado.estoqueAtual).toBe(5);
    expect(legado).not.toHaveProperty('custoMedio');
    const mov = await operacional.movimentacaoEstoque.findFirstOrThrow({ where: { produtoId: p.id } });
    expect(mov.motivo).toBeNull();
    expect(mov.quantidade).toBe(3);

    const eco = await operacional.produto.create({
      data: { empresaId: ecolumeId, nome: 'Rec', sku: `RC-${sufixo}`, precoVenda: 1, estoqueAtual: 0 },
    });
    await produtos.ajuste(
      ecolumeId,
      eco.id,
      { diferenca: 6, motivo: MotivoAjusteEstoque.ESTOQUE_INICIAL },
      ator(),
    );
    const rel = await produtos.reconciliar(ecolumeId);
    expect(rel.itens.find((i) => i.produtoId === eco.id)).toMatchObject({
      consistente: true,
      diferenca: 0,
      estoqueAtual: 6,
      saldoMovimentacoes: 6,
    });
  });
});
