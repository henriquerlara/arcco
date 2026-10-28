import { Injectable } from '@nestjs/common';
import {
  ChaveEtapaSistema,
  ConclusaoEntrega,
  criarRespostaPaginada,
  FaseKanbanPedido,
  PerfilUsuario,
  StatusPedido,
  TipoAtividade,
  TipoChecklistPedido,
  type atualizarAtividadeSchema,
  type concluirEntregaSchema,
  type concluirFollowUpSchema,
  type criarAtividadeSchema,
  type paginacaoQuerySchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { EventosService, TipoEvento } from '../eventos/eventos.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { lerAjustes, persistirAjustes } from '../../common/utils/ajustes-persistir';

type CriarAtividadeInput = z.infer<typeof criarAtividadeSchema>;
type AtualizarAtividadeInput = z.infer<typeof atualizarAtividadeSchema>;
type ConcluirEntregaInput = z.infer<typeof concluirEntregaSchema>;
type ConcluirFollowUpInput = z.infer<typeof concluirFollowUpSchema>;
type PaginacaoQuery = z.infer<typeof paginacaoQuerySchema> & {
  concluida?: string;
  responsavelId?: string;
  oportunidadeId?: string;
  pedidoId?: string;
  tipo?: string;
  atrasadas?: string;
  /** ECOL-20 — só entregas pendentes, ordenadas por data. */
  entregasAFazer?: string;
  /** ECOL-22 — intervalo inclusivo ISO (calendário). */
  de?: string;
  ate?: string;
};

const INCLUDE_PADRAO = {
  contato: { select: { id: true, nome: true, telefone: true } },
  oportunidade: {
    select: {
      id: true,
      codigo: true,
      titulo: true,
      contato: { select: { id: true, nome: true, telefone: true } },
    },
  },
  obra: { select: { id: true, nome: true } },
  pedido: {
    select: {
      id: true,
      numero: true,
      status: true,
      oportunidadeId: true,
      total: true,
    },
  },
} satisfies Prisma.AtividadeInclude;

type Tx = Prisma.TransactionClient;

@Injectable()
export class AtividadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventosService,
    private readonly permissoes: PermissoesService,
  ) {}

  /** ECOL-26b — filtro de escopo agenda (TODAS / PROPRIAS / ENTREGAS). */
  private async aplicarEscopoAgenda(
    where: Prisma.AtividadeWhereInput,
    empresaId: string,
    usuario?: { id: string; perfil: string } | null,
  ): Promise<void> {
    if (!usuario) return;
    const escopo = await this.permissoes.escopoAgenda({
      id: usuario.id,
      empresaId,
      perfil: usuario.perfil,
    });
    if (escopo === 'TODAS') return;
    if (escopo === 'ENTREGAS') {
      where.tipo = TipoAtividade.ENTREGA;
      where.responsavelId = usuario.id;
      return;
    }
    where.responsavelId = usuario.id;
  }

  async listar(
    empresaId: string,
    query: PaginacaoQuery,
    usuario?: { id: string; perfil: string } | null,
  ) {
    const where: Prisma.AtividadeWhereInput = { empresaId };
    if (query.entregasAFazer === 'true' || query.entregasAFazer === '1') {
      where.tipo = TipoAtividade.ENTREGA;
      where.concluida = false;
    } else if (query.atrasadas === 'true' || query.atrasadas === '1') {
      where.concluida = false;
      where.vencimento = { lt: new Date() };
    } else {
      if (query.concluida === 'true') where.concluida = true;
      if (query.concluida === 'false') where.concluida = false;
    }
    if (query.responsavelId) where.responsavelId = query.responsavelId;
    await this.aplicarEscopoAgenda(where, empresaId, usuario);
    // Escopo restrito prevalece sobre filtro amplo de outro responsável
    if (usuario && where.responsavelId && where.responsavelId !== usuario.id) {
      const escopo = await this.permissoes.escopoAgenda({
        id: usuario.id,
        empresaId,
        perfil: usuario.perfil,
      });
      if (escopo !== 'TODAS') {
        where.responsavelId = usuario.id;
      }
    }
    if (query.oportunidadeId) where.oportunidadeId = query.oportunidadeId;
    if (query.pedidoId) where.pedidoId = query.pedidoId;
    if (query.tipo && Object.values(TipoAtividade).includes(query.tipo as TipoAtividade)) {
      where.tipo = query.tipo as TipoAtividade;
    }

    const de = query.de ? new Date(query.de) : null;
    const ate = query.ate ? new Date(query.ate) : null;
    const deOk = Boolean(de && !Number.isNaN(de.getTime()));
    const ateOk = Boolean(ate && !Number.isNaN(ate.getTime()));
    if (deOk || ateOk) {
      const faixa: Prisma.DateTimeFilter = {};
      if (deOk) faixa.gte = de!;
      if (ateOk) faixa.lte = ate!;
      const atual = where.vencimento;
      if (atual && typeof atual === 'object' && 'lt' in atual) {
        where.vencimento = { ...faixa, lt: atual.lt };
      } else {
        where.vencimento = faixa;
      }
    }

    const [dados, total] = await this.prisma.$transaction([
      this.prisma.atividade.findMany({
        where,
        include: INCLUDE_PADRAO,
        orderBy: [{ concluida: 'asc' }, { vencimento: 'asc' }],
        skip: (query.pagina - 1) * query.porPagina,
        take: query.porPagina,
      }),
      this.prisma.atividade.count({ where }),
    ]);

    return criarRespostaPaginada(dados, total, query.pagina, query.porPagina);
  }

  async obter(
    empresaId: string,
    id: string,
    usuario?: { id: string; perfil: string } | null,
  ) {
    const atividade = await this.prisma.atividade.findFirst({
      where: { id, empresaId },
      include: INCLUDE_PADRAO,
    });
    if (!atividade) throw Erros.naoEncontrado('ATIVIDADE_NAO_ENCONTRADA', 'Atividade nao encontrada');
    if (usuario) {
      const escopo = await this.permissoes.escopoAgenda({
        id: usuario.id,
        empresaId,
        perfil: usuario.perfil,
      });
      if (escopo === 'PROPRIAS' && atividade.responsavelId !== usuario.id) {
        throw Erros.naoEncontrado('ATIVIDADE_NAO_ENCONTRADA', 'Atividade nao encontrada');
      }
      if (
        escopo === 'ENTREGAS' &&
        (atividade.tipo !== TipoAtividade.ENTREGA || atividade.responsavelId !== usuario.id)
      ) {
        throw Erros.naoEncontrado('ATIVIDADE_NAO_ENCONTRADA', 'Atividade nao encontrada');
      }
    }
    if (atividade.tipo === TipoAtividade.ENTREGA && atividade.pedidoId) {
      const itens = await this.itensConferencia(empresaId, atividade.pedidoId);
      return { ...atividade, itensConferencia: itens };
    }
    return atividade;
  }

  /**
   * ECOL-20 — sugestão de endereço/contato a partir do pedido (obra → cliente).
   * Não grava nada.
   */
  async sugerirEntrega(empresaId: string, pedidoId: string) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.invalido('AGENDA_ENTREGA_INDISPONIVEL', 'Entregas so na personalizacao ECOLUME');
    }
    const pedido = await this.prisma.pedido.findFirst({
      where: { id: pedidoId, empresaId },
      include: {
        oportunidade: {
          include: {
            contato: true,
          },
        },
      },
    });
    if (!pedido) throw Erros.naoEncontrado('PEDIDO_NAO_ENCONTRADO', 'Pedido nao encontrado');
    if (pedido.status === StatusPedido.CANCELADO) {
      throw Erros.invalido('PEDIDO_CANCELADO', 'Pedido cancelado');
    }
    const opp = pedido.oportunidade;
    const cli = opp.contato;
    const temObra = Boolean(opp.obraLogradouro || opp.obraCidade);
    const endereco = temObra
      ? {
          origem: 'OBRA' as const,
          cep: opp.obraCep,
          logradouro: opp.obraLogradouro,
          numero: opp.obraNumero,
          complemento: opp.obraComplemento,
          bairro: opp.obraBairro,
          cidade: opp.obraCidade,
          uf: opp.obraUf,
        }
      : {
          origem: 'CLIENTE' as const,
          cep: cli.cep,
          logradouro: cli.logradouro,
          numero: cli.numero,
          complemento: cli.complemento,
          bairro: cli.bairro,
          cidade: cli.cidade,
          uf: cli.uf,
        };

    return {
      pedidoId: pedido.id,
      numero: pedido.numero,
      oportunidadeId: pedido.oportunidadeId,
      negocioCodigo: opp.codigo,
      negocioTitulo: opp.titulo,
      contatoId: cli.id,
      tituloSugerido: `Entrega ${pedido.numero}`,
      responsavelIdSugerido: opp.responsavelId,
      contatoLocalNome: cli.nome,
      contatoLocalTelefone: cli.telefone,
      endereco,
      itensConferencia: await this.itensConferencia(empresaId, pedido.id),
    };
  }

  async itensConferencia(empresaId: string, pedidoId: string) {
    const itens = await this.prisma.itemPedido.findMany({
      where: { pedidoId, pedido: { empresaId } },
      orderBy: { ordem: 'asc' },
      include: {
        produto: { select: { nomeFiscal: true, descricaoComercial: true, nome: true } },
      },
    });
    return itens.map((i) => ({
      id: i.id,
      descricaoComercial: i.produto?.descricaoComercial || i.nome,
      nomeFiscal: i.produto?.nomeFiscal || i.produto?.nome || i.nome,
      quantidade: i.quantidade,
      unidade: i.unidade,
    }));
  }

  async criar(empresaId: string, responsavelPadrao: string, dto: CriarAtividadeInput) {
    const ecolume = await this.permissoes.empresaEcolume(empresaId);
    if (dto.tipo === TipoAtividade.ENTREGA || dto.tipo === TipoAtividade.VISITA) {
      if (!ecolume) {
        throw Erros.invalido('TIPO_ATIVIDADE_INDISPONIVEL', 'Tipo so na personalizacao ECOLUME');
      }
    }

    let contatoId = dto.contatoId ?? null;
    let oportunidadeId = dto.oportunidadeId ?? null;
    let pedidoId = dto.pedidoId ?? null;

    if (dto.tipo === TipoAtividade.ENTREGA) {
      if (!pedidoId) throw Erros.invalido('PEDIDO_OBRIGATORIO', 'Entrega exige pedido');
      const pedido = await this.prisma.pedido.findFirst({
        where: { id: pedidoId, empresaId },
        select: { id: true, status: true, oportunidadeId: true, oportunidade: { select: { contatoId: true } } },
      });
      if (!pedido) throw Erros.naoEncontrado('PEDIDO_NAO_ENCONTRADO', 'Pedido nao encontrado');
      if (pedido.status === StatusPedido.CANCELADO) {
        throw Erros.invalido('PEDIDO_CANCELADO', 'Pedido cancelado');
      }
      oportunidadeId = oportunidadeId ?? pedido.oportunidadeId;
      contatoId = contatoId ?? pedido.oportunidade.contatoId;
    } else if (!contatoId && oportunidadeId) {
      const oportunidade = await this.prisma.oportunidade.findFirst({
        where: { id: oportunidadeId, empresaId },
        select: { contatoId: true },
      });
      contatoId = oportunidade?.contatoId ?? null;
    }

    if (oportunidadeId) {
      const opp = await this.prisma.oportunidade.findFirst({
        where: { id: oportunidadeId, empresaId },
        select: { id: true },
      });
      if (!opp) throw Erros.naoEncontrado('OPORTUNIDADE_NAO_ENCONTRADA', 'Negocio nao encontrado');
    }
    if (contatoId) {
      const c = await this.prisma.contato.findFirst({
        where: { id: contatoId, empresaId },
        select: { id: true },
      });
      if (!c) throw Erros.naoEncontrado('CONTATO_NAO_ENCONTRADO', 'Cliente nao encontrado');
    }

    const criada = await this.prisma.atividade.create({
      data: {
        empresaId,
        tipo: dto.tipo,
        titulo: dto.titulo,
        descricao: dto.descricao ?? null,
        vencimento: dto.vencimento,
        responsavelId: dto.responsavelId ?? responsavelPadrao,
        oportunidadeId,
        contatoId,
        obraId: dto.obraId ?? null,
        pedidoId,
        diaInteiro: dto.diaInteiro ?? false,
        periodoDia: dto.periodoDia ?? null,
        local: dto.local ?? null,
        entregaCep: dto.entregaCep ?? null,
        entregaLogradouro: dto.entregaLogradouro ?? null,
        entregaNumero: dto.entregaNumero ?? null,
        entregaComplemento: dto.entregaComplemento ?? null,
        entregaBairro: dto.entregaBairro ?? null,
        entregaCidade: dto.entregaCidade ?? null,
        entregaUf: dto.entregaUf ?? null,
        contatoLocalNome: dto.contatoLocalNome ?? null,
        contatoLocalTelefone: dto.contatoLocalTelefone ?? null,
      },
      include: INCLUDE_PADRAO,
    });
    if (criada.oportunidadeId) {
      await this.eventos.registrar(this.prisma, {
        empresaId,
        oportunidadeId: criada.oportunidadeId,
        tipo: TipoEvento.ATIVIDADE_CRIADA,
        titulo: `Próxima ação: ${criada.titulo}`,
        descricao: `Prevista para ${criada.vencimento.toLocaleString('pt-BR')}`,
        origem: 'USUARIO',
        usuarioId: responsavelPadrao,
      });
      await this.eventos.sincronizarProximaAcao(empresaId, criada.oportunidadeId);
    }
    return criada;
  }

  async atualizar(
    empresaId: string,
    id: string,
    dto: AtualizarAtividadeInput,
    usuario?: { id: string; perfil: string } | null,
  ) {
    const atual = await this.obter(empresaId, id, usuario);

    const data: Prisma.AtividadeUncheckedUpdateInput = {
      tipo: dto.tipo,
      titulo: dto.titulo,
      descricao: dto.descricao,
      vencimento: dto.vencimento,
      responsavelId: dto.responsavelId,
      oportunidadeId: dto.oportunidadeId,
      contatoId: dto.contatoId,
      obraId: dto.obraId,
      pedidoId: dto.pedidoId,
      diaInteiro: dto.diaInteiro,
      periodoDia: dto.periodoDia,
      local: dto.local,
      entregaCep: dto.entregaCep,
      entregaLogradouro: dto.entregaLogradouro,
      entregaNumero: dto.entregaNumero,
      entregaComplemento: dto.entregaComplemento,
      entregaBairro: dto.entregaBairro,
      entregaCidade: dto.entregaCidade,
      entregaUf: dto.entregaUf,
      contatoLocalNome: dto.contatoLocalNome,
      contatoLocalTelefone: dto.contatoLocalTelefone,
    };

    if (dto.concluida !== undefined && dto.concluida !== atual.concluida) {
      if (atual.tipo === TipoAtividade.ENTREGA && dto.concluida === true) {
        throw Erros.invalido(
          'USE_CONCLUIR_ENTREGA',
          'Conclua entregas pela rota de entrega parcial/final',
        );
      }
      data.concluida = dto.concluida;
      data.concluidaEm = dto.concluida ? new Date() : null;
    }

    const atualizada = await this.prisma.atividade.update({
      where: { id },
      data,
      include: INCLUDE_PADRAO,
    });
    const oportunidades = new Set([atual.oportunidadeId, atualizada.oportunidadeId].filter(Boolean));
    for (const oportunidadeId of oportunidades) {
      await this.eventos.sincronizarProximaAcao(empresaId, oportunidadeId!);
    }
    if (dto.concluida === true && !atual.concluida && atualizada.oportunidadeId) {
      await this.eventos.registrar(this.prisma, {
        empresaId,
        oportunidadeId: atualizada.oportunidadeId,
        tipo: TipoEvento.ATIVIDADE_CONCLUIDA,
        titulo: atualizada.titulo,
        descricao: 'Ação concluída',
        origem: 'USUARIO',
      });
      if (atualizada.tipo === 'REVISAR_ORCAMENTO') {
        await this.marcarAjusteCorrigidoNaOportunidade(
          empresaId,
          atualizada.oportunidadeId,
          atualizada.descricao,
        );
      }
    }
    return atualizada;
  }

  async concluir(empresaId: string, id: string, usuarioId?: string) {
    const atual = await this.obter(empresaId, id);
    if (atual.tipo === TipoAtividade.ENTREGA) {
      throw Erros.invalido(
        'USE_CONCLUIR_ENTREGA',
        'Conclua entregas pela rota de entrega parcial/final',
      );
    }
    if (
      atual.tipo === TipoAtividade.FOLLOW_UP &&
      (await this.permissoes.empresaEcolume(empresaId))
    ) {
      throw Erros.invalido(
        'USE_CONCLUIR_FOLLOW_UP',
        'Conclua follow-up informando o resultado',
      );
    }
    if (atual.concluida) return atual;
    const concluida = await this.prisma.atividade.update({
      where: { id },
      data: {
        concluida: true,
        concluidaEm: new Date(),
        concluidaPorId: usuarioId ?? null,
      },
      include: INCLUDE_PADRAO,
    });
    if (atual.oportunidadeId) {
      await this.eventos.registrar(this.prisma, {
        empresaId,
        oportunidadeId: atual.oportunidadeId,
        tipo: TipoEvento.ATIVIDADE_CONCLUIDA,
        titulo: atual.titulo,
        descricao: 'Ação concluída',
        origem: 'USUARIO',
        usuarioId,
      });
      if (concluida.tipo === 'REVISAR_ORCAMENTO') {
        await this.marcarAjusteCorrigidoNaOportunidade(
          empresaId,
          atual.oportunidadeId,
          atual.descricao,
        );
      }
      await this.eventos.sincronizarProximaAcao(empresaId, atual.oportunidadeId);
    }
    return concluida;
  }

  /**
   * ECOL-20 — conclusão parcial (só atividade) ou final (checklist + Kanban Entregue).
   * Idempotente se já concluída.
   */
  async concluirEntrega(
    empresaId: string,
    id: string,
    dto: ConcluirEntregaInput,
    usuarioId: string,
  ) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.invalido('AGENDA_ENTREGA_INDISPONIVEL', 'Entregas so na personalizacao ECOLUME');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`${empresaId}:ativ-entrega:${id}`}))
      `;

      const atual = await tx.atividade.findFirst({
        where: { id, empresaId },
        include: INCLUDE_PADRAO,
      });
      if (!atual) throw Erros.naoEncontrado('ATIVIDADE_NAO_ENCONTRADA', 'Atividade nao encontrada');
      if (atual.tipo !== TipoAtividade.ENTREGA) {
        throw Erros.invalido('NAO_E_ENTREGA', 'Atividade nao e entrega');
      }
      if (!atual.pedidoId) {
        throw Erros.invalido('PEDIDO_OBRIGATORIO', 'Entrega sem pedido');
      }

      if (atual.concluida) {
        return {
          ...atual,
          itensConferencia: await this.itensConferenciaTx(tx, empresaId, atual.pedidoId),
          idempotente: true,
        };
      }

      const pedido = await tx.pedido.findFirst({
        where: { id: atual.pedidoId, empresaId },
        include: { checklist: true },
      });
      if (!pedido) throw Erros.naoEncontrado('PEDIDO_NAO_ENCONTRADO', 'Pedido nao encontrado');
      if (pedido.status === StatusPedido.CANCELADO) {
        throw Erros.invalido('PEDIDO_CANCELADO', 'Pedido cancelado nao recebe entrega');
      }

      const modo = dto.final ? ConclusaoEntrega.FINAL : ConclusaoEntrega.PARCIAL;
      const agora = new Date();

      await tx.atividade.update({
        where: { id },
        data: {
          concluida: true,
          concluidaEm: agora,
          concluidaPorId: usuarioId,
          conclusaoEntrega: modo,
        },
      });

      if (dto.final) {
        const itemEntrega = pedido.checklist.find(
          (c) => c.tipo === TipoChecklistPedido.ENTREGUE && c.aplicavel,
        );
        if (itemEntrega && !itemEntrega.concluido) {
          await tx.checklistItemPedido.update({
            where: { id: itemEntrega.id },
            data: { concluido: true, concluidoEm: agora, usuarioId },
          });
        }

        if (pedido.status !== StatusPedido.FINALIZADO) {
          const faseAntes = pedido.faseKanban || FaseKanbanPedido.PEDIDO_CONFIRMADO;
          if (faseAntes !== FaseKanbanPedido.ENTREGUE) {
            await tx.pedido.update({
              where: { id: pedido.id },
              data: { faseKanban: FaseKanbanPedido.ENTREGUE },
            });
            await tx.historicoFasePedido.create({
              data: {
                empresaId,
                pedidoId: pedido.id,
                faseAnterior: faseAntes,
                faseNova: FaseKanbanPedido.ENTREGUE,
                origem: 'ENTREGA',
                usuarioId,
                motivo: 'Entrega final',
              },
            });
          }

          const checklist = await tx.checklistItemPedido.findMany({ where: { pedidoId: pedido.id } });
          const aplicaveis = checklist.filter((c) => c.aplicavel);
          const completo =
            aplicaveis.length > 0 && aplicaveis.every((c) => c.concluido);
          if (completo) {
            await tx.pedido.update({
              where: { id: pedido.id },
              data: { status: StatusPedido.FINALIZADO, finalizadoEm: agora },
            });
            await tx.historicoFasePedido.create({
              data: {
                empresaId,
                pedidoId: pedido.id,
                faseAnterior: FaseKanbanPedido.ENTREGUE,
                faseNova: ChaveEtapaSistema.PEDIDO_FINALIZADO,
                origem: 'CHECKLIST',
                usuarioId,
                motivo: 'Checklist 100% apos entrega final',
              },
            });
          }
        }
      }

      if (atual.oportunidadeId) {
        await this.eventos.registrar(tx, {
          empresaId,
          oportunidadeId: atual.oportunidadeId,
          tipo: TipoEvento.ATIVIDADE_CONCLUIDA,
          titulo: atual.titulo,
          descricao: dto.final ? 'Entrega final' : 'Entrega parcial',
          origem: 'USUARIO',
          usuarioId,
          dados: { conclusaoEntrega: modo, pedidoId: atual.pedidoId },
        });
      }

      const final = await tx.atividade.findFirstOrThrow({
        where: { id, empresaId },
        include: INCLUDE_PADRAO,
      });
      return {
        ...final,
        itensConferencia: await this.itensConferenciaTx(tx, empresaId, atual.pedidoId),
        idempotente: false,
        _oportunidadeId: atual.oportunidadeId,
      };
    }).then(async (resultado) => {
      const oppId = (resultado as { _oportunidadeId?: string | null })._oportunidadeId;
      if (oppId) await this.eventos.sincronizarProximaAcao(empresaId, oppId);
      const { _oportunidadeId: _, ...rest } = resultado as typeof resultado & {
        _oportunidadeId?: string | null;
      };
      return rest;
    });
  }

  /**
   * ECOL-21 — concluir FOLLOW_UP com resultado no histórico do negócio.
   * Idempotente se já concluída (não duplica evento).
   */
  async concluirFollowUp(
    empresaId: string,
    id: string,
    dto: ConcluirFollowUpInput,
    usuarioId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`${empresaId}:ativ-fu:${id}`}))
      `;
      const atual = await tx.atividade.findFirst({
        where: { id, empresaId },
        include: INCLUDE_PADRAO,
      });
      if (!atual) throw Erros.naoEncontrado('ATIVIDADE_NAO_ENCONTRADA', 'Atividade nao encontrada');
      if (atual.tipo !== TipoAtividade.FOLLOW_UP) {
        throw Erros.invalido('NAO_E_FOLLOW_UP', 'Atividade nao e follow-up');
      }

      if (atual.concluida) {
        return { ...atual, idempotente: true };
      }

      const agora = new Date();
      const atualizada = await tx.atividade.update({
        where: { id },
        data: {
          concluida: true,
          concluidaEm: agora,
          concluidaPorId: usuarioId,
          resultadoConclusao: dto.resultado,
        },
        include: INCLUDE_PADRAO,
      });

      if (atual.oportunidadeId) {
        await this.eventos.registrar(tx, {
          empresaId,
          oportunidadeId: atual.oportunidadeId,
          tipo: TipoEvento.ATIVIDADE_CONCLUIDA,
          titulo: `Resultado: ${atual.titulo}`,
          descricao: dto.resultado,
          origem: 'USUARIO',
          usuarioId,
          dados: {
            atividadeId: id,
            resultadoFollowUp: dto.resultado,
            concluidaEm: agora.toISOString(),
          },
        });
      }

      return { ...atualizada, idempotente: false, _oportunidadeId: atual.oportunidadeId };
    }).then(async (resultado) => {
      const oppId = (resultado as { _oportunidadeId?: string | null })._oportunidadeId;
      if (oppId) await this.eventos.sincronizarProximaAcao(empresaId, oppId);
      const { _oportunidadeId: _, ...rest } = resultado as typeof resultado & {
        _oportunidadeId?: string | null;
      };
      return rest;
    });
  }

  /**
   * ECOL-21 / ECOL-26b — compromissos do dia + atrasados conforme escopo de agenda.
   * `todas=1` só amplia se o usuário tiver ESCOPO_AGENDA_TODAS (admin incluso).
   */
  async resumoAgenda(
    empresaId: string,
    usuario: { id: string; perfil: string },
    opcoes: { todas?: boolean } = {},
  ) {
    const agora = new Date();
    const inicioDia = new Date(agora);
    inicioDia.setHours(0, 0, 0, 0);
    const fimDia = new Date(agora);
    fimDia.setHours(23, 59, 59, 999);

    const escopo = await this.permissoes.escopoAgenda({
      id: usuario.id,
      empresaId,
      perfil: usuario.perfil,
    });
    const verTodas = escopo === 'TODAS' && opcoes.todas === true;

    const whereBase: Prisma.AtividadeWhereInput = {
      empresaId,
      concluida: false,
    };
    if (!verTodas) {
      if (escopo === 'ENTREGAS') {
        whereBase.tipo = TipoAtividade.ENTREGA;
        whereBase.responsavelId = usuario.id;
      } else if (escopo === 'TODAS' && opcoes.todas !== true) {
        // Tem TODAS mas não pediu: default sininho = próprias
        whereBase.responsavelId = usuario.id;
      } else {
        whereBase.responsavelId = usuario.id;
      }
    }

    const [doDia, atrasadas, itens] = await this.prisma.$transaction([
      this.prisma.atividade.count({
        where: {
          ...whereBase,
          vencimento: { gte: inicioDia, lte: fimDia },
        },
      }),
      this.prisma.atividade.count({
        where: {
          ...whereBase,
          vencimento: { lt: inicioDia },
        },
      }),
      this.prisma.atividade.findMany({
        where: {
          ...whereBase,
          OR: [
            { vencimento: { gte: inicioDia, lte: fimDia } },
            { vencimento: { lt: inicioDia } },
          ],
        },
        include: INCLUDE_PADRAO,
        orderBy: { vencimento: 'asc' },
        take: 40,
      }),
    ]);

    return {
      doDia,
      atrasadas,
      total: doDia + atrasadas,
      itens: itens.map((a) => ({
        id: a.id,
        tipo: a.tipo,
        titulo: a.titulo,
        vencimento: a.vencimento,
        atrasada: a.vencimento < inicioDia,
        doDia: a.vencimento >= inicioDia && a.vencimento <= fimDia,
        oportunidadeId: a.oportunidadeId,
        negocioCodigo: a.oportunidade?.codigo ?? null,
        contatoNome: a.contato?.nome ?? a.oportunidade?.contato?.nome ?? null,
        pedidoId: a.pedidoId,
        pedidoNumero: a.pedido?.numero ?? null,
      })),
    };
  }

  async remover(empresaId: string, id: string) {
    const atual = await this.obter(empresaId, id);
    await this.prisma.atividade.delete({ where: { id } });
    if (atual.oportunidadeId) {
      await this.eventos.sincronizarProximaAcao(empresaId, atual.oportunidadeId);
    }
    return { ok: true };
  }

  private async itensConferenciaTx(tx: Tx, empresaId: string, pedidoId: string) {
    const itens = await tx.itemPedido.findMany({
      where: { pedidoId, pedido: { empresaId } },
      orderBy: { ordem: 'asc' },
      include: {
        produto: { select: { nomeFiscal: true, descricaoComercial: true, nome: true } },
      },
    });
    return itens.map((i) => ({
      id: i.id,
      descricaoComercial: i.produto?.descricaoComercial || i.nome,
      nomeFiscal: i.produto?.nomeFiscal || i.produto?.nome || i.nome,
      quantidade: i.quantidade,
      unidade: i.unidade,
    }));
  }

  private async marcarAjusteCorrigidoNaOportunidade(
    empresaId: string,
    oportunidadeId: string,
    texto?: string | null,
  ) {
    const atual = await this.prisma.oportunidade.findFirst({
      where: { id: oportunidadeId, empresaId },
      select: { descricao: true, dadosPersonalizados: true },
    });
    if (!atual) return;
    const atuais = { ...((atual.dadosPersonalizados ?? {}) as Record<string, unknown>) };
    const ajustes = lerAjustes(atuais, atual.descricao);
    if (ajustes.length === 0) {
      atuais.ajuste_status = 'corrigido';
      await this.prisma.oportunidade.update({
        where: { id: oportunidadeId },
        data: { dadosPersonalizados: atuais as object },
      });
      return;
    }

    const alvo =
      (texto?.trim()
        ? ajustes.find((item) => item.status === 'pendente' && item.texto === texto.trim())
        : undefined) ?? ajustes.find((item) => item.status === 'pendente');
    if (!alvo) return;
    alvo.status = 'corrigido';
    const dados = persistirAjustes(atuais, ajustes);
    await this.prisma.oportunidade.update({
      where: { id: oportunidadeId },
      data: { dadosPersonalizados: dados as object },
    });
  }
}
