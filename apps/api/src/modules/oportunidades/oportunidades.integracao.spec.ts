import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  ChaveEtapaSistema,
  NaturezaPessoa,
  OrigemNegocio,
  PerfilUsuario,
  PrioridadeOportunidade,
  TipoContato,
  TipoParceiro,
} from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';
import { ContatosService } from '../contatos/contatos.service';
import { EventosService } from '../eventos/eventos.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ProdutosService } from '../produtos/produtos.service';
import { OportunidadesService } from './oportunidades.service';

const ATIVO = process.env.ECOL_NEGOCIO === '1' || process.env.ECOL_PRODUTO === '1';
const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('ECOL-11 no banco', () => {
  const auditoria = new AuditoriaService(platform as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const campos = new CamposPersonalizadosService(operacional as never);
  const contatos = new ContatosService(
    operacional as never,
    platform as never,
    campos,
    permissoes,
  );
  const eventos = new EventosService(operacional as never);
  const produtos = {
    /* não usado nestes testes */
  } as unknown as ProdutosService;
  const negocios = new OportunidadesService(
    operacional as never,
    platform as never,
    campos,
    eventos,
    produtos,
    permissoes,
    contatos,
  );

  let ecolumeId = '';
  let padraoId = '';
  let usuarioId = '';
  let clienteId = '';
  let parceiroId = '';

  beforeAll(async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `NEG11 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `NEG11P ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { onboardingConcluido: true },
      },
    });
    empresas.push(ecolume.id, padrao.id);
    ecolumeId = ecolume.id;
    padraoId = padrao.id;

    const user = await platform.usuario.create({
      data: {
        empresaId: ecolumeId,
        nome: `User ${sufixo}`,
        email: `neg11-${sufixo}@teste.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    usuarioId = user.id;

    for (const empresaId of [ecolumeId, padraoId]) {
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
    }

    const cliente = await contatos.criar(ecolumeId, {
      nome: `Cliente ${sufixo}`,
      telefone: '11970001001',
      natureza: NaturezaPessoa.PF,
      tipo: TipoContato.OUTRO,
      dadosPersonalizados: {},
      cidade: 'Campinas',
      logradouro: 'Rua Cliente',
      numero: '10',
    });
    clienteId = cliente.id as string;

    const parceiro = await contatos.criar(ecolumeId, {
      nome: `Parceiro ${sufixo}`,
      telefone: '11970001002',
      natureza: NaturezaPessoa.PJ,
      tipo: TipoContato.EMPRESA,
      ehParceiro: true,
      tipoParceiro: TipoParceiro.ARQUITETO_DESIGNER,
      rtPadrao: 10,
      dadosPersonalizados: {},
    });
    parceiroId = parceiro.id as string;
  }, 120_000);

  // Cleanup multi-tabela no mesmo Postgres compartilhado; 10s (hookTimeout padrão) estoura sob carga.
  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.arquivo.deleteMany({ where: { empresaId } });
      await operacional.historicoEtapaOportunidade.deleteMany({ where: { empresaId } });
      await operacional.eventoOportunidade.deleteMany({ where: { empresaId } });
      await operacional.oportunidade.deleteMany({ where: { empresaId } });
      await operacional.contato.deleteMany({ where: { empresaId } });
      await operacional.etapaFunil.deleteMany({ where: { empresaId } });
      await platform.usuario.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  }, 120_000);

  it('cria NEG direto e via parceiro; etapa Novo contato; endereço separado', async () => {
    const direto = await negocios.criar(
      ecolumeId,
      {
        contatoId: clienteId,
        titulo: `Cliente ${sufixo} — Projeto`,
        origemNegocio: OrigemNegocio.CLIENTE_DIRETO,
        responsavelId: usuarioId,
        prioridade: PrioridadeOportunidade.MEDIA,
        obraCidade: 'Santos',
        obraLogradouro: 'Av Obra',
        dadosPersonalizados: {},
      },
      { usuarioId },
    );
    expect(direto.codigo).toMatch(/^NEG-\d{4}$/);
    expect(direto.etapa?.chaveSistema ?? direto.etapaId).toBeTruthy();
    const detalhe = await negocios.obter(ecolumeId, direto.id as string);
    expect(detalhe.etapa?.chaveSistema).toBe(ChaveEtapaSistema.NOVO_CONTATO);
    expect(detalhe.obraCidade).toBe('Santos');
    expect(detalhe.contato?.cidade).toBe('Campinas');

    const via = await negocios.criar(
      ecolumeId,
      {
        contatoId: clienteId,
        titulo: `Via ${sufixo}`,
        origemNegocio: OrigemNegocio.VIA_PARCEIRO,
        parceiroId,
        responsavelId: usuarioId,
        prioridade: PrioridadeOportunidade.MEDIA,
        dadosPersonalizados: {},
      },
      { usuarioId },
    );
    expect(via.parceiroId).toBe(parceiroId);
    expect(via.rtNegocio).toBe(10);

    await contatos.atualizar(ecolumeId, parceiroId, { rtPadrao: 15 });
    const intacto = await negocios.obter(ecolumeId, via.id as string);
    expect(intacto.rtNegocio).toBe(10);
  });

  it('concorrência gera códigos NEG distintos e legado usa OP-', async () => {
    const [a, b] = await Promise.all([
      negocios.criar(
        ecolumeId,
        {
          contatoId: clienteId,
          titulo: `Conc A ${sufixo}`,
          origemNegocio: OrigemNegocio.CLIENTE_DIRETO,
          responsavelId: usuarioId,
          prioridade: PrioridadeOportunidade.MEDIA,
          dadosPersonalizados: {},
        },
        { usuarioId },
      ),
      negocios.criar(
        ecolumeId,
        {
          contatoId: clienteId,
          titulo: `Conc B ${sufixo}`,
          origemNegocio: OrigemNegocio.CLIENTE_DIRETO,
          responsavelId: usuarioId,
          prioridade: PrioridadeOportunidade.MEDIA,
          dadosPersonalizados: {},
        },
        { usuarioId },
      ),
    ]);
    expect(a.codigo).not.toBe(b.codigo);
    expect(a.codigo).toMatch(/^NEG-/);
    expect(b.codigo).toMatch(/^NEG-/);

    const userPadrao = await platform.usuario.create({
      data: {
        empresaId: padraoId,
        nome: `Pad ${sufixo}`,
        email: `neg11p-${sufixo}@teste.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    const contatoPadrao = await contatos.criar(padraoId, {
      nome: `Legado ${sufixo}`,
      telefone: '11970001999',
      tipo: TipoContato.OUTRO,
      dadosPersonalizados: {},
    });
    const op = await negocios.criar(
      padraoId,
      {
        contatoId: contatoPadrao.id as string,
        prioridade: PrioridadeOportunidade.MEDIA,
        dadosPersonalizados: {},
      },
      { usuarioId: userPadrao.id },
    );
    expect(op.codigo).toMatch(/^OP-/);
    expect(op.titulo).toBe(op.codigo);
  });
});
