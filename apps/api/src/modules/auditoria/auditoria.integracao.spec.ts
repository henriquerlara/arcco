import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient, StatusNotaFiscal } from '@prisma/client';
import { MotivoAjusteEstoque, PermissaoComercial, PerfilUsuario, TipoAuditoria } from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from './auditoria.service';
import { ProdutosService } from '../produtos/produtos.service';
import { NotasFiscaisService } from '../fiscal/notas-fiscais.service';
import { PermissoesService } from '../permissoes/permissoes.service';

/**
 * Banco local descartável. Não roda na suíte comum para não exigir Postgres.
 * ECOL_AUDIT=1 cria empresas de teste e apaga as linhas ao final.
 */
const ATIVO = process.env.ECOL_AUDIT === '1';
const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('ECOL-27a no banco', () => {
  const auditoria = new AuditoriaService(platform as never, operacional as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const produtos = new ProdutosService(operacional as never, auditoria, permissoes);
  const notas = new NotasFiscaisService(
    operacional as never,
    {
      consultarNfe: async () => ({
        mock: true,
        statusHttp: 200,
        body: { status: 'autorizado', numero: '55', serie: '1' },
      }),
    } as never,
    {} as never,
    {} as never,
    {} as never,
    auditoria,
  );

  let ecolumeId = '';
  let padraoId = '';
  let usuarioId = '';
  let produtoId = '';

  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.logAuditoria.deleteMany({ where: { empresaId } });
      await operacional.movimentacaoEstoque.deleteMany({ where: { empresaId } });
      await operacional.notaFiscal.deleteMany({ where: { empresaId } });
      await operacional.orcamento.deleteMany({ where: { empresaId } });
      await operacional.oportunidade.deleteMany({ where: { empresaId } });
      await operacional.contato.deleteMany({ where: { empresaId } });
      await operacional.etapaFunil.deleteMany({ where: { empresaId } });
      await operacional.produto.deleteMany({ where: { empresaId } });
      await platform.logAuditoria.deleteMany({ where: { empresaId } });
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  });

  it('prepara empresas descartáveis', async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `AUD27 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `PAD27 ${sufixo}`,
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
        email: `ecol27a.${sufixo}@teste.arcco.local`,
        senhaHash: 'nao-e-segredo-de-login',
        perfil: PerfilUsuario.VENDEDOR,
      },
    });
    usuarioId = usuario.id;
    const produto = await operacional.produto.create({
      data: { empresaId: ecolumeId, nome: `Spot ${sufixo}`, precoVenda: 10, estoqueAtual: 4 },
    });
    produtoId = produto.id;
  });

  it('preço, entrada e ajuste ficam no mesmo registro da empresa e do usuário', async () => {
    await produtos.atualizar(ecolumeId, produtoId, { precoVenda: 18 }, usuarioId);
    await produtos.entrada(ecolumeId, produtoId, { quantidade: 2 }, usuarioId);
    await produtos.ajuste(
      ecolumeId,
      produtoId,
      {
        saldoContado: 9,
        saldoAnteriorEsperado: 6,
        motivo: MotivoAjusteEstoque.INVENTARIO,
        observacao: 'inventario',
      },
      { id: usuarioId, perfil: PerfilUsuario.PROPRIETARIO },
    );

    const logs = await operacional.logAuditoria.findMany({
      where: { empresaId: ecolumeId },
      orderBy: { criadoEm: 'asc' },
    });
    expect(logs.map((item) => item.tipo)).toEqual([
      TipoAuditoria.ALTERACAO_PRECO,
      TipoAuditoria.ENTRADA_ESTOQUE,
      TipoAuditoria.AJUSTE_ESTOQUE,
    ]);
    expect(logs.every((item) => item.usuarioId === usuarioId && item.entidadeId === produtoId)).toBe(true);
    const preco = logs[0];
    expect(preco.anterior).toMatchObject({ precoVenda: 10 });
    expect(preco.posterior).toMatchObject({ precoVenda: 18 });
    expect(logs[1].anterior).toMatchObject({ estoqueAtual: 4 });
    expect(logs[1].posterior).toMatchObject({ estoqueAtual: 6 });
    expect(logs[2].posterior).toMatchObject({ estoqueAtual: 9 });
  });

  it('falha de auditoria desfaz a alteração e não deixa log de sucesso', async () => {
    const antes = await operacional.produto.findFirstOrThrow({ where: { id: produtoId } });
    await expect(
      operacional.$transaction(async (tx) => {
        await tx.produto.update({ where: { id: produtoId }, data: { estoqueAtual: 80 } });
        await auditoria.registrar(tx, {
          empresaId: ecolumeId,
          usuarioId,
          tipo: 'OUTRO' as TipoAuditoria,
          entidade: 'produto',
          entidadeId: produtoId,
          posterior: { estoqueAtual: 80 },
        });
      }),
    ).rejects.toMatchObject({ codigo: 'AUDITORIA_DESCONHECIDA' });

    const depois = await operacional.produto.findFirstOrThrow({ where: { id: produtoId } });
    expect(depois.estoqueAtual).toBe(antes.estoqueAtual);
    const sucesso = await operacional.logAuditoria.count({
      where: { empresaId: ecolumeId, posterior: { path: ['estoqueAtual'], equals: 80 } },
    });
    expect(sucesso).toBe(0);
  });

  it('operação concluída permanece com o log', async () => {
    const produto = await operacional.produto.findFirstOrThrow({ where: { id: produtoId } });
    expect(produto.precoVenda).toBe(18);
    expect(produto.estoqueAtual).toBe(9);
    const total = await operacional.logAuditoria.count({ where: { empresaId: ecolumeId, entidadeId: produtoId } });
    expect(total).toBe(3);
  });

  it('a outra empresa não vê o log e a empresa sem flag não grava', async () => {
    const alheio = await operacional.logAuditoria.findMany({ where: { empresaId: padraoId } });
    expect(alheio).toHaveLength(0);
    const produtoPadrao = await operacional.produto.create({
      data: { empresaId: padraoId, nome: `Legado ${sufixo}`, precoVenda: 5, estoqueAtual: 1 },
    });
    await produtos.entrada(padraoId, produtoPadrao.id, { quantidade: 3 }, usuarioId);
    const atualizado = await operacional.produto.findFirstOrThrow({ where: { id: produtoPadrao.id } });
    expect(atualizado.estoqueAtual).toBe(4);
    expect(await operacional.logAuditoria.count({ where: { empresaId: padraoId } })).toBe(0);
    expect(await operacional.logAuditoria.count({ where: { entidadeId: produtoId, empresaId: padraoId } })).toBe(0);
  });

  it('não grava senha, token nem certificado', async () => {
    await auditoria.registrar(operacional, {
      empresaId: ecolumeId,
      usuarioId,
      tipo: TipoAuditoria.ALTERACAO_PRECO,
      entidade: 'produto',
      entidadeId: produtoId,
      posterior: {
        precoVenda: 18,
        senha: 'Arcco@123',
        senhaHash: 'hash-secreto',
        token: 'tok-secreto',
        certificado: 'a1.pfx',
      },
    });
    const ultimo = await operacional.logAuditoria.findFirst({
      where: { empresaId: ecolumeId, tipo: TipoAuditoria.ALTERACAO_PRECO },
      orderBy: { criadoEm: 'desc' },
    });
    const texto = JSON.stringify(ultimo);
    expect(texto).not.toContain('Arcco@123');
    expect(texto).not.toContain('hash-secreto');
    expect(texto).not.toContain('tok-secreto');
    expect(texto).not.toContain('a1.pfx');
    expect(ultimo?.posterior).toMatchObject({ precoVenda: 18 });
  });

  it('saída de estoque, emissão, cancelamento e permissão usam a mesma trilha', async () => {
    const etapa = await operacional.etapaFunil.create({
      data: { empresaId: ecolumeId, nome: 'Aberto', ordem: 1, tipo: 'ABERTA' },
    });
    const contato = await operacional.contato.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Cliente',
        telefone: '11988880000',
        telefoneNormalizado: `55${sufixo}80000`,
      },
    });
    const oportunidade = await operacional.oportunidade.create({
      data: {
        empresaId: ecolumeId,
        codigo: `OP-${sufixo}`,
        titulo: 'Negocio',
        contatoId: contato.id,
        etapaId: etapa.id,
      },
    });
    const orcamento = await operacional.orcamento.create({
      data: {
        empresaId: ecolumeId,
        oportunidadeId: oportunidade.id,
        numero: `ORC-${sufixo}`,
        itens: {
          create: {
            produtoId,
            nome: 'Linha',
            quantidade: 1,
            precoUnitario: 18,
            totalLinha: 18,
          },
        },
      },
    });
    await operacional.$transaction((tx) =>
      produtos.baixarPorOrcamento(tx, ecolumeId, orcamento.id, oportunidade.id, usuarioId),
    );
    const nota = await operacional.notaFiscal.create({
      data: {
        empresaId: ecolumeId,
        orcamentoId: orcamento.id,
        oportunidadeId: oportunidade.id,
        status: StatusNotaFiscal.PROCESSANDO,
        refFocus: `ref-${sufixo}`,
      },
    });
    await notas.sincronizar(ecolumeId, nota.id, usuarioId);
    const focusCancelado = new NotasFiscaisService(
      operacional as never,
      {
        consultarNfe: async () => ({
          mock: true,
          statusHttp: 200,
          body: { status: 'cancelado', numero: '55', serie: '1' },
        }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      auditoria,
    );
    await focusCancelado.sincronizar(ecolumeId, nota.id, usuarioId);

    await permissoes.conceder(ecolumeId, usuarioId, [PermissaoComercial.VER_CUSTOS], usuarioId);

    const tipos = (
      await operacional.logAuditoria.findMany({
        where: { empresaId: ecolumeId },
        orderBy: { criadoEm: 'asc' },
      })
    ).map((item) => item.tipo);
    expect(tipos).toContain(TipoAuditoria.SAIDA_ESTOQUE);
    expect(tipos).toContain(TipoAuditoria.EMISSAO_NF);
    expect(tipos).toContain(TipoAuditoria.CANCELAMENTO_NF);
    expect(tipos).not.toContain(TipoAuditoria.ALTERACAO_PERMISSAO);

    const permissao = await platform.logAuditoria.findMany({
      where: { empresaId: ecolumeId, tipo: TipoAuditoria.ALTERACAO_PERMISSAO },
    });
    expect(permissao).toHaveLength(1);
    expect(permissao[0]).toMatchObject({
      usuarioId,
      entidade: 'usuario',
      entidadeId: usuarioId,
    });
    expect(permissao[0].posterior).toMatchObject({ chaves: [PermissaoComercial.VER_CUSTOS] });

    const daOutra = await platform.logAuditoria.findMany({
      where: { empresaId: padraoId, tipo: TipoAuditoria.ALTERACAO_PERMISSAO },
    });
    expect(daOutra).toHaveLength(0);
  });

  it('repetir a mesma concessão não grava outro log nem outra chave', async () => {
    await permissoes.conceder(ecolumeId, usuarioId, [PermissaoComercial.VER_CUSTOS], usuarioId);
    const chaves = await platform.concessaoPermissao.findMany({
      where: { usuarioId, chave: PermissaoComercial.VER_CUSTOS },
    });
    const logs = await platform.logAuditoria.findMany({
      where: { empresaId: ecolumeId, tipo: TipoAuditoria.ALTERACAO_PERMISSAO },
    });
    expect(chaves).toHaveLength(1);
    expect(logs).toHaveLength(1);
  });

  it('falha da operação principal não grava log de permissão', async () => {
    const antes = await platform.logAuditoria.count({ where: { empresaId: ecolumeId } });
    await expect(
      permissoes.conceder(padraoId, usuarioId, [PermissaoComercial.VER_CUSTOS], usuarioId),
    ).rejects.toMatchObject({ codigo: 'USUARIO_NAO_ENCONTRADO' });
    expect(await platform.logAuditoria.count({ where: { empresaId: ecolumeId } })).toBe(antes);
    expect(await platform.logAuditoria.count({ where: { empresaId: padraoId } })).toBe(0);
  });

  it('empresa sem flag grava a chave e não grava auditoria', async () => {
    const usuarioPadrao = await platform.usuario.create({
      data: {
        empresaId: padraoId,
        nome: 'legado',
        email: `ecol27a.padrao.${sufixo}@teste.arcco.local`,
        senhaHash: 'nao-e-segredo-de-login',
        perfil: PerfilUsuario.VENDEDOR,
      },
    });
    await permissoes.conceder(padraoId, usuarioPadrao.id, [PermissaoComercial.VER_CUSTOS], usuarioPadrao.id);
    const chave = await platform.concessaoPermissao.findFirst({
      where: { usuarioId: usuarioPadrao.id, chave: PermissaoComercial.VER_CUSTOS },
    });
    expect(chave?.empresaId).toBe(padraoId);
    expect(await platform.logAuditoria.count({ where: { empresaId: padraoId } })).toBe(0);
    expect(await operacional.logAuditoria.count({ where: { empresaId: padraoId } })).toBe(0);
  });

  it('falha ao gravar o log desfaz a concessão na mesma transação', async () => {
    const original = auditoria.registrarPermissao.bind(auditoria);
    auditoria.registrarPermissao = async () => {
      throw new Error('falha de auditoria');
    };
    await expect(
      permissoes.conceder(ecolumeId, usuarioId, [PermissaoComercial.VER_FATURAMENTO], usuarioId),
    ).rejects.toThrow('falha de auditoria');
    auditoria.registrarPermissao = original;
    expect(
      await platform.concessaoPermissao.findFirst({
        where: { usuarioId, chave: PermissaoComercial.VER_FATURAMENTO },
      }),
    ).toBeNull();
    const logs = await platform.logAuditoria.findMany({
      where: { empresaId: ecolumeId, tipo: TipoAuditoria.ALTERACAO_PERMISSAO },
    });
    expect(logs).toHaveLength(1);
    expect(JSON.stringify(logs)).not.toContain(PermissaoComercial.VER_FATURAMENTO);
  });

  it('o log de permissão continua depois de uma nova conexão', async () => {
    const outra = new PlatformClient();
    const linha = await outra.logAuditoria.findFirst({
      where: { empresaId: ecolumeId, tipo: TipoAuditoria.ALTERACAO_PERMISSAO },
    });
    expect(linha?.entidadeId).toBe(usuarioId);
    await outra.$disconnect();
  });

  it('usuário comum não altera nem apaga o log pela aplicação', () => {
    expect(() => auditoria.alterar()).toThrow(/nao pode ser alterado/);
    expect(() => auditoria.excluir()).toThrow(/nao pode ser excluido/);
  });
});
