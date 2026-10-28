import { Injectable, Logger } from '@nestjs/common';
import {
  lerDiasOrcamentoSemMovimentacao,
  referenciaSemMovimentacaoOrc,
  StatusOrcamento,
  TipoAtividade,
  TipoEtapaFunil,
  tituloFollowUpOrc,
} from '@arcco/contratos';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { PrismaService } from '../../database/prisma.service';
import { EventosService } from '../eventos/eventos.service';
import { PermissoesService } from '../permissoes/permissoes.service';

const TITULO_LEGADO_PREFIX = 'Negócio parado';

@Injectable()
export class FollowUpsService {
  private readonly logger = new Logger('FollowUps');

  constructor(
    private readonly prisma: PrismaService,
    private readonly platform: PlatformPrismaService,
    private readonly eventos: EventosService,
    private readonly permissoes: PermissoesService,
  ) {}

  /** Entrada do dashboard / scheduler: escolhe rotina por flag. */
  async garantirParaEmpresa(empresaId: string, agora = new Date()) {
    if (await this.permissoes.empresaEcolume(empresaId)) {
      return this.garantirFollowUpsOrcamentoEcolume(empresaId, agora);
    }
    const limite = new Date(agora.getTime() - 7 * 86_400_000);
    return this.garantirFollowUpsParadosLegado(empresaId, limite, agora);
  }

