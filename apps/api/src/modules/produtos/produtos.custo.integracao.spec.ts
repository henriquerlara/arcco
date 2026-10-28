import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PerfilUsuario, TipoMovimentacaoEstoque } from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { apresentarCusto } from './custo-medio';
import { ProdutosService } from './produtos.service';

const ATIVO = process.env.ECOL_PRODUTO === '1';
const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('ECOL-05 no banco', () => {
  const auditoria = new AuditoriaService(platform as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const produtos = new ProdutosService(operacional as never, auditoria, permissoes);

  let ecolumeId = '';
  let outraId = '';
  let padraoId = '';
  let usuarioId = '';
  let tabelaId = '';
  let historicoId = '';
  let precoVendaFixo = 99.5;

  beforeAll(async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `CUST05 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const outra = await platform.empresa.create({
      data: {
        nome: `CUST05B ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `CUST05P ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { onboardingConcluido: true },
      },
    });
    empresas.push(ecolume.id, outra.id, padrao.id);
    ecolumeId = ecolume.id;
    outraId = outra.id;
    padraoId = padrao.id;

    const usuario = await platform.usuario.create({
      data: {
        empresaId: ecolumeId,
        nome: 'custo',
        email: `ecol05.${sufixo}@teste.arcco.local`,
        senhaHash: 'nao-e-segredo-de-login',
        perfil: PerfilUsuario.VENDEDOR,
      },
    });
    usuarioId = usuario.id;

    const tabela = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Tabela 7.7.2',
        sku: `C77-${sufixo}`,
        precoVenda: precoVendaFixo,
        estoqueAtual: 0,
        custoMedio: null,
        ultimoPreco: null,
      },
    });
    tabelaId = tabela.id;

    const historico = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Histórico sem custo',
        sku: `CHST-${sufixo}`,
        precoVenda: 40,
        estoqueAtual: 8,
        custoMedio: null,
        ultimoPreco: null,
      },
    });
    historicoId = historico.id;
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

  it('primeira entrada com custo define média e último preço', async () => {
    const atualizado = await produtos.entrada(
      ecolumeId,
      tabelaId,
      { quantidade: 10, precoUnitarioCusto: 100 },
      usuarioId,
    );
    expect(atualizado.estoqueAtual).toBe(10);
    expect(atualizado.custoMedio).toBe(100);
    expect(atualizado.ultimoPreco).toBe(100);
    expect(atualizado.precoVenda).toBe(precoVendaFixo);
    const movimento = await operacional.movimentacaoEstoque.findFirstOrThrow({
      where: { produtoId: tabelaId },
      orderBy: { criadoEm: 'desc' },
    });
    expect(Number(movimento.precoUnitarioCusto)).toBe(100);
  });

  it('segunda entrada aplica a média ponderada com quatro casas', async () => {
    const atualizado = await produtos.entrada(
      ecolumeId,
      tabelaId,
      { quantidade: 20, precoUnitarioCusto: 120 },
      usuarioId,
    );
    expect(atualizado.estoqueAtual).toBe(30);
    expect(atualizado.custoMedio).toBe(113.3333);
    expect(apresentarCusto(atualizado.custoMedio!)).toBe(113.33);
    expect(atualizado.ultimoPreco).toBe(120);
    expect(atualizado.precoVenda).toBe(precoVendaFixo);
  });

  it('baixa preserva custo médio e último preço', async () => {
    const produto = await operacional.produto.findFirstOrThrow({ where: { id: tabelaId } });
    expect(produto.estoqueAtual).toBe(30);
    expect(Number(produto.custoMedio)).toBe(113.3333);
    expect(Number(produto.ultimoPreco)).toBe(120);

    await operacional.$transaction(async (tx) => {
      const atual = await tx.produto.findFirstOrThrow({ where: { id: tabelaId } });
      const quantidade = 30;
      const saldoApos = atual.estoqueAtual - quantidade;
      await tx.produto.update({
        where: { id: tabelaId },
        data: { estoqueAtual: saldoApos },
      });
      await tx.movimentacaoEstoque.create({
        data: {
          empresaId: ecolumeId,
          produtoId: tabelaId,
          tipo: TipoMovimentacaoEstoque.BAIXA,
          quantidade,
          saldoApos,
        },
      });
    });

    const depois = await operacional.produto.findFirstOrThrow({ where: { id: tabelaId } });
    expect(depois.estoqueAtual).toBe(0);
    expect(Number(depois.custoMedio)).toBe(113.3333);
    expect(Number(depois.ultimoPreco)).toBe(120);
    expect(depois.precoVenda).toBe(precoVendaFixo);
  });

  it('entrada com saldo zero reinicia a média pelo preço novo', async () => {
    const atualizado = await produtos.entrada(
      ecolumeId,
      tabelaId,
      { quantidade: 5, precoUnitarioCusto: 125 },
      usuarioId,
    );
    expect(atualizado.estoqueAtual).toBe(5);
    expect(atualizado.custoMedio).toBe(125);
    expect(atualizado.ultimoPreco).toBe(125);
    expect(atualizado.precoVenda).toBe(precoVendaFixo);
  });

  it('entrada com saldo negativo usa o preço da entrada', async () => {
    const negativo = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Negativo',
        sku: `CNEG-${sufixo}`,
        precoVenda: 10,
        estoqueAtual: -2,
        custoMedio: 80,
        ultimoPreco: 80,
      },
    });
    const atualizado = await produtos.entrada(
      ecolumeId,
      negativo.id,
      { quantidade: 5, precoUnitarioCusto: 90 },
      usuarioId,
    );
    expect(atualizado.estoqueAtual).toBe(3);
    expect(atualizado.custoMedio).toBe(90);
    expect(atualizado.ultimoPreco).toBe(90);
    expect(atualizado.precoVenda).toBe(10);
  });

  it('saldo positivo com média nula exige custo de referência', async () => {
    const antes = await operacional.produto.findFirstOrThrow({ where: { id: historicoId } });
    expect(antes.estoqueAtual).toBe(8);
    expect(antes.custoMedio).toBeNull();
    const movimentosAntes = await operacional.movimentacaoEstoque.count({
      where: { produtoId: historicoId },
    });

    await expect(
      produtos.entrada(ecolumeId, historicoId, { quantidade: 10, precoUnitarioCusto: 120 }, usuarioId),
    ).rejects.toMatchObject({ codigo: 'CUSTO_REFERENCIA_OBRIGATORIO' });

    const depoisErro = await operacional.produto.findFirstOrThrow({ where: { id: historicoId } });
    expect(depoisErro.estoqueAtual).toBe(8);
    expect(depoisErro.custoMedio).toBeNull();
    expect(depoisErro.precoVenda).toBe(40);
    expect(await operacional.movimentacaoEstoque.count({ where: { produtoId: historicoId } })).toBe(
      movimentosAntes,
    );
  });

  it('saldo positivo com média nula pondera o custo de referência informado', async () => {
    const atualizado = await produtos.entrada(
      ecolumeId,
      historicoId,
      { quantidade: 10, precoUnitarioCusto: 120, custoReferenciaSaldo: 100 },
      usuarioId,
    );
    // (8*100 + 10*120) / 18 = 111.1111
    expect(atualizado.estoqueAtual).toBe(18);
    expect(atualizado.custoMedio).toBe(111.1111);
    expect(atualizado.ultimoPreco).toBe(120);
    expect(atualizado.precoVenda).toBe(40);
    const texto = await operacional.$queryRaw<{ custoMedio: string }[]>`
      SELECT "custoMedio"::text AS "custoMedio" FROM produtos WHERE id = ${historicoId}
    `;
    expect(texto[0]?.custoMedio).toBe('111.1111');
  });

  it('concorrência com média nula usa a referência e não perde saldo', async () => {
    const produto = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Ref concorrente',
        sku: `CREF-${sufixo}`,
        precoVenda: 9,
        estoqueAtual: 40,
        custoMedio: null,
        ultimoPreco: null,
      },
    });
    await Promise.all([
      produtos.entrada(
        ecolumeId,
        produto.id,
        { quantidade: 10, precoUnitarioCusto: 120, custoReferenciaSaldo: 100 },
        usuarioId,
      ),
      produtos.entrada(
        ecolumeId,
        produto.id,
        { quantidade: 5, precoUnitarioCusto: 130, custoReferenciaSaldo: 100 },
        usuarioId,
      ),
    ]);

    const final = await operacional.produto.findFirstOrThrow({ where: { id: produto.id } });
    const movimentos = await operacional.movimentacaoEstoque.findMany({
      where: { produtoId: produto.id },
      orderBy: [{ saldoApos: 'asc' }, { id: 'asc' }],
    });
    expect(final.estoqueAtual).toBe(55);
    expect(final.precoVenda).toBe(9);
    expect(movimentos).toHaveLength(2);

    let saldo = 40;
    let media: number | null = null;
    let ultimo = 0;
    for (const movimento of movimentos) {
      const preco = Number(movimento.precoUnitarioCusto);
      if (media == null) {
        media = Number((((saldo * 100) + (movimento.quantidade * preco)) / (saldo + movimento.quantidade)).toFixed(4));
      } else {
        media = Number((((saldo * media) + (movimento.quantidade * preco)) / (saldo + movimento.quantidade)).toFixed(4));
      }
      saldo += movimento.quantidade;
      ultimo = preco;
    }
    expect(Number(final.custoMedio)).toBe(media);
    expect(Number(final.ultimoPreco)).toBe(ultimo);
    expect(saldo).toBe(55);
  });

  it('entrada sem custo não altera média nem último preço', async () => {
    const antes = await operacional.produto.findFirstOrThrow({ where: { id: tabelaId } });
    const atualizado = await produtos.entrada(ecolumeId, tabelaId, { quantidade: 1 }, usuarioId);
    expect(atualizado.estoqueAtual).toBe(antes.estoqueAtual + 1);
    expect(atualizado.custoMedio).toBe(Number(antes.custoMedio));
    expect(atualizado.ultimoPreco).toBe(Number(antes.ultimoPreco));
    const movimento = await operacional.movimentacaoEstoque.findFirstOrThrow({
      where: { produtoId: tabelaId, quantidade: 1 },
      orderBy: { criadoEm: 'desc' },
    });
    expect(movimento.precoUnitarioCusto).toBeNull();
  });

  it('persiste 113,3333 em DECIMAL(18,4) e sobrevive a recálculo sucessivo', async () => {
    const produto = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Precisao',
        sku: `CPREC-${sufixo}`,
        precoVenda: 50,
        estoqueAtual: 0,
      },
    });
    await produtos.entrada(ecolumeId, produto.id, { quantidade: 10, precoUnitarioCusto: 100 }, usuarioId);
    await produtos.entrada(ecolumeId, produto.id, { quantidade: 20, precoUnitarioCusto: 120 }, usuarioId);

    const texto = await operacional.$queryRaw<
      { custoMedio: string; ultimoPreco: string; precoUnitarioCusto: string }[]
    >`
      SELECT p."custoMedio"::text AS "custoMedio",
             p."ultimoPreco"::text AS "ultimoPreco",
             m."precoUnitarioCusto"::text AS "precoUnitarioCusto"
      FROM produtos p
      JOIN movimentacoes_estoque m ON m."produtoId" = p.id
      WHERE p.id = ${produto.id}
        AND m.quantidade = 20
    `;
    expect(texto[0]).toEqual({
      custoMedio: '113.3333',
      ultimoPreco: '120.0000',
      precoUnitarioCusto: '120.0000',
    });

    const tipos = await operacional.$queryRaw<{ data_type: string; numeric_scale: number }[]>`
      SELECT data_type, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'produtos' AND column_name = 'custoMedio'
    `;
    expect(tipos[0]?.data_type).toBe('numeric');
    expect(Number(tipos[0]?.numeric_scale)).toBe(4);

    await produtos.entrada(ecolumeId, produto.id, { quantidade: 30, precoUnitarioCusto: 113.3333 }, usuarioId);
    const depois = await operacional.$queryRaw<{ custoMedio: string }[]>`
      SELECT "custoMedio"::text AS "custoMedio" FROM produtos WHERE id = ${produto.id}
    `;
    expect(depois[0]?.custoMedio).toBe('113.3333');
    const venda = await operacional.produto.findFirstOrThrow({ where: { id: produto.id } });
    expect(venda.precoVenda).toBe(50);
    expect(venda.estoqueAtual).toBe(60);
  });

  it('duas entradas concorrentes reais não perdem saldo, custo nem movimento', async () => {
    const produto = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Concorrencia',
        sku: `CCON-${sufixo}`,
        precoVenda: 1,
        estoqueAtual: 0,
      },
    });
    const outra = await operacional.produto.create({
      data: {
        empresaId: outraId,
        nome: 'Isolada',
        sku: `CISO-${sufixo}`,
        precoVenda: 1,
        estoqueAtual: 0,
      },
    });

    const inicio = Date.now();
    const [r1, r2, rOutra] = await Promise.all([
      produtos.entrada(ecolumeId, produto.id, { quantidade: 4, precoUnitarioCusto: 10 }, usuarioId),
      produtos.entrada(ecolumeId, produto.id, { quantidade: 6, precoUnitarioCusto: 20 }, usuarioId),
      produtos.entrada(outraId, outra.id, { quantidade: 8, precoUnitarioCusto: 33 }),
    ]);
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(0);

    const final = await operacional.produto.findFirstOrThrow({ where: { id: produto.id } });
    const movimentos = await operacional.movimentacaoEstoque.findMany({
      where: { produtoId: produto.id },
      orderBy: [{ saldoApos: 'asc' }, { id: 'asc' }],
    });
    expect(movimentos).toHaveLength(2);
    expect(final.estoqueAtual).toBe(10);

    const primeiro = movimentos[0]!;
    const segundo = movimentos[1]!;
    expect(segundo.saldoApos).toBe(10);
    expect(primeiro.quantidade + segundo.quantidade).toBe(10);
    const preco1 = Number(primeiro.precoUnitarioCusto);
    const preco2 = Number(segundo.precoUnitarioCusto);
    const mediaEsperada = Number(
      (
        (primeiro.quantidade * preco1 + segundo.quantidade * preco2) /
        (primeiro.quantidade + segundo.quantidade)
      ).toFixed(4),
    );
    expect(Number(final.custoMedio)).toBe(mediaEsperada);
    expect(Number(final.ultimoPreco)).toBe(preco2);
    expect(new Set([preco1, preco2])).toEqual(new Set([10, 20]));
    expect([r1.estoqueAtual, r2.estoqueAtual].sort((x, y) => x - y)).toEqual(
      [primeiro.saldoApos, segundo.saldoApos].sort((x, y) => x - y),
    );

    const texto = await operacional.$queryRaw<{ custoMedio: string }[]>`
      SELECT "custoMedio"::text AS "custoMedio" FROM produtos WHERE id = ${produto.id}
    `;
    expect(texto[0]?.custoMedio).toBe(mediaEsperada.toFixed(4));

    const isolada = await operacional.produto.findFirstOrThrow({ where: { id: outra.id } });
    expect(isolada.estoqueAtual).toBe(8);
    expect(Number(isolada.custoMedio)).toBe(33);
    expect(rOutra.estoqueAtual).toBe(8);
    expect(await operacional.movimentacaoEstoque.count({ where: { produtoId: outra.id } })).toBe(1);
  });

  it('empresa sem flag ignora custo e não grava média', async () => {
    const criado = await produtos.criar(padraoId, {
      nome: 'Legado',
      precoVenda: 15,
      saldoInicial: 0,
    });
    const atualizado = await produtos.entrada(padraoId, criado.id, {
      quantidade: 3,
      precoUnitarioCusto: 40,
    });
    expect(atualizado).not.toHaveProperty('custoMedio');
    expect(atualizado).not.toHaveProperty('ultimoPreco');
    expect(atualizado.estoqueAtual).toBe(3);
    expect(atualizado.precoVenda).toBe(15);
    const banco = await operacional.produto.findFirstOrThrow({ where: { id: criado.id } });
    expect(banco.custoMedio).toBeNull();
    expect(banco.ultimoPreco).toBeNull();
    const movimento = await operacional.movimentacaoEstoque.findFirstOrThrow({
      where: { produtoId: criado.id },
    });
    expect(movimento.precoUnitarioCusto).toBeNull();
  });

  it('isola custo entre duas empresas ECOLUME', async () => {
    const a = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Iso A',
        sku: `CIA-${sufixo}`,
        precoVenda: 2,
        estoqueAtual: 0,
      },
    });
    const b = await operacional.produto.create({
      data: {
        empresaId: outraId,
        nome: 'Iso B',
        sku: `CIB-${sufixo}`,
        precoVenda: 2,
        estoqueAtual: 0,
      },
    });
    await produtos.entrada(ecolumeId, a.id, { quantidade: 2, precoUnitarioCusto: 11 }, usuarioId);
    await produtos.entrada(outraId, b.id, { quantidade: 2, precoUnitarioCusto: 77 });
    const daA = await operacional.produto.findFirstOrThrow({ where: { id: a.id } });
    const daB = await operacional.produto.findFirstOrThrow({ where: { id: b.id } });
    expect(Number(daA.custoMedio)).toBe(11);
    expect(Number(daB.custoMedio)).toBe(77);
    await expect(produtos.entrada(ecolumeId, b.id, { quantidade: 1, precoUnitarioCusto: 1 })).rejects.toMatchObject({
      codigo: 'PRODUTO_NAO_ENCONTRADO',
    });
  });

  it('oculta custo sem VER_CUSTOS e registra auditoria na mesma operação', async () => {
    const produto = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Permissao',
        sku: `CPER-${sufixo}`,
        precoVenda: 30,
        estoqueAtual: 0,
      },
    });
    const logsAntes = await operacional.logAuditoria.count({ where: { empresaId: ecolumeId } });
    const atualizado = await produtos.entrada(
      ecolumeId,
      produto.id,
      { quantidade: 2, precoUnitarioCusto: 18 },
      usuarioId,
    );
    expect(atualizado.custoMedio).toBe(18);
    const oculto = await permissoes.filtrar(
      { id: usuarioId, empresaId: ecolumeId, perfil: PerfilUsuario.VENDEDOR },
      atualizado,
    );
    expect(oculto).not.toHaveProperty('custoMedio');
    expect(oculto).not.toHaveProperty('ultimoPreco');
    expect(oculto.precoVenda).toBe(30);
    expect(oculto.estoqueAtual).toBe(2);
    const logsDepois = await operacional.logAuditoria.findMany({
      where: { empresaId: ecolumeId, entidadeId: produto.id },
      orderBy: { criadoEm: 'desc' },
      take: 1,
    });
    expect(logsDepois).toHaveLength(1);
    expect(logsDepois[0]?.tipo).toBe('ENTRADA_ESTOQUE');
    expect(JSON.stringify(logsDepois[0]?.posterior)).toContain('18');
    expect(await operacional.logAuditoria.count({ where: { empresaId: ecolumeId } })).toBe(logsAntes + 1);
  });

  it('reconciliação continua somente leitura após as entradas com custo', async () => {
    const antes = await operacional.produto.findMany({
      where: { empresaId: ecolumeId },
      orderBy: { id: 'asc' },
    });
    const movimentosAntes = await operacional.movimentacaoEstoque.findMany({
      where: { empresaId: ecolumeId },
      orderBy: { id: 'asc' },
    });
    const primeira = await produtos.reconciliar(ecolumeId);
    const segunda = await produtos.reconciliar(ecolumeId);
    expect(segunda).toEqual(primeira);
    expect(primeira.itens.find((item) => item.produtoId === tabelaId)).toMatchObject({
      consistente: true,
      diferenca: 0,
    });
    expect(await operacional.produto.findMany({ where: { empresaId: ecolumeId }, orderBy: { id: 'asc' } })).toEqual(
      antes,
    );
    expect(
      await operacional.movimentacaoEstoque.findMany({ where: { empresaId: ecolumeId }, orderBy: { id: 'asc' } }),
    ).toEqual(movimentosAntes);
  });
});
