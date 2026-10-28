import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  PerfilUsuario,
  PermissaoComercial,
  PersonalizacaoComercial,
  resolverPermissoes,
  publicarResposta,
  StatusComissaoPedido,
  StatusOrcamento,
  StatusPedido,
  TipoAtividade,
  TipoParceiro,
} from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { FollowUpsService } from '../atividades/follow-ups.service';
import { EventosService } from '../eventos/eventos.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { DashboardService } from './dashboard.service';

const ATIVO =
  process.env.ECOL_DASHBOARD === '1' ||
  process.env.ECOL_FOLLOWUP === '1' ||
  process.env.ECOL_ENTREGA === '1';

const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);

describe.skipIf(!ATIVO)('ECOL-23 Visão geral', () => {
  const auditoria = new AuditoriaService(platform as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const eventos = new EventosService(operacional as never);
  const followUps = new FollowUpsService(
    operacional as never,
    platform as never,
    eventos,
    permissoes,
  );
  const dashboard = new DashboardService(
    operacional as never,
    platform as never,
    followUps,
    permissoes,
  );

  let ecolumeId = '';
  let padraoId = '';
  let parceiroId = '';
  let usuarioId = '';
  let etapaId = '';

  beforeAll(async () => {
    const eco = await platform.empresa.create({
      data: {
        nome: `Dash23 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: {
          personalizacaoComercial: 'ECOLUME',
          onboardingConcluido: true,
          diasOrcamentoSemMovimentacao: 7,
        },
      },
    });
    const pad = await platform.empresa.create({
      data: {
        nome: `Dash23P ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { onboardingConcluido: true },
      },
    });
    ecolumeId = eco.id;
    padraoId = pad.id;
    const user = await platform.usuario.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Dono Dash',
        email: `dash-${sufixo}@teste.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    usuarioId = user.id;

    const etapa = await operacional.etapaFunil.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Novo contato',
        ordem: 1,
        tipo: 'ABERTA',
        chaveSistema: 'NOVO_CONTATO',
        ativo: true,
      },
    });
    etapaId = etapa.id;
    await operacional.etapaFunil.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Orçamento em aberto',
        ordem: 2,
        tipo: 'ABERTA',
        chaveSistema: 'ORCAMENTO_EM_ABERTO',
        ativo: true,
      },
    });
    await operacional.etapaFunil.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Perdido',
        ordem: 3,
        tipo: 'PERDIDA',
        chaveSistema: 'PERDIDO',
        ativo: true,
      },
    });

    const cli = await operacional.contato.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Cliente Dash',
        telefone: '11955550001',
        telefoneNormalizado: `1195555${sufixo.slice(0, 4)}`,
        tipo: 'OUTRO',
      },
    });
    const par = await operacional.contato.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Ana Souza',
        telefone: '11955550002',
        telefoneNormalizado: `1195556${sufixo.slice(0, 4)}`,
        tipo: 'OUTRO',
        ehParceiro: true,
        tipoParceiro: TipoParceiro.ARQUITETO,
        rtPadrao: 10,
      },
    });
    parceiroId = par.id;

    const agora = new Date();
    const opp = await operacional.oportunidade.create({
      data: {
        empresaId: ecolumeId,
        codigo: `NEG-${sufixo.slice(0, 4)}`,
        titulo: 'Neg §17',
        contatoId: cli.id,
        parceiroId: par.id,
        etapaId,
        responsavelId: usuarioId,
        criadoEm: agora,
      },
    });

    const orc = await operacional.orcamento.create({
      data: {
        empresaId: ecolumeId,
        oportunidadeId: opp.id,
        numero: `ORC-${sufixo.slice(0, 4)}`,
        versao: 1,
        status: StatusOrcamento.CONVERTIDO,
        vigente: false,
        subtotal: 1642.56,
        total: 1642.56,
        criadoPorId: usuarioId,
      },
    });

    const ped = await operacional.pedido.create({
      data: {
        empresaId: ecolumeId,
        oportunidadeId: opp.id,
        orcamentoId: orc.id,
        numero: `PED-${sufixo.slice(0, 4)}`,
        status: StatusPedido.CONFIRMADO,
        subtotal: 1642.56,
        total: 1642.56,
        criadoPorId: usuarioId,
        criadoEm: agora,
        faseKanban: 'PEDIDO_CONFIRMADO',
      },
    });

    await operacional.comissaoPedido.create({
      data: {
        empresaId: ecolumeId,
        pedidoId: ped.id,
        parceiroId: par.id,
        rtPercentual: 10,
        baseCalculo: 1642.56,
        valorComissao: 164.26,
        status: StatusComissaoPedido.A_PAGAR,
      },
    });

    // ORC aberto (snapshot)
    await operacional.orcamento.create({
      data: {
        empresaId: ecolumeId,
        oportunidadeId: opp.id,
        numero: `ORC-A${sufixo.slice(0, 3)}`,
        versao: 1,
        status: StatusOrcamento.ENVIADO,
        vigente: true,
        subtotal: 100,
        total: 100,
        enviadoEm: new Date(Date.now() - 10 * 86_400_000),
        criadoPorId: usuarioId,
      },
    });

    await operacional.atividade.create({
      data: {
        empresaId: ecolumeId,
        tipo: TipoAtividade.TAREFA,
        titulo: 'Atrasada dash',
        vencimento: new Date(Date.now() - 86_400_000),
        responsavelId: usuarioId,
        concluida: false,
      },
    });

    // legado empresa
    await operacional.etapaFunil.create({
      data: {
        empresaId: padraoId,
        nome: 'Qualificação',
        ordem: 1,
        tipo: 'ABERTA',
        chaveSistema: 'QUALIFICACAO',
        ativo: true,
      },
    });
  }, 90_000);

  afterAll(async () => {
    for (const empresaId of [ecolumeId, padraoId]) {
      await operacional.comissaoPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.checklistItemPedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.atividade.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.pedido.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.orcamento.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.oportunidade.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.contato.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.etapaFunil.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.usuario.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  }, 60_000);

  it('§17 + indicadores, funil, alertas, parceiro e permissões', async () => {
    const m = await dashboard.metricas(ecolumeId, { chave: 'mes' });
    expect(m.modo).toBe('ecolume');
    const ind = (m as { indicadores: Record<string, unknown> }).indicadores;
    expect(ind.faturamento).toBeCloseTo(1642.56, 2);
    expect(ind.vendasConcluidas).toBe(1);
    expect(ind.ticketMedio).toBeCloseTo(1642.56, 2);
    expect((ind.orcamentosAbertos as { quantidade: number }).quantidade).toBeGreaterThanOrEqual(1);

    const funil = (m as { funil: Array<{ chave: string; tipoCard: string }> }).funil;
    expect(funil.some((f) => f.chave === 'NOVO_CONTATO' && f.tipoCard === 'NEGOCIO')).toBe(true);
    expect(funil.some((f) => f.chave === 'PEDIDO_CONFIRMADO' && f.tipoCard === 'PEDIDO')).toBe(true);

    const alertas = (m as { alertas: Array<{ id: string }> }).alertas;
    expect(alertas.some((a) => a.id === 'atividades-atrasadas')).toBe(true);

    const parceiros = (m as { parceiros: Array<Record<string, unknown>> }).parceiros;
    const ana = parceiros.find((p) => p.nome === 'Ana Souza');
    expect(ana).toBeTruthy();
    expect(ana!.quantidadePedidos).toBe(1);
    expect(ana!.valorVendido).toBeCloseTo(1642.56, 2);
    expect(ana!.comissaoGerada).toBeCloseTo(164.26, 2);

    // Sem VER_FATURAMENTO: indicadores e valores somem
    const ctxVend = resolverPermissoes({
      configuracoes: { personalizacaoComercial: PersonalizacaoComercial.ECOLUME },
      perfil: PerfilUsuario.VENDEDOR,
      concedidas: [],
    });
    const filtrado = publicarResposta(ctxVend, m);
    expect(filtrado).not.toHaveProperty('indicadores');
    expect(filtrado).not.toHaveProperty('parceiros');
    expect(filtrado).toHaveProperty('alertas');

    // Só faturamento: parceiros sem comissão
    const ctxFat = resolverPermissoes({
      configuracoes: { personalizacaoComercial: PersonalizacaoComercial.ECOLUME },
      perfil: PerfilUsuario.VENDEDOR,
      concedidas: [PermissaoComercial.VER_FATURAMENTO],
    });
    const comFat = publicarResposta(ctxFat, m) as {
      parceiros: Array<Record<string, unknown>>;
    };
    expect(comFat.parceiros[0]).not.toHaveProperty('comissaoGerada');
    expect(comFat.parceiros[0]).toHaveProperty('valorVendido');

    // Legado intacto
    const legado = await dashboard.metricas(padraoId, { dias: 30 });
    expect(legado.modo).toBe('legado');
    expect(legado).toHaveProperty('conversas');
    expect(legado).toHaveProperty('oportunidades');
  }, 90_000);
});
