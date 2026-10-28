import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  ChaveEtapaSistema,
  NaturezaPessoa,
  OrigemNegocio,
  PerfilUsuario,
  PermissaoComercial,
  PrioridadeOportunidade,
  StatusOrcamento,
  TipoContato,
} from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';
import { ContatosService } from '../contatos/contatos.service';
import { EventosService } from '../eventos/eventos.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ProdutosService } from '../produtos/produtos.service';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { OrcamentosService } from './orcamentos.service';

const ATIVO = process.env.ECOL_ORCAMENTO === '1' || process.env.ECOL_CONV === '1';

const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('§16.2 exclusão de orçamento rascunho no banco', () => {
  const auditoria = new AuditoriaService(platform as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const campos = new CamposPersonalizadosService(operacional as never);
  const contatos = new ContatosService(operacional as never, platform as never, campos, permissoes);
  const eventos = new EventosService(operacional as never);
  const produtos = new ProdutosService(operacional as never, auditoria, permissoes);
  const negocios = new OportunidadesService(
    operacional as never,
    platform as never,
    campos,
    eventos,
    produtos,
    permissoes,
    contatos,
  );
  const orcamentos = new OrcamentosService(
    operacional as never,
    platform as never,
    { enviar: async () => ({ id: 'arq' }) } as never,
    produtos,
    permissoes,
    {} as never,
    auditoria,
  );

  let empresaId = '';
  let outraId = '';
  let dono: { id: string; perfil: string };
  let donoOutra: { id: string; perfil: string };
  let vendedorSem: { id: string; perfil: string };
  let vendedorCom: { id: string; perfil: string };
  let oportunidadeId = '';

  const novoOrcamento = (nome = 'Item') =>
    orcamentos.criar(empresaId, dono.id, {
      oportunidadeId,
      descontoValor: 0,
      itens: [{ nome, quantidade: 2, precoUnitario: 10, unidade: 'un' }],
    });

  beforeAll(async () => {
    const a = await platform.empresa.create({
      data: {
        nome: `ORCDEL ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const b = await platform.empresa.create({
      data: {
        nome: `ORCDELB ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    empresas.push(a.id, b.id);
    empresaId = a.id;
    outraId = b.id;

    const criarUsuario = (emp: string, perfil: PerfilUsuario, rotulo: string) =>
      platform.usuario.create({
        data: {
          empresaId: emp,
          nome: rotulo,
          email: `orcdel-${rotulo}-${sufixo}@teste.local`,
          senhaHash: 'x',
          perfil,
        },
      });
    const uDono = await criarUsuario(empresaId, PerfilUsuario.PROPRIETARIO, 'dono');
    const uSem = await criarUsuario(empresaId, PerfilUsuario.VENDEDOR, 'sem');
    const uCom = await criarUsuario(empresaId, PerfilUsuario.VENDEDOR, 'com');
    const uOutra = await criarUsuario(outraId, PerfilUsuario.PROPRIETARIO, 'outra');
    await platform.concessaoPermissao.create({
      data: {
        empresaId,
        usuarioId: uCom.id,
        chave: PermissaoComercial.EXCLUIR_ORCAMENTO_RASCUNHO,
      },
    });
    dono = { id: uDono.id, perfil: PerfilUsuario.PROPRIETARIO };
    vendedorSem = { id: uSem.id, perfil: PerfilUsuario.VENDEDOR };
    vendedorCom = { id: uCom.id, perfil: PerfilUsuario.VENDEDOR };
    donoOutra = { id: uOutra.id, perfil: PerfilUsuario.PROPRIETARIO };

    const existe = await operacional.etapaFunil.findFirst({
      where: { empresaId, chaveSistema: ChaveEtapaSistema.NOVO_CONTATO },
    });
    if (!existe) {
      await operacional.etapaFunil.create({
        data: {
          empresaId,
          nome: 'Novo contato',
          ordem: 1,
          tipo: 'ABERTA',
          chaveSistema: ChaveEtapaSistema.NOVO_CONTATO,
          ativo: true,
        },
      });
    }
    const cliente = await contatos.criar(empresaId, {
      nome: `Cliente ${sufixo}`,
      telefone: '11970003001',
      natureza: NaturezaPessoa.PF,
      tipo: TipoContato.OUTRO,
      dadosPersonalizados: {},
    });
    const neg = await negocios.criar(
      empresaId,
      {
        contatoId: cliente.id as string,
        titulo: `Neg ${sufixo}`,
        origemNegocio: OrigemNegocio.CLIENTE_DIRETO,
        responsavelId: dono.id,
        prioridade: PrioridadeOportunidade.MEDIA,
        dadosPersonalizados: {},
      },
      { usuarioId: dono.id },
    );
    oportunidadeId = neg.id as string;
  }, 120_000);

  afterAll(async () => {
    for (const emp of empresas) {
      await operacional.logAuditoria.deleteMany({ where: { empresaId: emp } }).catch(() => undefined);
      await operacional.pedido.deleteMany({ where: { empresaId: emp } });
      await operacional.itemOrcamento.deleteMany({ where: { orcamento: { empresaId: emp } } });
      await operacional.orcamento.deleteMany({ where: { empresaId: emp } });
      await operacional.historicoEtapaOportunidade.deleteMany({
        where: { oportunidade: { empresaId: emp } },
      });
      await operacional.oportunidade.deleteMany({ where: { empresaId: emp } });
      await operacional.contato.deleteMany({ where: { empresaId: emp } });
      await operacional.etapaFunil.deleteMany({ where: { empresaId: emp } });
      await platform.concessaoPermissao.deleteMany({ where: { empresaId: emp } }).catch(() => undefined);
      await platform.usuario.deleteMany({ where: { empresaId: emp } });
      await platform.empresa.delete({ where: { id: emp } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  }, 120_000);

  it('exclui RASCUNHO, grava auditoria e é idempotente (segunda exclusão → não encontrado)', async () => {
    const orc = await novoOrcamento('Para excluir');
    const itensAntes = await operacional.itemOrcamento.count({ where: { orcamentoId: orc.id } });
    expect(itensAntes).toBe(1);

    await expect(orcamentos.excluir(empresaId, orc.id, dono)).resolves.toEqual({ ok: true });

    expect(await operacional.orcamento.findUnique({ where: { id: orc.id } })).toBeNull();
    expect(await operacional.itemOrcamento.count({ where: { orcamentoId: orc.id } })).toBe(0);

    const log = await operacional.logAuditoria.findFirst({
      where: { empresaId, tipo: 'EXCLUSAO_ORCAMENTO', entidadeId: orc.id },
    });
    expect(log).toBeTruthy();
    expect(log!.entidade).toBe('ORCAMENTO');
    expect(log!.usuarioId).toBe(dono.id);
    expect(log!.anterior).toMatchObject({
      numero: orc.numero,
      status: StatusOrcamento.RASCUNHO,
      total: 20,
      oportunidadeId,
    });
    expect(log!.posterior).toBeNull();

    await expect(orcamentos.excluir(empresaId, orc.id, dono)).rejects.toMatchObject({
      codigo: 'ORCAMENTO_NAO_ENCONTRADO',
    });
    expect(
      await operacional.logAuditoria.count({
        where: { empresaId, tipo: 'EXCLUSAO_ORCAMENTO', entidadeId: orc.id },
      }),
    ).toBe(1);
  }, 60_000);

  it('bloqueia ENVIADO, CONVERTIDO, SUBSTITUIDO e RECUSADO', async () => {
    const enviado = await novoOrcamento('Enviado');
    await orcamentos.marcarEnviado(empresaId, enviado.id);
    await expect(orcamentos.excluir(empresaId, enviado.id, dono)).rejects.toMatchObject({
      codigo: 'ORCAMENTO_NAO_EXCLUIVEL',
    });

    for (const status of [
      StatusOrcamento.CONVERTIDO,
      StatusOrcamento.SUBSTITUIDO,
      StatusOrcamento.RECUSADO,
    ]) {
      const o = await novoOrcamento(status);
      await operacional.orcamento.update({ where: { id: o.id }, data: { status } });
      await expect(orcamentos.excluir(empresaId, o.id, dono)).rejects.toMatchObject({
        codigo: 'ORCAMENTO_NAO_EXCLUIVEL',
      });
      expect(await operacional.orcamento.findUnique({ where: { id: o.id } })).toBeTruthy();
    }
    expect(await operacional.orcamento.findUnique({ where: { id: enviado.id } })).toBeTruthy();
    expect(
      await operacional.logAuditoria.count({ where: { empresaId, tipo: 'EXCLUSAO_ORCAMENTO', entidadeId: enviado.id } }),
    ).toBe(0);
  }, 60_000);

  it('bloqueia quando há pedido vinculado', async () => {
    const o = await novoOrcamento('Com pedido');
    await operacional.pedido.create({
      data: {
        empresaId,
        oportunidadeId,
        orcamentoId: o.id,
        numero: `PED-${sufixo}`,
      },
    });
    await expect(orcamentos.excluir(empresaId, o.id, dono)).rejects.toMatchObject({
      codigo: 'ORCAMENTO_COM_PEDIDO',
    });
    expect(await operacional.orcamento.findUnique({ where: { id: o.id } })).toBeTruthy();
  }, 60_000);

  it('sem EXCLUIR_ORCAMENTO_RASCUNHO → SEM_PERMISSAO; com concessão → exclui', async () => {
    const o = await novoOrcamento('Permissao');
    await expect(orcamentos.excluir(empresaId, o.id, vendedorSem)).rejects.toMatchObject({
      codigo: 'SEM_PERMISSAO',
    });
    expect(await operacional.orcamento.findUnique({ where: { id: o.id } })).toBeTruthy();

    await expect(orcamentos.excluir(empresaId, o.id, vendedorCom)).resolves.toEqual({ ok: true });
    expect(await operacional.orcamento.findUnique({ where: { id: o.id } })).toBeNull();
  }, 60_000);

  it('isola empresas: outra empresa não exclui nem vê o orçamento', async () => {
    const o = await novoOrcamento('Isolado');
    await expect(orcamentos.excluir(outraId, o.id, donoOutra)).rejects.toMatchObject({
      codigo: 'ORCAMENTO_NAO_ENCONTRADO',
    });
    expect(await operacional.orcamento.findUnique({ where: { id: o.id } })).toBeTruthy();
    await orcamentos.excluir(empresaId, o.id, dono);
  }, 60_000);
});
