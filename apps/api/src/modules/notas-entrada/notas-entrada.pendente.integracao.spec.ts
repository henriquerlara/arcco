import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PerfilUsuario } from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ArquivosService } from '../arquivos/arquivos.service';
import { LocalStorageProvider } from '../arquivos/local.provider';
import { NotasEntradaService } from './notas-entrada.service';
import { CHAVE_A, CHAVE_B, CHAVE_D, montarNfeXml } from './fixtures/nfe-sintetica';

const ATIVO = process.env.ECOL_NFE === '1' || process.env.ECOL_PRODUTO === '1';
const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('Nota de entrada PENDENTE/CONFERIDA no banco', () => {
  const auditoria = new AuditoriaService(platform as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const storage = new LocalStorageProvider();
  const arquivos = new ArquivosService(operacional as never, storage);
  const notas = new NotasEntradaService(operacional as never, permissoes, auditoria, arquivos);

  let ecolumeId = '';
  let dono: { id: string; perfil: string };

  const xmlSpot = (chave: string, qtd = 10, preco = 20) =>
    montarNfeXml({
      chave,
      vNF: qtd * preco,
      itens: [
        {
          nItem: 1,
          cProd: 'COD-PEND',
          xProd: 'Luminaria pendente',
          qCom: qtd,
          vUnCom: preco,
          NCM: '94054010',
          orig: '0',
        },
      ],
    });

  async function produtoPend() {
    return operacional.produto.findFirst({
      where: { empresaId: ecolumeId, codigoFornecedor: 'COD-PEND' },
    });
  }

  beforeAll(async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `NFEPEND ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    empresas.push(ecolume.id);
    ecolumeId = ecolume.id;
    const u = await platform.usuario.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Dono',
        email: `nfepend.dono.${sufixo}@teste.arcco.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    dono = { id: u.id, perfil: PerfilUsuario.PROPRIETARIO };
  }, 120_000);

  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.itemNotaEntrada.deleteMany({ where: { empresaId } });
      await operacional.notaEntrada.deleteMany({ where: { empresaId } });
      await operacional.movimentacaoEstoque.deleteMany({ where: { empresaId } });
      await operacional.produto.deleteMany({ where: { empresaId } });
      await operacional.fornecedor.deleteMany({ where: { empresaId } });
      await operacional.arquivo.deleteMany({ where: { empresaId } });
      await operacional.logAuditoria.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.usuario.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  }, 120_000);

  it('pendente não mexe em estoque/custo; reabrir e confirmar uma vez movimenta; segunda confirmação bloqueada', async () => {
    const xml = xmlSpot(CHAVE_A, 10, 20);
    const pend = await notas.salvarPendente(
      ecolumeId,
      { xml, aliquotaStFornecedor: 18, itens: [{ numeroItem: 1, acao: 'criar' }] },
      dono,
    );
    expect(pend.status).toBe('PENDENTE');
    expect(pend.qtdItens).toBe(1);

    // Nenhum produto criado/alterado e nenhuma movimentação.
    expect(await produtoPend()).toBeNull();
    expect(await operacional.produto.count({ where: { empresaId: ecolumeId } })).toBe(0);
    expect(await operacional.movimentacaoEstoque.count({ where: { empresaId: ecolumeId } })).toBe(0);

    const nota = await operacional.notaEntrada.findFirstOrThrow({
      where: { id: pend.id, empresaId: ecolumeId },
      include: { itens: true },
    });
    expect(nota.status).toBe('PENDENTE');
    expect(nota.itens[0]!.produtoId).toBeNull();

    const log = await operacional.logAuditoria.findFirst({
      where: { empresaId: ecolumeId, tipo: 'IMPORTACAO_XML', entidadeId: pend.id },
    });
    expect(log).toBeTruthy();
    expect((log!.posterior as { status?: string } | null)?.status).toBe('PENDENTE');

    // Lista devolve status real.
    const lista = await notas.listar(ecolumeId, dono);
    expect(lista.find((n) => n.id === pend.id)?.status).toBe('PENDENTE');

    // Chave já pendente: bloqueia nova gravação e preview.
    await expect(notas.salvarPendente(ecolumeId, { xml }, dono)).rejects.toMatchObject({
      codigo: 'CHAVE_DUPLICADA',
    });
    await expect(
      notas.confirmar(
        ecolumeId,
        { xml, itens: [{ numeroItem: 1, acao: 'criar' }] },
        dono,
      ),
    ).rejects.toMatchObject({ codigo: 'CHAVE_DUPLICADA' });
    expect(await produtoPend()).toBeNull();

    // Reabre conferência.
    const conf = await notas.obterConferencia(ecolumeId, pend.id, dono);
    expect(conf.notaId).toBe(pend.id);
    expect(conf.chaveAcesso).toBe(CHAVE_A);
    expect(conf.itens).toHaveLength(1);
    expect(conf.decisoes).toHaveLength(1);
    expect(conf.fornecedor.novo).toBe(false);

    // Confirma.
    const ok = await notas.confirmar(
      ecolumeId,
      {
        notaEntradaId: pend.id,
        itens: [
          { numeroItem: 1, acao: 'criar', controlaEstoque: true, descricaoComercial: 'Luminaria conferida' },
        ],
      },
      dono,
    );
    expect(ok.id).toBe(pend.id);

    const prod = await produtoPend();
    expect(prod!.estoqueAtual).toBe(10);
    expect(Number(prod!.custoMedio)).toBe(20);
    expect(Number(prod!.ultimoPreco)).toBe(20);
    expect(await operacional.movimentacaoEstoque.count({ where: { empresaId: ecolumeId, produtoId: prod!.id } })).toBe(1);

    const conferida = await operacional.notaEntrada.findFirstOrThrow({
      where: { id: pend.id, empresaId: ecolumeId },
      include: { itens: true },
    });
    expect(conferida.status).toBe('CONFERIDA');
    expect(conferida.itens[0]!.produtoId).toBe(prod!.id);

    // Segunda confirmação bloqueada; estoque não dobra.
    await expect(
      notas.confirmar(
        ecolumeId,
        { notaEntradaId: pend.id, itens: [{ numeroItem: 1, acao: 'reconhecido' }] },
        dono,
      ),
    ).rejects.toMatchObject({ codigo: 'NOTA_JA_CONFERIDA' });
    await expect(notas.obterConferencia(ecolumeId, pend.id, dono)).rejects.toMatchObject({
      codigo: 'NOTA_JA_CONFERIDA',
    });
    expect((await produtoPend())!.estoqueAtual).toBe(10);

    // Chave conferida: pendente também bloqueia.
    await expect(notas.salvarPendente(ecolumeId, { xml }, dono)).rejects.toMatchObject({
      codigo: 'CHAVE_DUPLICADA',
    });

    // Auditoria da confirmação.
    const logs = await operacional.logAuditoria.findMany({
      where: { empresaId: ecolumeId, tipo: 'IMPORTACAO_XML', entidadeId: pend.id },
    });
    expect(logs.length).toBe(2);
  }, 120_000);

  it('pendente reconhecido não altera saldo existente nem custo', async () => {
    // Produto já existe (nota anterior) com saldo 10 e custo 20.
    const antes = await produtoPend();
    expect(antes).toBeTruthy();

    const xml = xmlSpot(CHAVE_B, 5, 30);
    const pend = await notas.salvarPendente(
      ecolumeId,
      { xml, itens: [{ numeroItem: 1, acao: 'reconhecido' }] },
      dono,
    );
    const item = await operacional.itemNotaEntrada.findFirstOrThrow({
      where: { notaEntradaId: pend.id },
    });
    expect(item.produtoId).toBe(antes!.id);

    const depois = await produtoPend();
    expect(depois!.estoqueAtual).toBe(antes!.estoqueAtual);
    expect(Number(depois!.custoMedio)).toBe(Number(antes!.custoMedio));
    expect(Number(depois!.ultimoPreco)).toBe(Number(antes!.ultimoPreco));
    expect(await operacional.movimentacaoEstoque.count({ where: { empresaId: ecolumeId, produtoId: antes!.id } })).toBe(1);

    await notas.confirmar(
      ecolumeId,
      { notaEntradaId: pend.id, itens: [{ numeroItem: 1, acao: 'reconhecido' }] },
      dono,
    );
    const final = await produtoPend();
    expect(final!.estoqueAtual).toBe(15);
    expect(Number(final!.ultimoPreco)).toBe(30);
  }, 120_000);

  it('confirmar com notaEntradaId inexistente → 404; sem xml nem id → inválido', async () => {
    await expect(
      notas.confirmar(
        ecolumeId,
        { notaEntradaId: randomUUID(), itens: [{ numeroItem: 1, acao: 'reconhecido' }] },
        dono,
      ),
    ).rejects.toMatchObject({ codigo: 'NOTA_ENTRADA_NAO_ENCONTRADA' });
    await expect(
      notas.obterConferencia(ecolumeId, randomUUID(), dono),
    ).rejects.toMatchObject({ codigo: 'NOTA_ENTRADA_NAO_ENCONTRADA' });
  });

  it('regressão: confirmar(xml) direto cria CONFERIDA e movimenta estoque', async () => {
    const xml = xmlSpot(CHAVE_D, 4, 50);
    const antes = await produtoPend();
    const r = await notas.confirmar(
      ecolumeId,
      { xml, itens: [{ numeroItem: 1, acao: 'reconhecido' }] },
      dono,
    );
    const nota = await operacional.notaEntrada.findFirstOrThrow({
      where: { id: r.id, empresaId: ecolumeId },
    });
    expect(nota.status).toBe('CONFERIDA');
    expect((await produtoPend())!.estoqueAtual).toBe(antes!.estoqueAtual + 4);

    await expect(
      notas.confirmar(
        ecolumeId,
        { xml, itens: [{ numeroItem: 1, acao: 'reconhecido' }] },
        dono,
      ),
    ).rejects.toMatchObject({ codigo: 'CHAVE_DUPLICADA' });
  }, 120_000);
});
