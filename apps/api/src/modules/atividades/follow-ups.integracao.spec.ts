import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  NaturezaPessoa,
  OrigemNegocio,
  PerfilUsuario,
  PrioridadeOportunidade,
  StatusOrcamento,
  TipoAtividade,
  TipoContato,
  TipoParceiro,
  tituloFollowUpOrc,
} from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';
import { ContatosService } from '../contatos/contatos.service';
import { EventosService } from '../eventos/eventos.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ProdutosService } from '../produtos/produtos.service';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { OrcamentosService } from '../orcamentos/orcamentos.service';
import { AtividadesService } from './atividades.service';
import { FollowUpsService } from './follow-ups.service';

const ATIVO =
  process.env.ECOL_FOLLOWUP === '1' ||
  process.env.ECOL_ENTREGA === '1' ||
  process.env.ECOL_KANBAN === '1';

const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('ECOL-21 Follow-up e sininho', () => {
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
  );
  const atividades = new AtividadesService(operacional as never, eventos, permissoes);
  const followUps = new FollowUpsService(
    operacional as never,
    platform as never,
    eventos,
    permissoes,
  );

  let ecolumeId = '';
  let padraoId = '';
  let usuarioId = '';
  let clienteId = '';
  let parceiroId = '';

  beforeAll(async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `FU21 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: {
          personalizacaoComercial: 'ECOLUME',
          onboardingConcluido: true,
          diasOrcamentoSemMovimentacao: 7,
        },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `FU21P ${sufixo}`,
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
        email: `fu21-${sufixo}@teste.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    usuarioId = user.id;

    for (const empresaId of [ecolumeId, padraoId]) {
      const existe = await operacional.etapaFunil.findFirst({
        where: { empresaId, chaveSistema: 'NOVO_CONTATO' },
      });
      if (!existe) {
        await operacional.etapaFunil.create({
          data: {
            empresaId,
            nome: 'Novo contato',
            ordem: 1,
            tipo: 'ABERTA',
            chaveSistema: 'NOVO_CONTATO',
            ativo: true,
          },
        });
      }
      if (empresaId === padraoId) {
        await operacional.etapaFunil.create({
          data: {
            empresaId,
            nome: 'Qualificação',
            ordem: 2,
            tipo: 'ABERTA',
            chaveSistema: 'QUALIFICACAO',
            ativo: true,
          },
        }).catch(() => undefined);
      }
    }

    const cli = await contatos.criar(ecolumeId, {
      nome: `Cliente ${sufixo}`,
      telefone: '11977770001',
      natureza: NaturezaPessoa.PF,
      tipo: TipoContato.OUTRO,
      dadosPersonalizados: {},
    });
    clienteId = cli.id as string;
    const par = await contatos.criar(ecolumeId, {
      nome: `Parceiro ${sufixo}`,
      telefone: '11977770002',
      natureza: NaturezaPessoa.PF,
      tipo: TipoContato.OUTRO,
      ehParceiro: true,
      tipoParceiro: TipoParceiro.ARQUITETO,
      rtPadrao: 10,
      dadosPersonalizados: {},
    });
    parceiroId = par.id as string;
  }, 60_000);

  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.atividade.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.eventoOportunidade.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.historicoEtapaOportunidade.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await operacional.itemOrcamento.deleteMany({ where: { orcamento: { empresaId } } }).catch(() => undefined);
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

  async function negocioComOrcEnviado(diasAtras: number, relogio = new Date()) {
    const neg = await negocios.criar(
      ecolumeId,
      {
        contatoId: clienteId,
        origemNegocio: OrigemNegocio.VIA_PARCEIRO,
        parceiroId,
        responsavelId: usuarioId,
        prioridade: PrioridadeOportunidade.MEDIA,
        titulo: `FU ${sufixo} ${diasAtras}`,
      },
      { usuarioId },
    );
    const orc = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg.id,
      itens: [{ nome: 'Item', quantidade: 1, precoUnitario: 10, unidade: 'un', precoManual: true }],
    });
    await orcamentos.marcarEnviado(ecolumeId, orc.id);
    const enviadoEm = new Date(relogio.getTime() - diasAtras * 86_400_000);
    await operacional.orcamento.update({
      where: { id: orc.id },
      data: { enviadoEm, status: StatusOrcamento.ENVIADO },
    });
    return { neg, orc };
  }

  it('1+2+3: antes/limite/após 7 dias e prazo config', async () => {
    const agora = new Date('2026-10-27T15:00:00.000Z');
    await negocioComOrcEnviado(6, agora);
    let r = await followUps.garantirFollowUpsOrcamentoEcolume(ecolumeId, agora);
    const antes = await operacional.atividade.count({
      where: { empresaId: ecolumeId, titulo: { startsWith: 'Follow-up ORC' }, concluida: false },
    });
    expect(antes).toBe(0);

    const { neg } = await negocioComOrcEnviado(7, agora);
    r = await followUps.garantirFollowUpsOrcamentoEcolume(ecolumeId, agora);
    expect(r.criados).toBeGreaterThanOrEqual(1);
    expect(r.dias).toBe(7);

    const fu = await operacional.atividade.findFirst({
      where: {
        empresaId: ecolumeId,
        oportunidadeId: neg.id,
        tipo: TipoAtividade.FOLLOW_UP,
        concluida: false,
      },
    });
    expect(fu?.titulo).toContain(tituloFollowUpOrc(neg.codigo).slice(0, 12));

    // Após o limite (8 dias)
    const { neg: n8 } = await negocioComOrcEnviado(8, agora);
    r = await followUps.garantirFollowUpsOrcamentoEcolume(ecolumeId, agora);
    expect(
      await operacional.atividade.findFirst({
        where: { empresaId: ecolumeId, oportunidadeId: n8.id, concluida: false },
      }),
    ).toBeTruthy();

    await platform.empresa.update({
      where: { id: ecolumeId },
      data: { configuracoes: {
        personalizacaoComercial: 'ECOLUME',
        onboardingConcluido: true,
        diasOrcamentoSemMovimentacao: 3,
      } },
    });
    const { neg: n3 } = await negocioComOrcEnviado(3, agora);
    r = await followUps.garantirFollowUpsOrcamentoEcolume(ecolumeId, agora);
    expect(
      await operacional.atividade.findFirst({
        where: { empresaId: ecolumeId, oportunidadeId: n3.id, concluida: false },
      }),
    ).toBeTruthy();

    await platform.empresa.update({
      where: { id: ecolumeId },
      data: { configuracoes: {
        personalizacaoComercial: 'ECOLUME',
        onboardingConcluido: true,
        diasOrcamentoSemMovimentacao: 7,
      } },
    });
  }, 90_000);

  it('4+5: convertidos/recusados/perdidos e vários ORC sem duplicar', async () => {
    const { neg, orc } = await negocioComOrcEnviado(10);
    const orc2 = await orcamentos.criar(ecolumeId, usuarioId, {
      oportunidadeId: neg.id,
      itens: [{ nome: 'B', quantidade: 1, precoUnitario: 5, unidade: 'un', precoManual: true }],
    });
    await orcamentos.marcarEnviado(ecolumeId, orc2.id);
    await operacional.orcamento.update({
      where: { id: orc2.id },
      data: {
        status: StatusOrcamento.ENVIADO,
        enviadoEm: new Date(Date.now() - 10 * 86_400_000),
      },
    });

    const r1 = await followUps.garantirFollowUpsOrcamentoEcolume(ecolumeId);
    const r2 = await followUps.garantirFollowUpsOrcamentoEcolume(ecolumeId);
    expect(r2.criados).toBe(0);
    const pendentes = await operacional.atividade.count({
      where: {
        empresaId: ecolumeId,
        oportunidadeId: neg.id,
        tipo: TipoAtividade.FOLLOW_UP,
        concluida: false,
      },
    });
    expect(pendentes).toBe(1);

    await operacional.orcamento.update({
      where: { id: orc.id },
      data: { status: StatusOrcamento.CONVERTIDO },
    });
    await operacional.orcamento.update({
      where: { id: orc2.id },
      data: { status: StatusOrcamento.RECUSADO },
    });
    // limpa pendente e não deve recriar (sem ENVIADO)
    await operacional.atividade.updateMany({
      where: { oportunidadeId: neg.id, concluida: false },
      data: { concluida: true, concluidaEm: new Date(), resultadoConclusao: 'limpo' },
    });
    const r3 = await followUps.garantirFollowUpsOrcamentoEcolume(ecolumeId);
    expect(
      await operacional.atividade.count({
        where: { oportunidadeId: neg.id, concluida: false, titulo: { startsWith: 'Follow-up ORC' } },
      }),
    ).toBe(0);
    void r1;
    void r3;

    const { neg: perd } = await negocioComOrcEnviado(10);
    await operacional.oportunidade.update({
      where: { id: perd.id },
      data: { fechadaEm: new Date() },
    });
    await followUps.garantirFollowUpsOrcamentoEcolume(ecolumeId);
    expect(
      await operacional.atividade.count({
        where: {
          oportunidadeId: perd.id,
          concluida: false,
          titulo: { startsWith: 'Follow-up ORC' },
        },
      }),
    ).toBe(0);
  }, 90_000);

  it('6+7+8: concorrência, conclusão com resultado, sem recriação imediata', async () => {
    const { neg } = await negocioComOrcEnviado(8);
    const [a, b] = await Promise.all([
      followUps.garantirFollowUpsOrcamentoEcolume(ecolumeId),
      followUps.garantirFollowUpsOrcamentoEcolume(ecolumeId),
    ]);
    expect((a.criados ?? 0) + (b.criados ?? 0)).toBeLessThanOrEqual(1);
    const fu = await operacional.atividade.findFirstOrThrow({
      where: { oportunidadeId: neg.id, concluida: false, tipo: TipoAtividade.FOLLOW_UP },
    });

    const conc = await atividades.concluirFollowUp(
      ecolumeId,
      fu.id,
      { resultado: 'Cliente pediu nova visita' },
      usuarioId,
    );
    expect(conc.resultadoConclusao).toBe('Cliente pediu nova visita');
    const dup = await atividades.concluirFollowUp(
      ecolumeId,
      fu.id,
      { resultado: 'outro' },
      usuarioId,
    );
    expect((dup as { idempotente?: boolean }).idempotente).toBe(true);
    expect(dup.resultadoConclusao).toBe('Cliente pediu nova visita');

    const ev = await operacional.eventoOportunidade.findFirst({
      where: {
        oportunidadeId: neg.id,
        descricao: 'Cliente pediu nova visita',
      },
    });
    expect(ev).toBeTruthy();

    const r = await followUps.garantirFollowUpsOrcamentoEcolume(ecolumeId);
    expect(r.criados).toBe(0);
  }, 90_000);

  it('9+10+11: sininho, multiempresa e legado sem misturar', async () => {
    const resumo = await atividades.resumoAgenda(ecolumeId, {
      id: usuarioId,
      perfil: PerfilUsuario.PROPRIETARIO,
    });
    expect(resumo).toHaveProperty('doDia');
    expect(resumo).toHaveProperty('atrasadas');
    expect(resumo).toHaveProperty('itens');

    // Legado: cria negócio parado na empresa sem flag
    const etapa = await operacional.etapaFunil.findFirstOrThrow({
      where: { empresaId: padraoId, ativo: true },
    });
    const userPad = await platform.usuario.create({
      data: {
        empresaId: padraoId,
        nome: `Pad ${sufixo}`,
        email: `fu21p-${sufixo}@teste.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    const cliPad = await operacional.contato.create({
      data: {
        empresaId: padraoId,
        nome: 'Cli pad',
        telefone: '11966660001',
        telefoneNormalizado: `1196666${sufixo.slice(0, 4)}`,
        tipo: 'OUTRO',
      },
    });
    const oppPad = await operacional.oportunidade.create({
      data: {
        empresaId: padraoId,
        codigo: `OP-${sufixo.slice(0, 4)}`,
        titulo: 'Parado',
        contatoId: cliPad.id,
        etapaId: etapa.id,
        responsavelId: userPad.id,
        atualizadoEm: new Date(Date.now() - 10 * 86_400_000),
      },
    });
    // forçar atualizadoEm antigo (updatedAt)
    await operacional.$executeRaw`
      UPDATE oportunidades SET "atualizadoEm" = NOW() - INTERVAL '10 days' WHERE id = ${oppPad.id}
    `;

    await followUps.garantirParaEmpresa(padraoId);
    const legado = await operacional.atividade.findFirst({
      where: {
        empresaId: padraoId,
        titulo: { startsWith: 'Negócio parado' },
        concluida: false,
      },
    });
    expect(legado).toBeTruthy();

    await followUps.garantirParaEmpresa(ecolumeId);
    const legadoNaEco = await operacional.atividade.count({
      where: {
        empresaId: ecolumeId,
        titulo: { startsWith: 'Negócio parado' },
      },
    });
    expect(legadoNaEco).toBe(0);
  }, 90_000);
});
