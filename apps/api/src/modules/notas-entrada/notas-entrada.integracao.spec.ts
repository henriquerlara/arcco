import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PerfilUsuario, PermissaoComercial } from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ArquivosService } from '../arquivos/arquivos.service';
import { LocalStorageProvider } from '../arquivos/local.provider';
import { NotasEntradaService } from './notas-entrada.service';
import {
  CHAVE_A,
  CHAVE_B,
  CHAVE_C,
  CHAVE_D,
  CHAVE_E,
  CHAVE_F,
  CHAVE_G,
  CHAVE_H,
  CNPJ_EMIT_A,
  montarNfeXml,
} from './fixtures/nfe-sintetica';

const ATIVO = process.env.ECOL_NFE === '1' || process.env.ECOL_PRODUTO === '1';
const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('ECOL-07 no banco', () => {
  const auditoria = new AuditoriaService(platform as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const storage = new LocalStorageProvider();
  const arquivos = new ArquivosService(operacional as never, storage);
  const notas = new NotasEntradaService(
    operacional as never,
    permissoes,
    auditoria,
    arquivos,
  );

  let ecolumeId = '';
  let outraId = '';
  let padraoId = '';
  let dono: { id: string; perfil: string };
  let vendedor: { id: string; perfil: string };

  beforeAll(async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `NFE07 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const outra = await platform.empresa.create({
      data: {
        nome: `NFE07B ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `NFE07P ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { onboardingConcluido: true },
      },
    });
    empresas.push(ecolume.id, outra.id, padrao.id);
    ecolumeId = ecolume.id;
    outraId = outra.id;
    padraoId = padrao.id;

    const uDono = await platform.usuario.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Dono',
        email: `nfe.dono.${sufixo}@teste.arcco.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    const uVend = await platform.usuario.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Vend',
        email: `nfe.vend.${sufixo}@teste.arcco.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.VENDEDOR,
      },
    });
    dono = { id: uDono.id, perfil: PerfilUsuario.PROPRIETARIO };
    vendedor = { id: uVend.id, perfil: PerfilUsuario.VENDEDOR };
  }, 60_000);

  // 3 empresas + várias tabelas; hookTimeout 10s falha sob suíte concorrente.
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

  const xmlBase = (chave: string, extras?: Partial<Parameters<typeof montarNfeXml>[0]>) =>
    montarNfeXml({
      chave,
      vNF: 200,
      itens: [
        {
          nItem: 1,
          cProd: 'COD-SPOT',
          xProd: 'Spot LED 10W',
          qCom: 10,
          vUnCom: 20,
          pIPI: 3.5,
          NCM: '94054010',
          CEST: '2805900',
          orig: '0',
        },
      ],
      ...extras,
    });

  it('preview nao grava; confirma cria fornecedor, produto, entrada e custos', async () => {
    const xml = xmlBase(CHAVE_A);
    const antesF = await operacional.fornecedor.count({ where: { empresaId: ecolumeId } });
    const preview = await notas.previsualizar(ecolumeId, xml, dono);
    expect(preview.fornecedor.novo).toBe(true);
    expect(preview.itens[0]!.acaoSugerida).toBe('criar');
    expect(await operacional.fornecedor.count({ where: { empresaId: ecolumeId } })).toBe(antesF);
    expect(await operacional.notaEntrada.count({ where: { empresaId: ecolumeId } })).toBe(0);

    await expect(
      notas.confirmar(
        ecolumeId,
        {
          xml,
          itens: [{ numeroItem: 1, acao: 'criar', controlaEstoque: true }],
        },
        dono,
      ),
    ).rejects.toMatchObject({ codigo: 'ST_OBRIGATORIO' });

    const conf = await notas.confirmar(
      ecolumeId,
      {
        xml,
        aliquotaStFornecedor: 18,
        itens: [
          {
            numeroItem: 1,
            acao: 'criar',
            controlaEstoque: true,
            descricaoComercial: 'Spot comercial',
          },
        ],
      },
      dono,
    );
    expect(conf.chaveAcesso).toBe(CHAVE_A);

    const forn = await operacional.fornecedor.findFirst({
      where: { empresaId: ecolumeId, cnpj: CNPJ_EMIT_A },
    });
    expect(forn).toBeTruthy();
    expect(Number(forn!.aliquotaSt)).toBe(18);

    const prod = await operacional.produto.findFirst({
      where: { empresaId: ecolumeId, codigoFornecedor: 'COD-SPOT' },
    });
    expect(prod!.descricaoComercial).toBe('Spot comercial');
    expect(prod!.estoqueAtual).toBe(10);
    expect(Number(prod!.ultimoPreco)).toBe(20);
    expect(Number(prod!.custoMedio)).toBe(20);
    expect(prod!.ipi).toBe(3.5);
    expect(prod!.ncm).toBe('94054010');
    expect(prod!.precoVenda).toBe(0);
    expect(prod!.codigoInterno).toMatch(/^CI-/);

    const movs = await operacional.movimentacaoEstoque.count({
      where: { empresaId: ecolumeId, produtoId: prod!.id },
    });
    expect(movs).toBe(1);
  }, 30_000);

  it('segunda nota reconhece produto; chave duplicada e concorrencia', async () => {
    const xml2 = xmlBase(CHAVE_B, { vNF: 100, itens: [
      { nItem: 1, cProd: 'COD-SPOT', xProd: 'Spot LED 10W', qCom: 5, vUnCom: 22, pIPI: 3.5 },
    ]});
    const preview = await notas.previsualizar(ecolumeId, xml2, dono);
    expect(preview.fornecedor.novo).toBe(false);
    expect(preview.itens[0]!.acaoSugerida).toBe('reconhecido');

    const conf = await notas.confirmar(
      ecolumeId,
      {
        xml: xml2,
        itens: [{ numeroItem: 1, acao: 'reconhecido' }],
      },
      dono,
    );
    expect(conf.chaveAcesso).toBe(CHAVE_B);

    const prod = await operacional.produto.findFirst({
      where: { empresaId: ecolumeId, codigoFornecedor: 'COD-SPOT' },
    });
    expect(prod!.estoqueAtual).toBe(15);
    // média (10*20 + 5*22) / 15 = 20.6666...
    expect(Number(prod!.custoMedio)).toBeCloseTo(20.6667, 3);
    expect(Number(prod!.ultimoPreco)).toBe(22);

    await expect(
      notas.confirmar(
        ecolumeId,
        {
          xml: xml2,
          itens: [{ numeroItem: 1, acao: 'reconhecido' }],
        },
        dono,
      ),
    ).rejects.toMatchObject({ codigo: 'CHAVE_DUPLICADA' });

    const xmlDup = xmlBase(CHAVE_C, {
      itens: [{ nItem: 1, cProd: 'NOVO-X', xProd: 'X', qCom: 1, vUnCom: 10 }],
      vNF: 10,
    });
    const [a, b] = await Promise.allSettled([
      notas.confirmar(
        ecolumeId,
        {
          xml: xmlDup,
          aliquotaStFornecedor: 0,
          itens: [{ numeroItem: 1, acao: 'criar' }],
        },
        dono,
      ),
      notas.confirmar(
        ecolumeId,
        {
          xml: xmlDup,
          aliquotaStFornecedor: 0,
          itens: [{ numeroItem: 1, acao: 'criar' }],
        },
        dono,
      ),
    ]);
    const oks = [a, b].filter((r) => r.status === 'fulfilled');
    const falhas = [a, b].filter((r) => r.status === 'rejected');
    expect(oks).toHaveLength(1);
    expect(falhas).toHaveLength(1);
  }, 30_000);

  // Vários confirmar + lote: testTimeout padrão (5s) estoura sob carga do Postgres compartilhado.
  it('vinculo manual, sem estoque, referencia de custo e lote misto', async () => {
    const existente = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Avulso orc',
        sku: `AV-${sufixo}`,
        precoVenda: 50,
        estoqueAtual: 4,
        controlaEstoque: true,
        codigoFornecedor: null,
      },
    });

    const xmlV = montarNfeXml({
      chave: CHAVE_D,
      vNF: 40,
      itens: [
        { nItem: 1, cProd: 'AV-1', xProd: 'Item avulso NF', qCom: 2, vUnCom: 20 },
      ],
    });

    await expect(
      notas.confirmar(
        ecolumeId,
        {
          xml: xmlV,
          itens: [
            {
              numeroItem: 1,
              acao: 'vincular',
              produtoId: existente.id,
              controlaEstoque: true,
            },
          ],
        },
        dono,
      ),
    ).rejects.toMatchObject({ codigo: 'CUSTO_REFERENCIA_OBRIGATORIO' });

    await notas.confirmar(
      ecolumeId,
      {
        xml: xmlV,
        itens: [
          {
            numeroItem: 1,
            acao: 'vincular',
            produtoId: existente.id,
            controlaEstoque: true,
            custoReferenciaSaldo: 10,
          },
        ],
      },
      dono,
    );
    const atualizado = await operacional.produto.findFirstOrThrow({ where: { id: existente.id } });
    expect(atualizado.estoqueAtual).toBe(6);
    expect(atualizado.fornecedorId).toBeTruthy();
    expect(atualizado.codigoFornecedor).toBe('AV-1');
    expect(atualizado.precoVenda).toBe(50);
    // (4*10 + 2*20) / 6 = 13.3333
    expect(Number(atualizado.custoMedio)).toBeCloseTo(13.3333, 3);

    const xmlSem = montarNfeXml({
      chave: CHAVE_E,
      vNF: 15,
      itens: [{ nItem: 1, cProd: 'SERV-1', xProd: 'Servico', qCom: 1, vUnCom: 15 }],
    });
    await notas.confirmar(
      ecolumeId,
      {
        xml: xmlSem,
        itens: [{ numeroItem: 1, acao: 'criar', controlaEstoque: false }],
      },
      dono,
    );
    const serv = await operacional.produto.findFirst({
      where: { empresaId: ecolumeId, codigoFornecedor: 'SERV-1' },
    });
    expect(serv!.controlaEstoque).toBe(false);
    expect(serv!.estoqueAtual).toBe(0);
    expect(
      await operacional.movimentacaoEstoque.count({
        where: { empresaId: ecolumeId, produtoId: serv!.id },
      }),
    ).toBe(0);

    const lote = await notas.confirmarLote(
      ecolumeId,
      [
        {
          xml: montarNfeXml({
            chave: CHAVE_F,
            vNF: 5,
            itens: [{ nItem: 1, cProd: 'LOTE-1', xProd: 'L', qCom: 1, vUnCom: 5 }],
          }),
          itens: [{ numeroItem: 1, acao: 'criar' }],
        },
        {
          xml: xmlBase(CHAVE_A),
          aliquotaStFornecedor: 1,
          itens: [{ numeroItem: 1, acao: 'criar' }],
        },
      ],
      dono,
    );
    expect(lote.filter((r) => r.ok)).toHaveLength(1);
    expect(lote.filter((r) => !r.ok)).toHaveLength(1);
  }, 30_000);

  it('corrige reconhecimento: vincular outro produto ou criar novo', async () => {
    const sugerido = await operacional.produto.findFirst({
      where: { empresaId: ecolumeId, codigoFornecedor: 'COD-SPOT' },
    });
    expect(sugerido).toBeTruthy();

    const outro = await operacional.produto.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Outro catalogo',
        sku: `OUT-${sufixo}`,
        precoVenda: 9,
        estoqueAtual: 0,
        controlaEstoque: true,
      },
    });

    const xmlG = montarNfeXml({
      chave: CHAVE_G,
      vNF: 30,
      itens: [{ nItem: 1, cProd: 'COD-SPOT', xProd: 'Spot LED 10W', qCom: 1, vUnCom: 30 }],
    });
    const preview = await notas.previsualizar(ecolumeId, xmlG, dono);
    expect(preview.itens[0]!.acaoSugerida).toBe('reconhecido');
    expect(preview.itens[0]!.produtoReconhecido?.id).toBe(sugerido!.id);
    expect(await operacional.notaEntrada.count({ where: { chaveAcesso: CHAVE_G } })).toBe(0);

    await notas.confirmar(
      ecolumeId,
      {
        xml: xmlG,
        itens: [
          {
            numeroItem: 1,
            acao: 'vincular',
            produtoId: outro.id,
            controlaEstoque: true,
          },
        ],
      },
      dono,
    );
    const outroApos = await operacional.produto.findFirstOrThrow({ where: { id: outro.id } });
    expect(outroApos.estoqueAtual).toBe(1);
    expect(outroApos.codigoFornecedor).toBe('COD-SPOT');
    expect(Number(outroApos.ultimoPreco)).toBe(30);
    const sugeridoApos = await operacional.produto.findFirstOrThrow({ where: { id: sugerido!.id } });
    expect(sugeridoApos.estoqueAtual).toBe(sugerido!.estoqueAtual);

    const xmlH = montarNfeXml({
      chave: CHAVE_H,
      vNF: 8,
      itens: [{ nItem: 1, cProd: 'COD-SPOT', xProd: 'Spot LED 10W', qCom: 1, vUnCom: 8 }],
    });
    await notas.confirmar(
      ecolumeId,
      {
        xml: xmlH,
        itens: [
          {
            numeroItem: 1,
            acao: 'criar',
            controlaEstoque: true,
            descricaoComercial: 'Spot paralelo',
          },
        ],
      },
      dono,
    );
    const novos = await operacional.produto.findMany({
      where: { empresaId: ecolumeId, descricaoComercial: 'Spot paralelo' },
    });
    expect(novos).toHaveLength(1);
    expect(novos[0]!.estoqueAtual).toBe(1);
    expect(novos[0]!.id).not.toBe(sugerido!.id);
  }, 30_000);

  it('isola empresas, flag e permissao IMPORTAR_XML', async () => {
    await expect(notas.listar(padraoId, dono)).rejects.toMatchObject({
      codigo: 'NOTA_ENTRADA_INDISPONIVEL',
    });
    await expect(notas.previsualizar(padraoId, xmlBase(CHAVE_A), dono)).rejects.toMatchObject({
      codigo: 'NOTA_ENTRADA_INDISPONIVEL',
    });

    // ECOL-25: listar/obter sem IMPORTAR_XML; mutação exige a permissão.
    const listaSemPerm = await notas.listar(ecolumeId, vendedor);
    expect(listaSemPerm.length).toBeGreaterThan(0);
    await expect(
      notas.previsualizar(ecolumeId, xmlBase(CHAVE_A), vendedor),
    ).rejects.toMatchObject({ codigo: 'SEM_PERMISSAO' });

    await permissoes.conceder(ecolumeId, vendedor.id, [PermissaoComercial.IMPORTAR_XML]);
    const lista = await notas.listar(ecolumeId, vendedor);
    expect(lista.length).toBeGreaterThan(0);

    const nota = lista[0]!;
    await expect(notas.obter(outraId, nota.id, dono)).rejects.toMatchObject({
      codigo: 'NOTA_ENTRADA_NAO_ENCONTRADA',
    });
  }, 30_000);
});