  /**
   * ECOL-21 — ORC ENVIADO sem movimentação há X dias.
   * Relógio: enviadoEm (fallback atualizadoEm). Dedup por NEG.
   * Não regenera na mesma “onda” após conclusão (concluidaEm >= ref. do ORC).
   */
  async garantirFollowUpsOrcamentoEcolume(empresaId: string, agora = new Date()) {
    const empresa = await this.platform.empresa.findUnique({
      where: { id: empresaId },
      select: { configuracoes: true },
    });
    const dias = lerDiasOrcamentoSemMovimentacao(empresa?.configuracoes);
    const limite = new Date(agora.getTime() - dias * 86_400_000);

    const sincronizar: string[] = [];
    const resultado = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`${empresaId}:follow-up-orc`}))
      `;

      const orcs = await tx.orcamento.findMany({
        where: {
          empresaId,
          status: StatusOrcamento.ENVIADO,
          OR: [
            { enviadoEm: { lte: limite } },
            { enviadoEm: null, atualizadoEm: { lte: limite } },
          ],
        },
        select: {
          id: true,
          numero: true,
          enviadoEm: true,
          atualizadoEm: true,
          oportunidadeId: true,
          oportunidade: {
            select: {
              id: true,
              codigo: true,
              contatoId: true,
              responsavelId: true,
              fechadaEm: true,
              etapa: { select: { tipo: true } },
            },
          },
        },
        take: 200,
      });

      const porNegocio = new Map<string, (typeof orcs)[number]>();
      for (const orc of orcs) {
        const opp = orc.oportunidade;
        if (!opp || opp.fechadaEm || opp.etapa.tipo === TipoEtapaFunil.PERDIDA) continue;
        const ref = referenciaSemMovimentacaoOrc(orc);
        if (!ref || ref > limite) continue;
        const atual = porNegocio.get(opp.id);
        if (!atual) {
          porNegocio.set(opp.id, orc);
          continue;
        }
        const refAtual = referenciaSemMovimentacaoOrc(atual)!;
        if (ref < refAtual) porNegocio.set(opp.id, orc);
      }

      if (porNegocio.size === 0) return { criados: 0, dias };

      const fallback =
        (
          await this.platform.usuario.findFirst({
            where: { empresaId, ativo: true },
            orderBy: { criadoEm: 'asc' },
            select: { id: true },
          })
        )?.id ?? null;

      let criados = 0;
      const vencimento = new Date(agora);
      vencimento.setHours(9, 0, 0, 0);

      for (const [oportunidadeId, orc] of porNegocio) {
        const opp = orc.oportunidade!;
        const pendente = await tx.atividade.findFirst({
          where: {
            empresaId,
            oportunidadeId,
            concluida: false,
            tipo: TipoAtividade.FOLLOW_UP,
          },
          select: { id: true },
        });
        if (pendente) continue;

        const ref = referenciaSemMovimentacaoOrc(orc)!;
        const jaTratado = await tx.atividade.findFirst({
          where: {
            empresaId,
            oportunidadeId,
            tipo: TipoAtividade.FOLLOW_UP,
            concluida: true,
            concluidaEm: { gte: ref },
            titulo: { startsWith: 'Follow-up ORC' },
          },
          select: { id: true },
        });
        if (jaTratado) continue;

        const responsavelId = opp.responsavelId ?? fallback;
        if (!responsavelId) continue;

        await tx.atividade.create({
          data: {
            empresaId,
            tipo: TipoAtividade.FOLLOW_UP,
            titulo: tituloFollowUpOrc(opp.codigo, orc.numero),
            descricao: `Orçamento ${orc.numero} enviado sem movimentação há mais de ${dias} dia(s). Retome o contato.`,
            vencimento,
            responsavelId,
            oportunidadeId,
            contatoId: opp.contatoId,
          },
        });
        sincronizar.push(oportunidadeId);
        criados += 1;
      }

      return { criados, dias };
    });

    for (const id of sincronizar) {
      await this.eventos.sincronizarProximaAcao(empresaId, id);
    }
    return resultado;
  }

  /** Legado: negócio parado por atualizadoEm (>7d). Não roda em ECOLUME. */
  async garantirFollowUpsParadosLegado(
    empresaId: string,
    limiteParada: Date,
    agora = new Date(),
  ) {
    try {
      const sincronizar: string[] = [];
      const resultado = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`${empresaId}:follow-up-legado`}))
        `;

        const paradas = await tx.oportunidade.findMany({
          where: {
            empresaId,
            fechadaEm: null,
            atualizadoEm: { lt: limiteParada },
            NOT: {
              atividades: {
                some: {
                  concluida: false,
                  tipo: TipoAtividade.FOLLOW_UP,
                  titulo: { startsWith: TITULO_LEGADO_PREFIX },
                },
              },
            },
          },
          select: {
            id: true,
            codigo: true,
            contatoId: true,
            responsavelId: true,
          },
          take: 25,
        });
        if (paradas.length === 0) return { criados: 0 };

        const fallback =
          (
            await this.platform.usuario.findFirst({
              where: { empresaId, ativo: true },
              orderBy: { criadoEm: 'asc' },
              select: { id: true },
            })
          )?.id ?? null;

        const vencimento = new Date(agora);
        vencimento.setHours(9, 0, 0, 0);
        let criados = 0;

        for (const opp of paradas) {
          const responsavelId = opp.responsavelId ?? fallback;
          if (!responsavelId) continue;
          await tx.atividade.create({
            data: {
              empresaId,
              tipo: TipoAtividade.FOLLOW_UP,
              titulo: `${TITULO_LEGADO_PREFIX} ${opp.codigo}`,
              descricao:
                'Sem movimentação há mais de 7 dias. Retome o contato ou atualize a etapa.',
              vencimento,
              responsavelId,
              oportunidadeId: opp.id,
              contatoId: opp.contatoId,
            },
          });
          sincronizar.push(opp.id);
          criados += 1;
        }
        return { criados };
      });
      for (const id of sincronizar) {
        await this.eventos.sincronizarProximaAcao(empresaId, id);
      }
      return resultado;
    } catch (erro) {
      this.logger.warn(
        `Falha ao agendar follow-ups legados: ${(erro as Error).message}`,
      );
      return { criados: 0 };
    }
  }

  /** Scheduler: percorre empresas ECOLUME e legadas. */
  async processarTodas(agora = new Date()) {
    const empresas = await this.platform.empresa.findMany({
      select: { id: true, configuracoes: true },
      take: 500,
    });
    let ecolume = 0;
    let legado = 0;
    for (const emp of empresas) {
      try {
        const r = await this.garantirParaEmpresa(emp.id, agora);
        if (await this.permissoes.empresaEcolume(emp.id)) ecolume += r.criados ?? 0;
        else legado += r.criados ?? 0;
      } catch (erro) {
        this.logger.warn(
          `Follow-up empresa ${emp.id}: ${(erro as Error).message}`,
        );
      }
    }
    return { ecolume, legado, empresas: empresas.length };
  }
}

