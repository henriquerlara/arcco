import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  ChaveEtapaSistema,
  NaturezaPessoa,
  TipoContato,
  TipoParceiro,
} from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ContatosService } from './contatos.service';
import type { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';

const ATIVO =
  process.env.ECOL_CONTATO === '1' ||
  process.env.ECOL_PRODUTO === '1' ||
  process.env.ECOL_FICHA === '1';
const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('ECOL-09b/10b ficha do cliente e comissões', () => {
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

  let empresaA = '';
  let empresaB = '';
  let c1 = '';
  let c2 = '';
  let c3 = '';
  let parceiro = '';
  let neg1 = '';
  let neg2 = '';
  let neg4 = '';
  let neg5 = '';
  let negC2 = '';
  const ped: Record<string, string> = {};

  const proprietario = () => ({ id: randomUUID(), empresaId: empresaA, perfil: 'PROPRIETARIO' });
  // Sem concessões gravadas: GESTOR não recebe nenhuma chave financeira.
  const gestorSemChaves = () => ({ id: randomUUID(), empresaId: empresaA, perfil: 'GESTOR' });

  let seq = 0;
  async function negocio(opts: {
    empresaId: string;
    contatoId: string;
    etapaId: string;
    parceiroId?: string;
    criadoEm: Date;
  }) {
    seq += 1;
    return operacional.oportunidade.create({
      data: {
        empresaId: opts.empresaId,
        codigo: `NEG-${sufixo}-${seq}`,
        titulo: `Negócio ${seq} ${sufixo}`,
        contatoId: opts.contatoId,
        etapaId: opts.etapaId,
        parceiroId: opts.parceiroId ?? null,
        criadoEm: opts.criadoEm,
      },
    });
  }

  async function pedido(opts: {
    empresaId: string;
    oportunidadeId: string;
    chave: string;
    total: number;
    status: 'CONFIRMADO' | 'FINALIZADO' | 'CANCELADO';
    criadoEm: Date;
    finalizadoEm?: Date;
  }) {
    const orc = await operacional.orcamento.create({
      data: {
        empresaId: opts.empresaId,
        oportunidadeId: opts.oportunidadeId,
        numero: `ORC-${sufixo}-${opts.chave}`,
        status: 'CONVERTIDO',
        subtotal: opts.total,
        total: opts.total,
      },
    });
    const criado = await operacional.pedido.create({
      data: {
        empresaId: opts.empresaId,
        oportunidadeId: opts.oportunidadeId,
        orcamentoId: orc.id,
        numero: `PED-${sufixo}-${opts.chave}`,
        status: opts.status,
        subtotal: opts.total,
        total: opts.total,
        criadoEm: opts.criadoEm,
        finalizadoEm: opts.finalizadoEm ?? null,
      },
    });
    ped[opts.chave] = criado.id;
    return criado;
  }

  async function comissao(opts: {
    empresaId: string;
    pedidoId: string;
    parceiroId: string;
    rt: number;
    valor: number;
    status: 'A_PAGAR' | 'PAGA' | 'CANCELADA';
  }) {
    return operacional.comissaoPedido.create({
      data: {
        empresaId: opts.empresaId,
        pedidoId: opts.pedidoId,
        parceiroId: opts.parceiroId,
        rtPercentual: opts.rt,
        baseCalculo: (opts.valor * 100) / opts.rt,
        valorComissao: opts.valor,
        status: opts.status,
      },
    });
  }

  beforeAll(async () => {
    const a = await platform.empresa.create({
      data: {
        nome: `FICHA ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const b = await platform.empresa.create({
      data: {
        nome: `FICHA-B ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    empresas.push(a.id, b.id);
    empresaA = a.id;
    empresaB = b.id;

    const novo = (empresaId: string, telefone: string, nome: string) =>
      contatos.criar(empresaId, {
        nome: `${nome} ${sufixo}`,
        telefone,
        natureza: NaturezaPessoa.PF,
        tipo: TipoContato.OUTRO,
        dadosPersonalizados: {},
      });
    c1 = (await novo(empresaA, '11981110001', 'Cliente Um')).id;
    c2 = (await novo(empresaA, '11981110002', 'Cliente Dois')).id;
    c3 = (await novo(empresaA, '11981110003', 'Cliente Tres')).id;
    const p = await contatos.criar(empresaA, {
      nome: `Parceiro ${sufixo}`,
      telefone: '11981110004',
      natureza: NaturezaPessoa.PF,
      tipo: TipoContato.OUTRO,
      ehParceiro: true,
      tipoParceiro: TipoParceiro.ARQUITETO_DESIGNER,
      rtPadrao: 10,
      dadosPersonalizados: {},
    });
    parceiro = p.id;
    const cB = await novo(empresaB, '11981110001', 'Cliente B');

    const etapaNovo = await operacional.etapaFunil.create({
      data: {
        empresaId: empresaA,
        nome: 'Novo contato',
        ordem: 1,
        chaveSistema: ChaveEtapaSistema.NOVO_CONTATO,
      },
    });
    const etapaFin = await operacional.etapaFunil.create({
      data: {
        empresaId: empresaA,
        nome: 'Pedido finalizado',
        ordem: 2,
        tipo: 'GANHA',
        chaveSistema: ChaveEtapaSistema.PEDIDO_FINALIZADO,
      },
    });
    const etapaB = await operacional.etapaFunil.create({
      data: {
        empresaId: empresaB,
        nome: 'Novo contato',
        ordem: 1,
        chaveSistema: ChaveEtapaSistema.NOVO_CONTATO,
      },
    });

    const d = (s: string) => new Date(s);

    // Cliente 1: dois negócios, dois pedidos válidos + um cancelado
    neg1 = (
      await negocio({
        empresaId: empresaA,
        contatoId: c1,
        etapaId: etapaFin.id,
        parceiroId: parceiro,
        criadoEm: d('2026-08-25T12:00:00Z'),
      })
    ).id;
    neg2 = (
      await negocio({
        empresaId: empresaA,
        contatoId: c1,
        etapaId: etapaNovo.id,
        criadoEm: d('2026-09-15T12:00:00Z'),
      })
    ).id;
    const p1 = await pedido({
      empresaId: empresaA,
      oportunidadeId: neg1,
      chave: 'P1',
      total: 1000,
      status: 'FINALIZADO',
      criadoEm: d('2026-09-01T12:00:00Z'),
      finalizadoEm: d('2026-09-10T12:00:00Z'),
    });
    await pedido({
      empresaId: empresaA,
      oportunidadeId: neg2,
      chave: 'P2',
      total: 500,
      status: 'CONFIRMADO',
      criadoEm: d('2026-09-20T12:00:00Z'),
    });
    await pedido({
      empresaId: empresaA,
      oportunidadeId: neg2,
      chave: 'P3',
      total: 300,
      status: 'CANCELADO',
      criadoEm: d('2026-09-25T12:00:00Z'),
    });
    await operacional.checklistItemPedido.create({
      data: {
        empresaId: empresaA,
        pedidoId: p1.id,
        tipo: 'ENTREGUE',
        rotulo: 'Entregue',
        concluido: true,
      },
    });

    // Parceiro: pedido pago em outubro, negócio aberto sem pedido, pedido cancelado
    neg4 = (
      await negocio({
        empresaId: empresaA,
        contatoId: c3,
        etapaId: etapaNovo.id,
        parceiroId: parceiro,
        criadoEm: d('2026-10-01T12:00:00Z'),
      })
    ).id;
    neg5 = (
      await negocio({
        empresaId: empresaA,
        contatoId: c3,
        etapaId: etapaNovo.id,
        parceiroId: parceiro,
        criadoEm: d('2026-10-05T12:00:00Z'),
      })
    ).id;
    negC2 = (
      await negocio({
        empresaId: empresaA,
        contatoId: c2,
        etapaId: etapaNovo.id,
        parceiroId: parceiro,
        criadoEm: d('2026-10-02T12:00:00Z'),
      })
    ).id;
    const p4 = await pedido({
      empresaId: empresaA,
      oportunidadeId: neg4,
      chave: 'P4',
      total: 2000,
      status: 'CONFIRMADO',
      criadoEm: d('2026-10-01T12:00:00Z'),
    });
    const p6 = await pedido({
      empresaId: empresaA,
      oportunidadeId: negC2,
      chave: 'P6',
      total: 900,
      status: 'CANCELADO',
      criadoEm: d('2026-10-02T12:00:00Z'),
    });

    await comissao({
      empresaId: empresaA,
      pedidoId: p1.id,
      parceiroId: parceiro,
      rt: 12.5,
      valor: 125,
      status: 'A_PAGAR',
    });
    await comissao({
      empresaId: empresaA,
      pedidoId: p4.id,
      parceiroId: parceiro,
      rt: 10,
      valor: 200,
      status: 'PAGA',
    });
    await comissao({
      empresaId: empresaA,
      pedidoId: p6.id,
      parceiroId: parceiro,
      rt: 10,
      valor: 90,
      status: 'CANCELADA',
    });

    // Anexos: um do cliente 1, um de outro cliente, um "forjado" em outra empresa
    const arquivo = (empresaId: string, nome: string, entidadeId: string) =>
      operacional.arquivo.create({
        data: {
          empresaId,
          nome,
          nomeArmazenamento: `${randomUUID()}.pdf`,
          tipoMime: 'application/pdf',
          tamanho: 10,
          caminho: `/tmp/${randomUUID()}.pdf`,
          entidade: 'OPORTUNIDADE',
          entidadeId,
        },
      });
    await arquivo(empresaA, `contrato-${sufixo}.pdf`, neg1);
    await arquivo(empresaA, `outro-cliente-${sufixo}.pdf`, negC2);
    await arquivo(empresaB, `forjado-${sufixo}.pdf`, neg1);

    // Isolamento: cliente homônimo na outra empresa com seu próprio negócio
    await negocio({
      empresaId: empresaB,
      contatoId: cB.id,
      etapaId: etapaB.id,
      criadoEm: d('2026-09-02T12:00:00Z'),
    });
  }, 120_000);

  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.checklistItemPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.comissaoPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.pagamentoPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.itemPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.pedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.itemOrcamento.deleteMany({ where: { orcamento: { empresaId } } }).catch(() => undefined);
      await operacional.orcamento.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.arquivo.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.oportunidade.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.etapaFunil.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.contato.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  }, 60_000);

  it('resumo exclui pedido CANCELADO e define última compra e parceiro de origem', async () => {
    const ficha = (await contatos.obter(empresaA, c1)) as any;
    const { resumo, historico } = ficha.fichaCliente;
    expect(resumo.totalComprado).toBe(1500);
    expect(resumo.quantidadePedidos).toBe(2);
    expect(new Date(resumo.ultimaCompraEm).toISOString()).toBe('2026-09-20T12:00:00.000Z');
    expect(resumo.parceiroOrigem).toEqual({ id: parceiro, nome: `Parceiro ${sufixo}` });

    expect(historico).toHaveLength(2);
    const h2 = historico.find((n: any) => n.id === neg2);
    expect(h2.orcamentos).toHaveLength(2);
    expect(h2.pedidos.map((p: any) => p.status).sort()).toEqual(['CANCELADO', 'CONFIRMADO']);
    expect(typeof h2.pedidos[0].total).toBe('number');
    const h1 = historico.find((n: any) => n.id === neg1);
    expect(h1.etapa.chaveSistema).toBe(ChaveEtapaSistema.PEDIDO_FINALIZADO);
    expect(h1.pedidos[0].checklist).toEqual([
      { tipo: 'ENTREGUE', concluido: true, aplicavel: true },
    ]);
    // cliente comum não ganha seções de parceiro
    expect(ficha.extratoComissoes).toBeUndefined();
  });

  it('anexos só do cliente e da empresa; outra empresa não enxerga o contato', async () => {
    const ficha = (await contatos.obter(empresaA, c1)) as any;
    const anexos = ficha.fichaCliente.anexos;
    expect(anexos).toHaveLength(1);
    expect(anexos[0]).toMatchObject({
      nome: `contrato-${sufixo}.pdf`,
      oportunidadeId: neg1,
      negocioCodigo: expect.stringContaining('NEG-'),
    });
    expect(anexos[0].negocioTitulo).toContain('Negócio');

    await expect(contatos.obter(empresaB, c1)).rejects.toMatchObject({
      codigo: 'CONTATO_NAO_ENCONTRADO',
    });
    const fichaB = (await contatos.listar(empresaB, { pagina: 1, porPagina: 20 })).dados;
    expect(fichaB.every((c) => c.empresaId === empresaB)).toBe(true);
  });

  it('extrato do parceiro usa snapshot de RT, não o rtPadrao atual', async () => {
    await operacional.contato.update({
      where: { id: parceiro },
      data: { rtPadrao: 30 },
    });
    const ficha = (await contatos.obter(empresaA, parceiro)) as any;
    const extrato = ficha.extratoComissoes as any[];
    const linhaP1 = extrato.find((l) => l.pedidoId === ped.P1);
    expect(linhaP1).toMatchObject({
      pedidoNumero: `PED-${sufixo}-P1`,
      clienteNome: `Cliente Um ${sufixo}`,
      valorVenda: 1000,
      rtPercentual: 12.5,
      valorComissao: 125,
      status: 'A_PAGAR',
    });
    expect(extrato.find((l) => l.pedidoId === ped.P4)).toMatchObject({
      rtPercentual: 10,
      valorComissao: 200,
      status: 'PAGA',
    });
    // ordenado por data desc
    const datas = extrato.map((l) => new Date(l.data).getTime());
    expect([...datas].sort((x, y) => y - x)).toEqual(datas);

    const abertos = ficha.negociosAbertos as any[];
    const ids = abertos.map((n) => n.id);
    expect(ids).toContain(neg5);
    expect(ids).toContain(neg4);
    expect(ids).not.toContain(neg1);
    expect(abertos.find((n) => n.id === neg5)).toMatchObject({
      clienteNome: `Cliente Tres ${sufixo}`,
    });
  });

  it('listar parceiros agrega vendas e comissões, com filtro de período', async () => {
    const todos = await contatos.listar(empresaA, {
      pagina: 1,
      porPagina: 20,
      parceiro: 'true',
    });
    const linha = todos.dados.find((c) => c.id === parceiro) as any;
    expect(linha).toMatchObject({
      vendasIndicadas: 2,
      quantidadePedidos: 2,
      valorVendido: 3000,
      comissaoAPagar: 125,
      comissaoPaga: 200,
    });

    const setembro = (await contatos.listar(empresaA, {
      pagina: 1,
      porPagina: 20,
      parceiro: 'true',
      de: '2026-09-01',
      ate: '2026-09-30',
    })) as any;
    expect(setembro.dados.find((c: any) => c.id === parceiro)).toMatchObject({
      vendasIndicadas: 1,
      valorVendido: 1000,
      comissaoAPagar: 125,
      comissaoPaga: 0,
    });

    const outubro = (await contatos.listar(empresaA, {
      pagina: 1,
      porPagina: 20,
      parceiro: 'true',
      de: '2026-10-01',
      ate: '2026-10-31',
    })) as any;
    expect(outubro.dados.find((c: any) => c.id === parceiro)).toMatchObject({
      vendasIndicadas: 1,
      valorVendido: 2000,
      comissaoAPagar: 0,
      comissaoPaga: 200,
    });
  });

  it('visão geral de comissões: A_PAGAR por padrão, soma e isolamento por empresa', async () => {
    const res = await contatos.listarComissoes(empresaA, { pagina: 1, porPagina: 20 });
    expect(res.dados).toHaveLength(1);
    expect(res.total).toBe(1);
    expect(res.totalComissaoAPagar).toBe(125);
    expect(res.dados[0]).toMatchObject({
      pedidoId: ped.P1,
      oportunidadeId: neg1,
      parceiroId: parceiro,
      parceiroNome: `Parceiro ${sufixo}`,
      clienteNome: `Cliente Um ${sufixo}`,
      rtPercentual: 12.5,
      valorComissao: 125,
      status: 'A_PAGAR',
    });

    const pagas = await contatos.listarComissoes(empresaA, {
      pagina: 1,
      porPagina: 20,
      status: 'PAGA',
      parceiroId: parceiro,
    });
    expect(pagas.dados).toHaveLength(1);
    expect(pagas.totalComissaoAPagar).toBe(125);

    const todas = await contatos.listarComissoes(empresaA, {
      pagina: 1,
      porPagina: 20,
      status: 'TODAS',
    });
    expect(todas.total).toBe(3);

    const periodo = await contatos.listarComissoes(empresaA, {
      pagina: 1,
      porPagina: 20,
      status: 'TODAS',
      de: '2026-10-01',
    });
    expect(periodo.dados.every((l) => l.data >= new Date('2026-10-01'))).toBe(true);

    const outra = await contatos.listarComissoes(empresaB, { pagina: 1, porPagina: 20 });
    expect(outra.total).toBe(0);
    expect(outra.totalComissaoAPagar).toBe(0);

    await expect(
      contatos.listarComissoes(empresaA, { pagina: 1, porPagina: 20, status: 'XYZ' }),
    ).rejects.toMatchObject({ codigo: 'STATUS_COMISSAO_INVALIDO' });
  });

  it('sem VER_COMISSOES/VER_FATURAMENTO os campos financeiros são removidos', async () => {
    const lista = await permissoes.filtrar(
      gestorSemChaves(),
      contatos.listarComissoes(empresaA, { pagina: 1, porPagina: 20 }),
    );
    expect(lista.totalComissaoAPagar).toBeUndefined();
    expect(lista.dados[0]).toBeDefined();
    expect(lista.dados[0]).not.toHaveProperty('valorComissao');
    expect(lista.dados[0]).not.toHaveProperty('rtPercentual');
    expect(lista.dados[0]).toHaveProperty('pedidoNumero');

    const completa = await permissoes.filtrar(
      proprietario(),
      contatos.listarComissoes(empresaA, { pagina: 1, porPagina: 20 }),
    );
    expect(completa.totalComissaoAPagar).toBe(125);
    expect(completa.dados[0]).toHaveProperty('valorComissao');

    const fichaParceiro = (await permissoes.filtrar(
      gestorSemChaves(),
      contatos.obter(empresaA, parceiro),
    )) as any;
    expect(fichaParceiro.extratoComissoes).toBeUndefined();
    expect(fichaParceiro.negociosAbertos).toBeUndefined();

    const fichaCliente = (await permissoes.filtrar(
      gestorSemChaves(),
      contatos.obter(empresaA, c1),
    )) as any;
    expect(fichaCliente.fichaCliente.resumo.totalComprado).toBeUndefined();
    expect(fichaCliente.fichaCliente.resumo.quantidadePedidos).toBeUndefined();
    expect(fichaCliente.fichaCliente.resumo.ultimaCompraEm).toBeUndefined();
    expect(fichaCliente.fichaCliente.resumo.parceiroOrigem).toBeDefined();
    expect(fichaCliente.fichaCliente.historico).toHaveLength(2);

    const parceiros = (await permissoes.filtrar(
      gestorSemChaves(),
      contatos.listar(empresaA, { pagina: 1, porPagina: 20, parceiro: 'true' }),
    )) as any;
    const linha = parceiros.dados.find((c: any) => c.id === parceiro);
    for (const campo of [
      'vendasIndicadas',
      'quantidadePedidos',
      'valorVendido',
      'comissaoAPagar',
      'comissaoPaga',
    ]) {
      expect(linha).not.toHaveProperty(campo);
    }

    const completo = (await permissoes.filtrar(
      proprietario(),
      contatos.obter(empresaA, c1),
    )) as any;
    expect(completo.fichaCliente.resumo.totalComprado).toBe(1500);
  });
});
