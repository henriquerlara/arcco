import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient, type MovimentacaoEstoque, type Produto } from '@prisma/client';
import { PerfilUsuario, TipoMovimentacaoEstoque } from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { efeitoNoSaldo, ProdutosService } from './produtos.service';

/** Banco local, empresas descartáveis. Não grava na empresa de demonstração. */
const ATIVO = process.env.ECOL_PRODUTO === '1';
const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('ECOL-04b no banco', () => {
  const auditoria = new AuditoriaService(platform as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const produtos = new ProdutosService(operacional as never, auditoria, permissoes);

  let ecolumeId = '';
  let outraId = '';
  let padraoId = '';
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `REC04 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const outra = await platform.empresa.create({
      data: {
        nome: `REC04B ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `REC04P ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { onboardingConcluido: true },
      },
    });
    empresas.push(ecolume.id, outra.id, padrao.id);
    ecolumeId = ecolume.id;
    outraId = outra.id;
    padraoId = padrao.id;

    ids.positivo = await gravar(ecolumeId, {
      nome: 'Consistente',
      sku: `REC-40-${sufixo}`,
      codigoInterno: 'CI-000040',
      estoqueAtual: 40,
      precoVenda: 10,
      custoMedio: 4,
      ultimoPreco: 3,
      margem: 20,
      ipi: 1,
      criadoEm: new Date('2026-02-01T00:00:01.000Z'),
    }, [{ tipo: 'ENTRADA', quantidade: 40, saldoApos: 40 }]);

    ids.divergente = await gravar(ecolumeId, {
      nome: 'Divergente',
      sku: `REC-DIV-${sufixo}`,
      estoqueAtual: 40,
      precoVenda: 11,
      criadoEm: new Date('2026-02-01T00:00:02.000Z'),
    }, [{ tipo: 'ENTRADA', quantidade: 35, saldoApos: 35 }]);

    ids.zero = await gravar(ecolumeId, {
      nome: 'Zero',
      sku: `REC-0-${sufixo}`,
      estoqueAtual: 0,
      precoVenda: 1,
      criadoEm: new Date('2026-02-01T00:00:03.000Z'),
    }, []);

    ids.negativo = await gravar(ecolumeId, {
      nome: 'Negativo consistente',
      sku: `REC-NEG-${sufixo}`,
      estoqueAtual: -2,
      precoVenda: 2,
      criadoEm: new Date('2026-02-01T00:00:04.000Z'),
    }, [{ tipo: 'AJUSTE', quantidade: -2, saldoApos: -2 }]);

    ids.negativoDivergente = await gravar(ecolumeId, {
      nome: 'Negativo divergente',
      sku: `REC-NDIV-${sufixo}`,
      estoqueAtual: -2,
      precoVenda: 2,
      criadoEm: new Date('2026-02-01T00:00:05.000Z'),
    }, [{ tipo: 'AJUSTE', quantidade: -1, saldoApos: -1 }]);

    ids.semMovimento = await gravar(ecolumeId, {
      nome: 'Sem movimento',
      sku: `REC-SEM-${sufixo}`,
      estoqueAtual: 5,
      precoVenda: 6,
      criadoEm: new Date('2026-02-01T00:00:06.000Z'),
    }, []);

    ids.misto = await gravar(ecolumeId, {
      nome: 'Entrada baixa e ajuste',
      sku: `REC-MISTO-${sufixo}`,
      estoqueAtual: 9,
      precoVenda: 7,
      criadoEm: new Date('2026-02-01T00:00:07.000Z'),
    }, [
      { tipo: 'ENTRADA', quantidade: 10, saldoApos: 10 },
      { tipo: 'BAIXA', quantidade: 4, saldoApos: 6 },
      { tipo: 'AJUSTE', quantidade: 3, saldoApos: 9 },
    ]);

    ids.alheia = await gravar(outraId, {
      nome: 'Outra empresa',
      sku: `REC-B-${sufixo}`,
      estoqueAtual: 100,
      precoVenda: 8,
      criadoEm: new Date('2026-02-01T00:00:01.000Z'),
    }, [{ tipo: 'ENTRADA', quantidade: 100, saldoApos: 100 }]);

    ids.padrao = await gravar(padraoId, {
      nome: 'Sem flag',
      sku: `REC-P-${sufixo}`,
      estoqueAtual: 7,
      precoVenda: 15,
      criadoEm: new Date('2026-02-01T00:00:01.000Z'),
    }, [{ tipo: 'ENTRADA', quantidade: 1, saldoApos: 1 }]);
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

  it('marca saldo positivo igual à soma como consistente', async () => {
    const item = await itemDe(ecolumeId, ids.positivo);
    expect(item).toMatchObject({
      estoqueAtual: 40,
      saldoMovimentacoes: 40,
      diferenca: 0,
      consistente: true,
      codigoInterno: 'CI-000040',
    });
  });

  it('informa divergência positiva sem corrigir saldo nem movimento', async () => {
    const antes = await foto(ids.divergente);
    const item = await itemDe(ecolumeId, ids.divergente);
    expect(item).toMatchObject({
      estoqueAtual: 40,
      saldoMovimentacoes: 35,
      diferenca: 5,
      consistente: false,
    });
    expect(await foto(ids.divergente)).toEqual(antes);
  });

  it('trata saldo zero sem movimentação como consistente', async () => {
    const item = await itemDe(ecolumeId, ids.zero);
    expect(item).toMatchObject({
      estoqueAtual: 0,
      saldoMovimentacoes: 0,
      diferenca: 0,
      consistente: true,
    });
  });

  it('aceita saldo negativo quando a soma fecha', async () => {
    const item = await itemDe(ecolumeId, ids.negativo);
    expect(item).toMatchObject({
      estoqueAtual: -2,
      saldoMovimentacoes: -2,
      diferenca: 0,
      consistente: true,
    });
  });

  it('informa divergência negativa sem alterar o saldo', async () => {
    const antes = await foto(ids.negativoDivergente);
    const item = await itemDe(ecolumeId, ids.negativoDivergente);
    expect(item).toMatchObject({
      estoqueAtual: -2,
      saldoMovimentacoes: -1,
      diferenca: -1,
      consistente: false,
    });
    expect(await foto(ids.negativoDivergente)).toEqual(antes);
  });

  it('aponta produto com saldo e sem movimentação, sem inventar entrada', async () => {
    const item = await itemDe(ecolumeId, ids.semMovimento);
    expect(item).toMatchObject({
      estoqueAtual: 5,
      saldoMovimentacoes: 0,
      diferenca: 5,
      consistente: false,
    });
    expect(await operacional.movimentacaoEstoque.count({ where: { produtoId: ids.semMovimento } })).toBe(0);
  });

  it('soma entrada, baixa e ajuste com o sinal já usado pelo estoque', async () => {
    const item = await itemDe(ecolumeId, ids.misto);
    expect(item).toMatchObject({
      estoqueAtual: 9,
      saldoMovimentacoes: 9,
      diferenca: 0,
      consistente: true,
    });
    expect(efeitoNoSaldo(TipoMovimentacaoEstoque.ENTRADA, 10)).toBe(10);
    expect(efeitoNoSaldo(TipoMovimentacaoEstoque.BAIXA, 4)).toBe(-4);
    expect(efeitoNoSaldo(TipoMovimentacaoEstoque.AJUSTE, 3)).toBe(3);
  });

  it('não mistura movimentação de outra empresa', async () => {
    const daEmpresa = await produtos.reconciliar(ecolumeId);
    const daOutra = await produtos.reconciliar(outraId);
    expect(daEmpresa.itens.map((item) => item.produtoId)).not.toContain(ids.alheia);
    expect(daOutra.itens).toEqual([
      expect.objectContaining({
        produtoId: ids.alheia,
        estoqueAtual: 100,
        saldoMovimentacoes: 100,
        diferenca: 0,
        consistente: true,
      }),
    ]);
    const positivo = daEmpresa.itens.find((item) => item.produtoId === ids.positivo);
    expect(positivo?.saldoMovimentacoes).toBe(40);
  });

  it('não oferece a reconciliação para empresa sem a flag', async () => {
    const antes = await foto(ids.padrao);
    await expect(produtos.reconciliar(padraoId)).rejects.toMatchObject({
      codigo: 'RECONCILIACAO_INDISPONIVEL',
    });
    const listado = await produtos.listar(padraoId);
    expect(listado.find((item) => item.id === ids.padrao)).toMatchObject({
      estoqueAtual: 7,
      precoVenda: 15,
    });
    expect(JSON.stringify(listado)).not.toContain('saldoMovimentacoes');
    expect(await foto(ids.padrao)).toEqual(antes);
  });

  it('não grava produto, preço, custo, movimento nem auditoria', async () => {
    const antesProdutos = await operacional.produto.findMany({
      where: { empresaId: ecolumeId },
      orderBy: { id: 'asc' },
    });
    const antesMovimentos = await operacional.movimentacaoEstoque.findMany({
      where: { empresaId: ecolumeId },
      orderBy: { id: 'asc' },
    });
    const logsAntes = await operacional.logAuditoria.count({ where: { empresaId: ecolumeId } });
    const logsPlataformaAntes = await platform.logAuditoria.count({ where: { empresaId: ecolumeId } });

    const primeira = await produtos.reconciliar(ecolumeId);
    const segunda = await produtos.reconciliar(ecolumeId);

    expect(segunda).toEqual(primeira);
    expect(await operacional.produto.findMany({
      where: { empresaId: ecolumeId },
      orderBy: { id: 'asc' },
    })).toEqual(antesProdutos);
    expect(await operacional.movimentacaoEstoque.findMany({
      where: { empresaId: ecolumeId },
      orderBy: { id: 'asc' },
    })).toEqual(antesMovimentos);
    expect(await operacional.logAuditoria.count({ where: { empresaId: ecolumeId } })).toBe(logsAntes);
    expect(await platform.logAuditoria.count({ where: { empresaId: ecolumeId } })).toBe(logsPlataformaAntes);

    const publicado = await permissoes.filtrar(
      { id: randomUUID(), empresaId: ecolumeId, perfil: PerfilUsuario.VENDEDOR },
      primeira,
    );
    expect(JSON.stringify(publicado)).not.toContain('custoMedio');
    expect(JSON.stringify(publicado)).not.toContain('ultimoPreco');
    expect(JSON.stringify(publicado)).not.toContain('margem');
    expect(JSON.stringify(publicado)).not.toContain('precoUnitarioCusto');
    expect(publicado.itens.find((item) => item.produtoId === ids.positivo)?.estoqueAtual).toBe(40);
  });
});

async function gravar(
  empresaId: string,
  produto: {
    nome: string;
    sku: string;
    estoqueAtual: number;
    precoVenda: number;
    criadoEm: Date;
    codigoInterno?: string;
    custoMedio?: number;
    ultimoPreco?: number;
    margem?: number;
    ipi?: number;
  },
  movimentos: { tipo: 'ENTRADA' | 'BAIXA' | 'AJUSTE'; quantidade: number; saldoApos: number }[],
): Promise<string> {
  const criado = await operacional.produto.create({
    data: {
      empresaId,
      nome: produto.nome,
      sku: produto.sku,
      codigoInterno: produto.codigoInterno ?? null,
      estoqueAtual: produto.estoqueAtual,
      precoVenda: produto.precoVenda,
      custoMedio: produto.custoMedio ?? null,
      ultimoPreco: produto.ultimoPreco ?? null,
      margem: produto.margem ?? null,
      ipi: produto.ipi ?? null,
      criadoEm: produto.criadoEm,
    },
  });
  for (const movimento of movimentos) {
    await operacional.movimentacaoEstoque.create({
      data: {
        empresaId,
        produtoId: criado.id,
        tipo: movimento.tipo,
        quantidade: movimento.quantidade,
        saldoApos: movimento.saldoApos,
      },
    });
  }
  return criado.id;
}

async function itemDe(empresaId: string, produtoId: string) {
  const auditoria = new AuditoriaService(platform as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const produtos = new ProdutosService(operacional as never, auditoria, permissoes);
  const relatorio = await produtos.reconciliar(empresaId);
  const item = relatorio.itens.find((linha) => linha.produtoId === produtoId);
  expect(item).toBeDefined();
  return item!;
}

async function foto(produtoId: string) {
  const produto = await operacional.produto.findFirstOrThrow({ where: { id: produtoId } });
  const movimentos = await operacional.movimentacaoEstoque.findMany({
    where: { produtoId },
    orderBy: { id: 'asc' },
  });
  return {
    produto: campos(produto),
    movimentos: movimentos.map(camposMovimento),
  };
}

function campos(produto: Produto) {
  return {
    estoqueAtual: produto.estoqueAtual,
    precoVenda: produto.precoVenda,
    custoMedio: produto.custoMedio,
    ultimoPreco: produto.ultimoPreco,
    margem: produto.margem,
    ipi: produto.ipi,
    codigoInterno: produto.codigoInterno,
    sku: produto.sku,
    atualizadoEm: produto.atualizadoEm.toISOString(),
  };
}

function camposMovimento(movimento: MovimentacaoEstoque) {
  return {
    id: movimento.id,
    tipo: movimento.tipo,
    quantidade: movimento.quantidade,
    saldoApos: movimento.saldoApos,
    motivo: movimento.motivo,
    precoUnitarioCusto: movimento.precoUnitarioCusto,
  };
}
