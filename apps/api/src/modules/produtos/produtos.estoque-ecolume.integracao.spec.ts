import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  PerfilUsuario,
  PermissaoComercial,
  StatusEstoqueEcolume,
  TipoMovimentacaoEstoque,
  publicarResposta,
  resolverPermissoes,
} from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ProdutosService } from './produtos.service';

const ATIVO = process.env.ECOL_ESTOQUE === '1' || process.env.ECOL_PRODUTO === '1';
const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('ECOL-08 estoque no banco', () => {
  const auditoria = new AuditoriaService(platform as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const produtos = new ProdutosService(operacional as never, auditoria, permissoes);

  let ecolumeId = '';
  let padraoId = '';
  let fornId = '';
  let ids: Record<string, string> = {};

  beforeAll(async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `EST08 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `EST08P ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { onboardingConcluido: true },
      },
    });
    empresas.push(ecolume.id, padrao.id);
    ecolumeId = ecolume.id;
    padraoId = padrao.id;

    const forn = await operacional.fornecedor.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Forn Estoque',
        cnpj: '11222333000181',
        aliquotaSt: 10,
      },
    });
    fornId = forn.id;

    const ok = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'OK item',
        descricaoComercial: 'Spot comercial OK',
        nomeFiscal: 'Spot fiscal',
        codigoInterno: `CI-OK-${sufixo}`,
        codigoFornecedor: 'CF-OK',
        ean: '7891000100103',
        precoVenda: 50,
        estoqueAtual: 20,
        estoqueMinimo: 5,
        controlaEstoque: true,
        fornecedorId: fornId,
        ultimoPreco: 10,
        custoMedio: 9,
        ipi: 5,
        margem: 1.6,
      },
    });
    const baixo = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Baixo',
        descricaoComercial: 'Baixo comercial',
        precoVenda: 10,
        estoqueAtual: 2,
        estoqueMinimo: 5,
        controlaEstoque: true,
        fornecedorId: fornId,
      },
    });
    const comprar = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Negativo',
        descricaoComercial: 'Item a comprar',
        precoVenda: 10,
        estoqueAtual: -3,
        estoqueMinimo: 0,
        controlaEstoque: true,
        fornecedorId: fornId,
        codigoFornecedor: 'CF-NEG',
      },
    });
    const encomenda = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Servico',
        descricaoComercial: 'Sob encomenda',
        precoVenda: 100,
        estoqueAtual: 0,
        controlaEstoque: false,
      },
    });
    ids = { ok: ok.id, baixo: baixo.id, comprar: comprar.id, encomenda: encomenda.id };

    await operacional.movimentacaoEstoque.create({
      data: {
        empresaId: ecolumeId,
        produtoId: ok.id,
        tipo: TipoMovimentacaoEstoque.ENTRADA,
        quantidade: 20,
        saldoApos: 20,
        observacao: 'seed',
        usuarioId: 'user-seed',
      },
    });
  });

  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.movimentacaoEstoque.deleteMany({ where: { empresaId } });
      await operacional.produto.deleteMany({ where: { empresaId } });
      await operacional.fornecedor.deleteMany({ where: { empresaId } });
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  });

  it('status, cards, busca e filtros', async () => {
    const lista = (await produtos.listarEstoque(ecolumeId, {})) as Array<{
      id: string;
      status: string;
      precoSugerido?: number;
      ultimoPreco?: number;
    }>;
    const porId = Object.fromEntries(lista.map((p) => [p.id, p]));
    expect(porId[ids.ok]!.status).toBe(StatusEstoqueEcolume.OK);
    expect(porId[ids.baixo]!.status).toBe(StatusEstoqueEcolume.BAIXO);
    expect(porId[ids.comprar]!.status).toBe(StatusEstoqueEcolume.A_COMPRAR);
    expect(porId[ids.encomenda]!.status).toBe(StatusEstoqueEcolume.SOB_ENCOMENDA);
    // 10 * 1.05 * 1.10 * 1.6 = 18.48
    expect(porId[ids.ok]!.precoSugerido).toBe(18.48);

    const resumo = await produtos.resumoEstoque(ecolumeId);
    expect(resumo.produtosCadastrados).toBe(4);
    expect(resumo.abaixoMinimo).toBe(1);
    expect(resumo.aComprar).toBe(1);
    expect(resumo.sobEncomenda).toBe(1);

    const porEan = await produtos.listarEstoque(ecolumeId, { busca: '7891000100103' });
    expect(porEan.some((p: { id: string }) => p.id === ids.ok)).toBe(true);
    const porFiscal = await produtos.listarEstoque(ecolumeId, { busca: 'Spot fiscal' });
    expect(porFiscal.some((p: { id: string }) => p.id === ids.ok)).toBe(true);
    const porStatus = await produtos.listarEstoque(ecolumeId, {
      status: StatusEstoqueEcolume.A_COMPRAR,
    });
    expect(porStatus).toHaveLength(1);
    expect(porStatus[0]!.id).toBe(ids.comprar);
    const porForn = await produtos.listarEstoque(ecolumeId, { fornecedorId: fornId });
    expect(porForn.every((p: { fornecedorId?: string }) => p.fornecedorId === fornId)).toBe(true);
  });

  it('lista de compra atualiza apos entrada e omite sob encomenda', async () => {
    const antes = await produtos.listaCompra(ecolumeId);
    expect(antes).toHaveLength(1);
    expect(antes[0]!.itens[0]!.quantidadeFaltante).toBe(3);
    expect(antes[0]!.itens.some((i) => i.produtoId === ids.encomenda)).toBe(false);

    await produtos.entrada(ecolumeId, ids.comprar, { quantidade: 5, precoUnitarioCusto: 12 }, 'u1');
    const depois = await produtos.listaCompra(ecolumeId);
    expect(depois).toHaveLength(0);
    const atualizado = await operacional.produto.findFirstOrThrow({ where: { id: ids.comprar } });
    expect(atualizado.estoqueAtual).toBe(2);
  });

  it('movimentacoes globais, permissao de custo e legado', async () => {
    const movs = await produtos.listarMovimentacoesEstoque(ecolumeId, {
      tipo: TipoMovimentacaoEstoque.ENTRADA,
    });
    expect(movs.length).toBeGreaterThan(0);

    await expect(produtos.listaCompra(padraoId)).rejects.toMatchObject({
      codigo: 'LISTA_COMPRA_INDISPONIVEL',
    });
    await expect(produtos.listarMovimentacoesEstoque(padraoId, {})).rejects.toMatchObject({
      codigo: 'MOVIMENTACOES_INDISPONIVEL',
    });

    const legado = await produtos.listarEstoque(padraoId, {});
    expect(Array.isArray(legado)).toBe(true);
    const resumoPadrao = await produtos.resumoEstoque(padraoId);
    expect(resumoPadrao).toHaveProperty('zerados');
    expect(resumoPadrao).not.toHaveProperty('aComprar');

    const ctx = resolverPermissoes({
      configuracoes: { personalizacaoComercial: 'ECOLUME' },
      perfil: PerfilUsuario.VENDEDOR,
      concedidas: [],
    });
    const linha = (await produtos.listarEstoque(ecolumeId, {}))[0]!;
    const publicado = publicarResposta(ctx, linha);
    expect(publicado).not.toHaveProperty('custoMedio');
    expect(publicado).not.toHaveProperty('ultimoPreco');
    // §10.3 / ECOL-08/13: preço sugerido comercial não exige VER_CUSTOS.
    expect(publicado).toHaveProperty('precoSugerido');
    expect(publicado).toHaveProperty('precoVenda');

    const comCusto = resolverPermissoes({
      configuracoes: { personalizacaoComercial: 'ECOLUME' },
      perfil: PerfilUsuario.VENDEDOR,
      concedidas: [PermissaoComercial.VER_CUSTOS],
    });
    expect(publicarResposta(comCusto, linha)).toHaveProperty('precoSugerido');
    expect(publicarResposta(comCusto, linha)).toHaveProperty('custoMedio');
  });
});
