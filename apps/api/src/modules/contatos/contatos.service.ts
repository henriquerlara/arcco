import { Injectable } from '@nestjs/common';
import {
  ChaveEtapaSistema,
  StatusComissaoPedido,
  StatusPedido,
  criarRespostaPaginada,
  cnpjValido,
  cpfValido,
  digitosCpf,
  EntidadeCampoPersonalizado,
  NaturezaPessoa,
  lerRtPadraoParceiro,
  PermissaoComercial,
  RT_PADRAO_PARCEIRO,
  TipoContato,
  type criarContatoSchema,
  type paginacaoQuerySchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { normalizarTelefone } from '../../common/utils/telefone';
import { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';
import { PermissoesService } from '../permissoes/permissoes.service';

type CriarContatoInput = z.infer<typeof criarContatoSchema>;
type AtualizarContatoInput = Partial<CriarContatoInput>;
type PaginacaoQuery = z.infer<typeof paginacaoQuerySchema>;

type FiltrosListagem = PaginacaoQuery & {
  tipo?: string;
  natureza?: string;
  parceiro?: string;
  cidade?: string;
  /** ECOL-10b — período (ISO) das métricas de parceiros. */
  de?: string;
  ate?: string;
};

export type FiltrosComissoes = {
  de?: string;
  ate?: string;
  parceiroId?: string;
  /** Default A_PAGAR. 'TODAS' remove o filtro de status. */
  status?: string;
  pagina: number;
  porPagina: number;
};

type ContatoResumoDuplicidade = {
  id: string;
  nome: string;
  telefone: string;
  documento: string | null;
  natureza: NaturezaPessoa | null;
};

@Injectable()
export class ContatosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platform: PlatformPrismaService,
    private readonly campos: CamposPersonalizadosService,
    private readonly permissoes: PermissoesService,
  ) {}

  private async ecolume(empresaId: string): Promise<boolean> {
    return this.permissoes.empresaEcolume(empresaId);
  }

  private normalizarDocumento(valor: string | null | undefined): string | null {
    if (valor == null || String(valor).trim() === '') return null;
    const digitos = digitosCpf(String(valor));
    return digitos || null;
  }

  /** Serializa Decimal do Prisma sem expor dados bancários em logs. */
  private serializarContato<T extends Record<string, unknown>>(contato: T): T & { rtPadrao: number | null } {
    const rt = contato.rtPadrao;
    return {
      ...contato,
      rtPadrao: rt == null ? null : Number(rt),
    };
  }

  private async rtEmpresa(empresaId: string): Promise<number> {
    const emp = this.platform?.empresa
      ? await this.platform.empresa.findUnique({
          where: { id: empresaId },
          select: { configuracoes: true },
        })
      : null;
    return lerRtPadraoParceiro(emp?.configuracoes) || RT_PADRAO_PARCEIRO;
  }

  /** RT padrão: dto explícito > parâmetro ECOL-02 > 10% §16.4. */
  private rtPadraoInicial(
    dto: { rtPadrao?: number | null },
    rtEmpresa: number,
  ): number {
    if (dto.rtPadrao != null && !Number.isNaN(Number(dto.rtPadrao))) {
      return Number(dto.rtPadrao);
    }
    return rtEmpresa;
  }

  private camposParceria(
    dto: CriarContatoInput | AtualizarContatoInput,
    opts: { ativar: boolean; rtFallback?: number | null; rtEmpresa: number },
  ): Prisma.ContatoUpdateInput {
    const data: Prisma.ContatoUpdateInput = {};
    if (dto.tipoParceiro !== undefined) data.tipoParceiro = dto.tipoParceiro;
    if (dto.rtPadrao !== undefined) {
      data.rtPadrao =
        dto.rtPadrao == null ? null : new Prisma.Decimal(Number(dto.rtPadrao));
    } else if (opts.ativar && (opts.rtFallback == null || Number.isNaN(Number(opts.rtFallback)))) {
      data.rtPadrao = new Prisma.Decimal(this.rtPadraoInicial({}, opts.rtEmpresa));
    }
    if (dto.chavePix !== undefined) data.chavePix = dto.chavePix?.trim() || null;
    if (dto.banco !== undefined) data.banco = dto.banco?.trim() || null;
    if (dto.agencia !== undefined) data.agencia = dto.agencia?.trim() || null;
    if (dto.conta !== undefined) data.conta = dto.conta?.trim() || null;
    if (dto.titularNome !== undefined) data.titularNome = dto.titularNome?.trim() || null;
    if (dto.titularDocumento !== undefined) {
      data.titularDocumento = this.normalizarDocumento(dto.titularDocumento);
    }
    if (dto.observacoesParceria !== undefined) {
      data.observacoesParceria = dto.observacoesParceria?.trim() || null;
    }
    return data;
  }

  private validarDocumento(digitos: string | null, natureza?: NaturezaPessoa | null): void {
    if (!digitos) return;
    if (digitos.length === 11) {
      if (!cpfValido(digitos)) throw Erros.invalido('CPF_INVALIDO', 'CPF invalido');
      if (natureza === NaturezaPessoa.PJ) {
        throw Erros.invalido('DOCUMENTO_INCOMPATIVEL', 'PJ deve usar CNPJ');
      }
      return;
    }
    if (digitos.length === 14) {
      if (!cnpjValido(digitos)) throw Erros.invalido('CNPJ_INVALIDO', 'CNPJ invalido');
      if (natureza === NaturezaPessoa.PF) {
        throw Erros.invalido('DOCUMENTO_INCOMPATIVEL', 'PF deve usar CPF');
      }
      return;
    }
    throw Erros.invalido('DOCUMENTO_INVALIDO', 'CPF ou CNPJ invalido');
  }

  private mapearTelefonesExtras(
    lista: CriarContatoInput['telefonesExtras'] | undefined,
  ): Prisma.InputJsonValue {
    if (!lista?.length) return [];
    return lista
      .map((item) => {
        const normalizado = normalizarTelefone(item.numero);
        return {
          numero: item.numero.trim(),
          normalizado: normalizado || null,
        };
      })
      .filter((item) => item.numero.length >= 8);
  }

  private mapearPessoasEmpresa(
    lista: CriarContatoInput['pessoasEmpresa'] | undefined,
  ): Prisma.InputJsonValue {
    if (!lista?.length) return [];
    return lista
      .map((p) => ({
        nome: p.nome.trim(),
        cargo: p.cargo?.trim() || null,
        telefone: p.telefone?.trim() || null,
        email: p.email?.trim() || null,
      }))
      .filter((p) => p.nome.length >= 2);
  }

  private resumoDuplicidade(c: {
    id: string;
    nome: string;
    telefone: string;
    documento: string | null;
    natureza: NaturezaPessoa | null;
  }): ContatoResumoDuplicidade {
    return {
      id: c.id,
      nome: c.nome,
      telefone: c.telefone,
      documento: c.documento,
      natureza: c.natureza,
    };
  }

  private async exigirSemDuplicidade(
    empresaId: string,
    opts: {
      telefoneNormalizado?: string | null;
      documento?: string | null;
      ignorarId?: string;
    },
  ) {
    if (opts.telefoneNormalizado) {
      const porTelefone = await this.prisma.contato.findFirst({
        where: {
          empresaId,
          telefoneNormalizado: opts.telefoneNormalizado,
          ...(opts.ignorarId ? { id: { not: opts.ignorarId } } : {}),
        },
        select: { id: true, nome: true, telefone: true, documento: true, natureza: true },
      });
      if (porTelefone) {
        throw Erros.conflito(
          'CONTATO_DUPLICADO',
          'Ja existe um contato com este telefone nesta empresa',
          { motivo: 'telefone', contato: this.resumoDuplicidade(porTelefone) },
        );
      }
    }

    if (opts.documento) {
      const porDocumento = await this.prisma.contato.findFirst({
        where: {
          empresaId,
          documento: opts.documento,
          ...(opts.ignorarId ? { id: { not: opts.ignorarId } } : {}),
        },
        select: { id: true, nome: true, telefone: true, documento: true, natureza: true },
      });
      if (porDocumento) {
        throw Erros.conflito(
          'CONTATO_DUPLICADO',
          'Ja existe um contato com este CPF/CNPJ nesta empresa',
          { motivo: 'documento', contato: this.resumoDuplicidade(porDocumento) },
        );
      }
    }
  }

  async listar(empresaId: string, query: FiltrosListagem) {
    const where: Prisma.ContatoWhereInput = { empresaId };
    if (query.tipo && Object.values(TipoContato).includes(query.tipo as TipoContato)) {
      where.tipo = query.tipo as TipoContato;
    }

    const ecolume = await this.ecolume(empresaId);
    if (ecolume) {
      if (query.natureza === NaturezaPessoa.PF || query.natureza === NaturezaPessoa.PJ) {
        where.natureza = query.natureza;
      }
      if (query.parceiro === 'true' || query.parceiro === '1') {
        where.ehParceiro = true;
      } else if (query.parceiro === 'false' || query.parceiro === '0') {
        where.ehParceiro = false;
      }
      const cidade = query.cidade?.trim();
      if (cidade) {
        where.cidade = { equals: cidade, mode: 'insensitive' };
      }
    }

    const termo = query.busca?.trim();
    if (termo) {
      const like = `%${termo.toLocaleLowerCase('pt-BR').replace(/[%_]/g, '')}%`;
      const digitos = termo.replace(/\D+/g, '');
      const telefoneSql = digitos
        ? Prisma.sql`OR telefone LIKE ${'%' + digitos + '%'} OR "telefoneNormalizado" LIKE ${'%' + digitos + '%'}`
        : Prisma.empty;
      const documentoSql = digitos
        ? Prisma.sql`OR documento LIKE ${'%' + digitos + '%'}`
        : Prisma.empty;
      const fantasiaSql = ecolume
        ? Prisma.sql`OR lower(COALESCE("nomeFantasia", '')) LIKE ${like}`
        : Prisma.empty;
      const ids = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM contatos
        WHERE "empresaId" = ${empresaId}
        AND (
          lower(nome) LIKE ${like}
          OR lower(COALESCE("empresaNome", '')) LIKE ${like}
          ${fantasiaSql}
          ${telefoneSql}
          ${documentoSql}
        )
      `;
      where.id = { in: ids.map((linha) => linha.id) };
    }

    const [dados, total] = await this.prisma.$transaction([
      this.prisma.contato.findMany({
        where,
        include: {
          _count: { select: { oportunidades: true, contatosObras: true } },
        },
        orderBy: { criadoEm: 'desc' },
        skip: (query.pagina - 1) * query.porPagina,
        take: query.porPagina,
      }),
      this.prisma.contato.count({ where }),
    ]);

    const mapeados = dados.map(({ _count, ...contato }) =>
      this.serializarContato({
        ...contato,
        totalOportunidades: _count.oportunidades,
        totalObras: _count.contatosObras,
      }),
    );

    const soParceiros = where.ehParceiro === true;
    if (ecolume && soParceiros && mapeados.length > 0) {
      const metricas = await this.metricasParceiros(
        empresaId,
        mapeados.map((c) => c.id as string),
        query.de,
        query.ate,
      );
      const vazio = {
        vendasIndicadas: 0,
        quantidadePedidos: 0,
        valorVendido: 0,
        comissaoAPagar: 0,
        comissaoPaga: 0,
      };
      const comMetricas = mapeados.map((c) => ({
        ...c,
        ...(metricas.get(c.id as string) ?? vazio),
      }));
      return criarRespostaPaginada(comMetricas, total, query.pagina, query.porPagina);
    }

    return criarRespostaPaginada(mapeados, total, query.pagina, query.porPagina);
  }

  /** ECOL-10b — "2026-10-31" inclui o dia inteiro; ISO completo vale como instante. */
  private periodoPedido(de?: string, ate?: string): Prisma.DateTimeFilter | undefined {
    const filtro: Prisma.DateTimeFilter = {};
    const somenteData = /^\d{4}-\d{2}-\d{2}$/;
    if (de?.trim()) {
      const d = new Date(de.trim());
      if (Number.isNaN(d.getTime())) throw Erros.invalido('PERIODO_INVALIDO', 'Data inicial invalida');
      filtro.gte = d;
    }
    if (ate?.trim()) {
      const a = new Date(ate.trim());
      if (Number.isNaN(a.getTime())) throw Erros.invalido('PERIODO_INVALIDO', 'Data final invalida');
      if (somenteData.test(ate.trim())) {
        a.setUTCDate(a.getUTCDate() + 1);
        filtro.lt = a;
      } else {
        filtro.lte = a;
      }
    }
    return filtro.gte || filtro.lt || filtro.lte ? filtro : undefined;
  }

  /** Agrega só a partir de ComissaoPedido (uma por pedido) — sem dupla contagem. */
  private async metricasParceiros(
    empresaId: string,
    parceiroIds: string[],
    de?: string,
    ate?: string,
  ) {
    const periodo = this.periodoPedido(de, ate);
    const comissoes = await this.prisma.comissaoPedido.findMany({
      where: {
        empresaId,
        parceiroId: { in: parceiroIds },
        status: { not: StatusComissaoPedido.CANCELADA },
        pedido: { empresaId, ...(periodo ? { criadoEm: periodo } : {}) },
      },
      select: {
        parceiroId: true,
        status: true,
        valorComissao: true,
        pedido: { select: { total: true } },
      },
    });
    const mapa = new Map<
      string,
      {
        vendasIndicadas: number;
        quantidadePedidos: number;
        valorVendido: number;
        comissaoAPagar: number;
        comissaoPaga: number;
      }
    >();
    for (const c of comissoes) {
      const m = mapa.get(c.parceiroId) ?? {
        vendasIndicadas: 0,
        quantidadePedidos: 0,
        valorVendido: 0,
        comissaoAPagar: 0,
        comissaoPaga: 0,
      };
      m.vendasIndicadas += 1;
      m.quantidadePedidos += 1;
      m.valorVendido += Number(c.pedido.total);
      if (c.status === StatusComissaoPedido.A_PAGAR) m.comissaoAPagar += Number(c.valorComissao);
      if (c.status === StatusComissaoPedido.PAGA) m.comissaoPaga += Number(c.valorComissao);
      mapa.set(c.parceiroId, m);
    }
    for (const m of mapa.values()) {
      m.valorVendido = this.arredondar(m.valorVendido);
      m.comissaoAPagar = this.arredondar(m.comissaoAPagar);
      m.comissaoPaga = this.arredondar(m.comissaoPaga);
    }
    return mapa;
  }

  private arredondar(valor: number): number {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }

  /** ECOL-10b — visão geral de comissões da empresa (padrão: A_PAGAR). */
  async listarComissoes(empresaId: string, filtros: FiltrosComissoes) {
    const pagina = filtros.pagina > 0 ? filtros.pagina : 1;
    const porPagina = filtros.porPagina > 0 ? filtros.porPagina : 20;
    const periodo = this.periodoPedido(filtros.de, filtros.ate);
    const statusInformado = filtros.status?.trim().toUpperCase();
    const status =
      statusInformado === 'TODAS'
        ? undefined
        : statusInformado &&
            (Object.values(StatusComissaoPedido) as string[]).includes(statusInformado)
          ? (statusInformado as StatusComissaoPedido)
          : statusInformado
            ? (() => {
                throw Erros.invalido('STATUS_COMISSAO_INVALIDO', 'Status de comissao invalido');
              })()
            : StatusComissaoPedido.A_PAGAR;

    const base: Prisma.ComissaoPedidoWhereInput = {
      empresaId,
      ...(filtros.parceiroId ? { parceiroId: filtros.parceiroId } : {}),
      pedido: { empresaId, ...(periodo ? { criadoEm: periodo } : {}) },
    };
    const where: Prisma.ComissaoPedidoWhereInput = { ...base, ...(status ? { status } : {}) };

    const [linhas, total, somaAPagar] = await this.prisma.$transaction([
      this.prisma.comissaoPedido.findMany({
        where,
        orderBy: [{ pedido: { criadoEm: 'desc' } }, { id: 'asc' }],
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        include: {
          pedido: {
            select: {
              id: true,
              numero: true,
              total: true,
              criadoEm: true,
              oportunidade: {
                select: {
                  id: true,
                  codigo: true,
                  titulo: true,
                  contato: { select: { id: true, nome: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.comissaoPedido.count({ where }),
      this.prisma.comissaoPedido.aggregate({
        where: { ...base, status: StatusComissaoPedido.A_PAGAR },
        _sum: { valorComissao: true },
      }),
    ]);

    const parceiroIds = [...new Set(linhas.map((l) => l.parceiroId))];
    const parceiros = parceiroIds.length
      ? await this.prisma.contato.findMany({
          where: { empresaId, id: { in: parceiroIds } },
          select: { id: true, nome: true },
        })
      : [];
    const nomes = new Map(parceiros.map((p) => [p.id, p.nome]));

    const dados = linhas.map((l) => ({
      id: l.id,
      pedidoId: l.pedido.id,
      pedidoNumero: l.pedido.numero,
      oportunidadeId: l.pedido.oportunidade.id,
      negocioCodigo: l.pedido.oportunidade.codigo,
      negocioTitulo: l.pedido.oportunidade.titulo,
      parceiroId: l.parceiroId,
      parceiroNome: nomes.get(l.parceiroId) ?? null,
      clienteNome: l.pedido.oportunidade.contato.nome,
      data: l.pedido.criadoEm,
      valorVenda: Number(l.pedido.total),
      rtPercentual: Number(l.rtPercentual),
      valorComissao: Number(l.valorComissao),
      status: l.status,
      pagoEm: l.pagoEm,
    }));

    return {
      ...criarRespostaPaginada(dados, total, pagina, porPagina),
      total,
      totalComissaoAPagar: this.arredondar(Number(somaAPagar._sum.valorComissao ?? 0)),
      pagina,
      porPagina,
    };
  }

  /** Dados crus do contato (sem ficha) — usado por atualizar/remover. */
  private async obterBase(empresaId: string, id: string) {
    const contato = await this.prisma.contato.findFirst({
      where: { id, empresaId },
      include: {
        contatosObras: { include: { obra: true } },
        _count: { select: { oportunidades: true, contatosObras: true } },
        oportunidades: {
          select: { id: true, codigo: true, titulo: true, etapaId: true, valorEstimado: true },
          orderBy: { atualizadoEm: 'desc' },
          take: 20,
        },
      },
    });
    if (!contato) throw Erros.naoEncontrado('CONTATO_NAO_ENCONTRADO', 'Contato nao encontrado');

    const { _count, contatosObras, ...resto } = contato;
    let responsavel: { id: string; nome: string; email: string } | null = null;
    if (resto.responsavelId) {
      responsavel = await this.platform.usuario.findFirst({
        where: { id: resto.responsavelId, empresaId },
        select: { id: true, nome: true, email: true },
      });
    }
    return this.serializarContato({
      ...resto,
      responsavel,
      obras: contatosObras.map((v) => ({
        id: v.id,
        papel: v.papel,
        obra: v.obra,
      })),
      totalOportunidades: _count.oportunidades,
      totalObras: _count.contatosObras,
    });
  }

  async obter(empresaId: string, id: string) {
    const base = await this.obterBase(empresaId, id);
    if (!(await this.ecolume(empresaId))) return base;

    const ficha = await this.fichaCliente(empresaId, id);
    const extra: Record<string, unknown> = {
      fichaCliente: {
        resumo: ficha.resumo,
        historico: ficha.historico,
        anexos: ficha.anexos,
      },
    };
    if (base.ehParceiro) {
      const parceria = await this.fichaParceiro(empresaId, id);
      extra.extratoComissoes = parceria.extratoComissoes;
      extra.negociosAbertos = parceria.negociosAbertos;
    }
    return { ...base, ...extra };
  }

  private async fichaCliente(empresaId: string, contatoId: string) {
    const negocios = await this.prisma.oportunidade.findMany({
      where: { empresaId, contatoId },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        codigo: true,
        titulo: true,
        criadoEm: true,
        atualizadoEm: true,
        valorEstimado: true,
        parceiroId: true,
        etapa: { select: { nome: true, chaveSistema: true } },
        parceiro: { select: { id: true, nome: true, ehParceiro: true } },
        orcamentos: {
          orderBy: { criadoEm: 'desc' },
          select: { id: true, numero: true, status: true, total: true, criadoEm: true },
        },
        pedidos: {
          orderBy: { criadoEm: 'desc' },
          select: {
            id: true,
            numero: true,
            status: true,
            total: true,
            criadoEm: true,
            finalizadoEm: true,
            checklist: {
              orderBy: { ordem: 'asc' },
              select: { tipo: true, concluido: true, aplicavel: true },
            },
          },
        },
      },
    });

    let totalComprado = 0;
    let quantidadePedidos = 0;
    let ultimaCompra: Date | null = null;
    for (const n of negocios) {
      for (const p of n.pedidos) {
        if (p.status === StatusPedido.CANCELADO) continue;
        totalComprado += Number(p.total);
        quantidadePedidos += 1;
        const data = p.finalizadoEm ?? p.criadoEm;
        if (!ultimaCompra || data > ultimaCompra) ultimaCompra = data;
      }
    }
    // negocios já vêm do mais recente para o mais antigo
    const comParceiro = negocios.find((n) => n.parceiroId && n.parceiro);
    const resumo = {
      totalComprado: this.arredondar(totalComprado),
      quantidadePedidos,
      ultimaCompraEm: ultimaCompra,
      parceiroOrigem: comParceiro?.parceiro
        ? { id: comParceiro.parceiro.id, nome: comParceiro.parceiro.nome }
        : null,
    };

    const historico = negocios.map((n) => ({
      id: n.id,
      codigo: n.codigo,
      titulo: n.titulo,
      criadoEm: n.criadoEm,
      atualizadoEm: n.atualizadoEm,
      valorEstimado: n.valorEstimado == null ? null : Number(n.valorEstimado),
      etapa: n.etapa,
      parceiro: n.parceiro,
      orcamentos: n.orcamentos.map((o) => ({ ...o, total: Number(o.total) })),
      pedidos: n.pedidos.map((p) => ({ ...p, total: Number(p.total) })),
    }));

    const porId = new Map(negocios.map((n) => [n.id, n]));
    const arquivos = negocios.length
      ? await this.prisma.arquivo.findMany({
          where: {
            empresaId,
            entidade: 'OPORTUNIDADE',
            entidadeId: { in: negocios.map((n) => n.id) },
          },
          orderBy: { criadoEm: 'desc' },
          select: { id: true, nome: true, criadoEm: true, entidadeId: true },
        })
      : [];
    const anexos = arquivos.map((a) => {
      const negocio = porId.get(a.entidadeId as string);
      return {
        id: a.id,
        nome: a.nome,
        criadoEm: a.criadoEm,
        oportunidadeId: a.entidadeId as string,
        negocioCodigo: negocio?.codigo ?? null,
        negocioTitulo: negocio?.titulo ?? null,
      };
    });

    return { resumo, historico, anexos };
  }

  private async fichaParceiro(empresaId: string, parceiroId: string) {
    const comissoes = await this.prisma.comissaoPedido.findMany({
      where: { empresaId, parceiroId, pedido: { empresaId } },
      orderBy: [{ pedido: { criadoEm: 'desc' } }, { id: 'asc' }],
      take: 200,
      select: {
        status: true,
        rtPercentual: true,
        valorComissao: true,
        pedido: {
          select: {
            id: true,
            numero: true,
            total: true,
            criadoEm: true,
            oportunidade: { select: { contato: { select: { nome: true } } } },
          },
        },
      },
    });
    // SNAPSHOT: rtPercentual/valorComissao gravados na conversão; nunca recalcula do rtPadrao.
    const extratoComissoes = comissoes.map((c) => ({
      pedidoId: c.pedido.id,
      pedidoNumero: c.pedido.numero,
      clienteNome: c.pedido.oportunidade.contato.nome,
      data: c.pedido.criadoEm,
      valorVenda: Number(c.pedido.total),
      rtPercentual: Number(c.rtPercentual),
      valorComissao: Number(c.valorComissao),
      status: c.status,
    }));

    const indicados = await this.prisma.oportunidade.findMany({
      where: { empresaId, parceiroId },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        codigo: true,
        titulo: true,
        criadoEm: true,
        etapa: { select: { nome: true, chaveSistema: true, tipo: true } },
        contato: { select: { id: true, nome: true } },
      },
    });
    const negociosAbertos = indicados
      .filter(
        (n) =>
          n.etapa.chaveSistema !== ChaveEtapaSistema.PEDIDO_FINALIZADO &&
          n.etapa.chaveSistema !== ChaveEtapaSistema.PERDIDO &&
          n.etapa.tipo !== 'PERDIDA',
      )
      .map((n) => ({
        id: n.id,
        codigo: n.codigo,
        titulo: n.titulo,
        clienteNome: n.contato.nome,
        etapa: n.etapa.nome,
        criadoEm: n.criadoEm,
      }));

    return { extratoComissoes, negociosAbertos };
  }

  async criar(empresaId: string, dto: CriarContatoInput) {
    const telefoneNormalizado = normalizarTelefone(dto.telefone);
    if (!telefoneNormalizado) {
      throw Erros.invalido('TELEFONE_INVALIDO', 'Telefone invalido');
    }

    const ecolume = await this.ecolume(empresaId);
    const natureza = ecolume ? (dto.natureza ?? null) : null;
    if (ecolume && !natureza) {
      throw Erros.invalido('NATUREZA_OBRIGATORIA', 'Informe se o cliente e PF ou PJ');
    }
    if (ecolume && natureza === NaturezaPessoa.PJ && dto.nome.trim().length < 2) {
      throw Erros.invalido('RAZAO_SOCIAL_OBRIGATORIA', 'Informe a razao social');
    }

    const documento = this.normalizarDocumento(dto.documento);
    this.validarDocumento(documento, natureza);

    await this.exigirSemDuplicidade(empresaId, { telefoneNormalizado, documento });

    const dadosPersonalizados = await this.campos.validarPara(
      empresaId,
      EntidadeCampoPersonalizado.CONTATO,
      dto.dadosPersonalizados,
    );

    const ieIsento = ecolume ? Boolean(dto.ieIsento) : false;
    const tipo =
      dto.tipo ??
      (natureza === NaturezaPessoa.PJ ? TipoContato.EMPRESA : TipoContato.OUTRO);

    return this.prisma.contato.create({
      data: {
        empresaId,
        nome: dto.nome.trim(),
        telefone: dto.telefone,
        telefoneNormalizado,
        email: dto.email || null,
        tipo,
        empresaNome: ecolume
          ? (dto.nomeFantasia?.trim() || dto.empresaNome?.trim() || null)
          : (dto.empresaNome ?? null),
        documento,
        origem: dto.origem ?? null,
        observacoes: dto.observacoes ?? null,
        responsavelId: dto.responsavelId ?? null,
        dadosPersonalizados: dadosPersonalizados as object,
        natureza,
        nomeFantasia: ecolume ? (dto.nomeFantasia?.trim() || null) : null,
        inscricaoEstadual: ecolume
          ? ieIsento
            ? null
            : dto.inscricaoEstadual?.trim() || null
          : null,
        ieIsento,
        cep: ecolume ? dto.cep?.replace(/\D/g, '') || null : null,
        logradouro: ecolume ? dto.logradouro?.trim() || null : null,
        numero: ecolume ? dto.numero?.trim() || null : null,
        complemento: ecolume ? dto.complemento?.trim() || null : null,
        bairro: ecolume ? dto.bairro?.trim() || null : null,
        cidade: ecolume ? dto.cidade?.trim() || null : null,
        uf: ecolume ? dto.uf?.trim().toUpperCase() || null : null,
        telefonesExtras: ecolume ? this.mapearTelefonesExtras(dto.telefonesExtras) : [],
        pessoasEmpresa:
          ecolume && natureza === NaturezaPessoa.PJ
            ? this.mapearPessoasEmpresa(dto.pessoasEmpresa)
            : [],
        ehParceiro: ecolume ? Boolean(dto.ehParceiro) : false,
        ...(ecolume && dto.ehParceiro
          ? {
              tipoParceiro: dto.tipoParceiro ?? null,
              rtPadrao: new Prisma.Decimal(
                this.rtPadraoInicial(dto, await this.rtEmpresa(empresaId)),
              ),
              chavePix: dto.chavePix?.trim() || null,
              banco: dto.banco?.trim() || null,
              agencia: dto.agencia?.trim() || null,
              conta: dto.conta?.trim() || null,
              titularNome: dto.titularNome?.trim() || null,
              titularDocumento: this.normalizarDocumento(dto.titularDocumento),
              observacoesParceria: dto.observacoesParceria?.trim() || null,
            }
          : {}),
      },
    }).then((c) => this.serializarContato(c as Record<string, unknown>));
  }

  async atualizar(empresaId: string, id: string, dto: AtualizarContatoInput) {
    const atual = await this.obterBase(empresaId, id);
    const ecolume = await this.ecolume(empresaId);
    const rtEmpresa = ecolume ? await this.rtEmpresa(empresaId) : RT_PADRAO_PARCEIRO;

    const data: Prisma.ContatoUpdateInput = {
      nome: dto.nome?.trim(),
      email: dto.email === '' ? null : dto.email,
      tipo: dto.tipo,
      origem: dto.origem,
      observacoes: dto.observacoes,
      responsavelId: dto.responsavelId,
    };

    let telefoneNormalizado: string | undefined;
    if (dto.telefone) {
      telefoneNormalizado = normalizarTelefone(dto.telefone) || undefined;
      if (!telefoneNormalizado) {
        throw Erros.invalido('TELEFONE_INVALIDO', 'Telefone invalido');
      }
      data.telefone = dto.telefone;
      data.telefoneNormalizado = telefoneNormalizado;
    }

    const natureza =
      ecolume && dto.natureza !== undefined ? dto.natureza : (atual.natureza as NaturezaPessoa | null);

    let documento: string | null | undefined;
    if (dto.documento !== undefined) {
      documento = this.normalizarDocumento(dto.documento);
      this.validarDocumento(documento, natureza);
      data.documento = documento;
    }

    await this.exigirSemDuplicidade(empresaId, {
      telefoneNormalizado: telefoneNormalizado ?? null,
      documento: documento === undefined ? null : documento,
      ignorarId: id,
    });

    if (ecolume) {
      if (dto.natureza !== undefined) data.natureza = dto.natureza;
      if (dto.nomeFantasia !== undefined) {
        data.nomeFantasia = dto.nomeFantasia?.trim() || null;
        data.empresaNome = dto.nomeFantasia?.trim() || dto.empresaNome?.trim() || null;
      } else if (dto.empresaNome !== undefined) {
        data.empresaNome = dto.empresaNome;
      }
      if (dto.ieIsento !== undefined) data.ieIsento = dto.ieIsento;
      if (dto.inscricaoEstadual !== undefined || dto.ieIsento === true) {
        data.inscricaoEstadual =
          dto.ieIsento === true ? null : dto.inscricaoEstadual?.trim() || null;
      }
      if (dto.cep !== undefined) data.cep = dto.cep?.replace(/\D/g, '') || null;
      if (dto.logradouro !== undefined) data.logradouro = dto.logradouro?.trim() || null;
      if (dto.numero !== undefined) data.numero = dto.numero?.trim() || null;
      if (dto.complemento !== undefined) data.complemento = dto.complemento?.trim() || null;
      if (dto.bairro !== undefined) data.bairro = dto.bairro?.trim() || null;
      if (dto.cidade !== undefined) data.cidade = dto.cidade?.trim() || null;
      if (dto.uf !== undefined) data.uf = dto.uf?.trim().toUpperCase() || null;
      if (dto.telefonesExtras !== undefined) {
        data.telefonesExtras = this.mapearTelefonesExtras(dto.telefonesExtras);
      }
      if (dto.pessoasEmpresa !== undefined) {
        data.pessoasEmpresa =
          natureza === NaturezaPessoa.PJ ? this.mapearPessoasEmpresa(dto.pessoasEmpresa) : [];
      }

      if (dto.ehParceiro !== undefined) {
        data.ehParceiro = dto.ehParceiro;
        if (dto.ehParceiro) {
          if (!dto.tipoParceiro && !(atual as { tipoParceiro?: string | null }).tipoParceiro) {
            throw Erros.invalido('TIPO_PARCEIRO_OBRIGATORIO', 'Informe o tipo de parceiro');
          }
          Object.assign(
            data,
            this.camposParceria(dto, {
              ativar: true,
              rtFallback: (atual as { rtPadrao?: number | null }).rtPadrao,
              rtEmpresa,
            }),
          );
          if (dto.tipoParceiro) data.tipoParceiro = dto.tipoParceiro;
          if (data.rtPadrao === undefined && (atual as { rtPadrao?: number | null }).rtPadrao == null) {
            data.rtPadrao = new Prisma.Decimal(rtEmpresa);
          }
        }
        // Desmarcar: sai da lista; dados de parceria permanecem no registro.
      } else if (
        atual.ehParceiro ||
        dto.tipoParceiro !== undefined ||
        dto.rtPadrao !== undefined ||
        dto.chavePix !== undefined
      ) {
        Object.assign(data, this.camposParceria(dto, { ativar: false, rtEmpresa }));
      }
    } else if (dto.empresaNome !== undefined) {
      data.empresaNome = dto.empresaNome;
    }

    if (dto.dadosPersonalizados !== undefined) {
      data.dadosPersonalizados = (await this.campos.validarPara(
        empresaId,
        EntidadeCampoPersonalizado.CONTATO,
        dto.dadosPersonalizados,
      )) as object;
    }

    const atualizado = await this.prisma.contato.update({ where: { id }, data });
    return this.serializarContato(atualizado as Record<string, unknown>);
  }

  async remover(
    empresaId: string,
    id: string,
    ator?: { id: string; perfil: string } | null,
  ) {
    await this.obterBase(empresaId, id);
    if (ator && (await this.permissoes.empresaEcolume(empresaId))) {
      await this.permissoes.afirmar(
        { id: ator.id, empresaId, perfil: ator.perfil },
        PermissaoComercial.EXCLUIR_CLIENTE,
      );
    }
    await this.prisma.contato.delete({ where: { id } });
    return { ok: true };
  }
}
