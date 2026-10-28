import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common';
import {
  ChaveEtapaSistema,
  lerDescontoMaximoPercentual,
  lerMargemPadraoGlobal,
  lerValidadeOrcamentoDias,
  OrigemHistoricoEtapa,
  PermissaoComercial,
  StatusOrcamento,
  TipoAuditoria,
  TipoDescontoOrcamento,
  TipoEtapaFunil,
  possuiPermissao,
  validarDescontoEfetivoOrcamento,
  type atualizarOrcamentoSchema,
  type criarOrcamentoSchema,
} from '@arcco/contratos';
import { garantirEtapasEcolume } from '../oportunidades/kanban-ecolume';
import { renderizarPdfEcolume, renderizarPdfLegado, type DadosPdfOrcamento } from './pdf-orcamento';
import type { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import type { UsuarioAutenticado } from '../../common/auth/tipos';
import { ArquivosService } from '../arquivos/arquivos.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ProdutosService } from '../produtos/produtos.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import {
  montarItemEcolume,
  montarItemLegado,
  serializarItemOrcamento,
  totaisOrcamento,
  type ItemInput,
} from './formula-item';

type CriarOrcamentoInput = z.infer<typeof criarOrcamentoSchema>;
type AtualizarOrcamentoInput = z.infer<typeof atualizarOrcamentoSchema>;

const INCLUDE = {
  itens: { include: { produto: true }, orderBy: { ordem: 'asc' as const } },
  orcamentoOrigem: { select: { id: true, numero: true } },
} as const;

const INCLUDE_EMISSAO = {
  itens: { include: { produto: true }, orderBy: { ordem: 'asc' as const } },
  oportunidade: { include: { contato: true, etapa: true } },
} as const;

/** Status em que cabeçalho/itens não podem ser alterados (API inclusive). */
const STATUS_TRAVADOS = new Set<string>([
  StatusOrcamento.ENVIADO,
  StatusOrcamento.ACEITO,
  StatusOrcamento.CANCELADO,
  StatusOrcamento.CONVERTIDO,
  StatusOrcamento.SUBSTITUIDO,
  StatusOrcamento.RECUSADO,
]);

@Injectable()
export class OrcamentosService {
  private readonly logger = new Logger(OrcamentosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platform: PlatformPrismaService,
    private readonly arquivos: ArquivosService,
    private readonly produtos: ProdutosService,
    private readonly permissoes: PermissoesService,
    @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsapp: WhatsAppService,
    @Optional() private readonly auditoria?: AuditoriaService,
  ) {}

  async listarPorOportunidade(empresaId: string, oportunidadeId: string) {
    const lista = await this.prisma.orcamento.findMany({
      where: { empresaId, oportunidadeId },
      include: INCLUDE,
      orderBy: [{ criadoEm: 'desc' }, { versao: 'desc' }],
    });
    return lista.map((o) => this.serializarOrcamento(o));
  }

  /** Leitura usada pela emissão de NF: orçamento, itens, oportunidade, contato e etapa. */
  buscarParaEmissao(empresaId: string, id: string) {
    return this.prisma.orcamento.findFirst({
      where: { id, empresaId },
      include: INCLUDE_EMISSAO,
    });
  }

  exigirParaEmissao(empresaId: string, id: string) {
    return this.prisma.orcamento.findFirstOrThrow({
      where: { id, empresaId },
      include: INCLUDE_EMISSAO,
    });
  }

  async obter(empresaId: string, id: string) {
    const orcamento = await this.prisma.orcamento.findFirst({
      where: { id, empresaId },
      include: INCLUDE,
    });
    if (!orcamento) throw Erros.naoEncontrado('ORCAMENTO_NAO_ENCONTRADO', 'Orcamento nao encontrado');
    return this.serializarOrcamento({
      ...orcamento,
      avisosEstoque: await this.avisosEstoque(empresaId, orcamento.itens),
    });
  }

  private serializarOrcamento<T extends { itens?: Array<Record<string, unknown>> }>(orc: T): T {
    return {
      ...orc,
      itens: orc.itens?.map((i) => serializarItemOrcamento(i)),
    } as T;
  }

  async criar(
    empresaId: string,
    usuario: UsuarioAutenticado | { id: string; empresaId?: string; perfil?: string } | string | null,
    dto: CriarOrcamentoInput,
    opcoes: { orcamentoOrigemId?: string | null } = {},
  ) {
    const usuarioId = typeof usuario === 'string' || usuario == null ? usuario : usuario.id;
    const oportunidade = await this.prisma.oportunidade.findFirst({
      where: { id: dto.oportunidadeId, empresaId },
    });
    if (!oportunidade) {
      throw Erros.naoEncontrado('OPORTUNIDADE_NAO_ENCONTRADA', 'Oportunidade nao encontrada');
    }

    const ecolume = await this.permissoes.empresaEcolume(empresaId);
    const podeVerCustos = await this.podeVerCustos(empresaId, usuario);
    const podeAlterarPreco = await this.podeAlterarPreco(empresaId, usuario, podeVerCustos);
    const paramsMontagem = ecolume
      ? await this.paramsMontagem(empresaId)
      : {
          descontoMaximoPercentual: null as number | null,
          margemPadraoGlobal: null as number | null,
          validadeOrcamentoDias: null as number | null,
        };
    if (ecolume && !podeVerCustos) {
      this.assertDescontoGeralSemCustos(
        dto,
        paramsMontagem.descontoMaximoPercentual ?? null,
        podeAlterarPreco,
      );
    }

    const criado = await this.prisma.$transaction(async (tx) => {
      const montados = await this.montarItens(
        empresaId,
        dto.itens ?? [],
        { ecolume, podeVerCustos, podeAlterarPreco, ...paramsMontagem },
        tx,
      );
      const itens = montados.itens;
      const totais = totaisOrcamento({
        itens,
        descontoTipo: dto.descontoTipo,
        descontoValor: dto.descontoValor,
        descontoPercentual: dto.descontoPercentual,
      });
      if (ecolume && !podeVerCustos) {
        this.assertDescontoEfetivo(montados.totalSugerido, totais.total, paramsMontagem.descontoMaximoPercentual ?? null);
      }
      const { numero, versao } = await this.reservarNumero(
        tx,
        empresaId,
        dto.oportunidadeId,
        ecolume,
      );
      if (itens.length > 0) {
        await tx.orcamento.updateMany({
          where: { oportunidadeId: dto.oportunidadeId, empresaId, vigente: true },
          data: { vigente: false },
        });
      }
      let validadeEm = dto.validadeEm ?? null;
      if (validadeEm == null && ecolume && paramsMontagem.validadeOrcamentoDias) {
        const d = new Date();
        d.setDate(d.getDate() + paramsMontagem.validadeOrcamentoDias);
        validadeEm = d;
      }
      const orc = await tx.orcamento.create({
        data: {
          empresaId,
          oportunidadeId: dto.oportunidadeId,
          numero,
          versao,
          status: StatusOrcamento.RASCUNHO,
          vigente: itens.length > 0,
          observacoes: dto.observacoes ?? null,
          descontoValor: totais.descontoValor,
          descontoTipo: totais.descontoTipo,
          descontoPercentual: totais.descontoPercentual,
          subtotal: totais.subtotal,
          total: totais.total,
          validadeEm,
          criadoPorId: usuarioId,
          orcamentoOrigemId: opcoes.orcamentoOrigemId ?? null,
          itens: { create: itens },
        },
        include: INCLUDE,
      });
      if (itens.length > 0) {
        await tx.oportunidade.update({
          where: { id: dto.oportunidadeId },
          data: {
            valorEstimado: totais.total,
            codigoOrcamento: numero,
          },
        });
        if (ecolume) {
          await this.avancarParaOrcamentoEmAberto(tx, empresaId, dto.oportunidadeId, usuarioId);
        }
      }
      return orc;
    });

    return this.serializarOrcamento({
      ...criado,
      avisosEstoque: await this.avisosEstoque(empresaId, criado.itens),
    });
  }

  async duplicar(empresaId: string, usuario: UsuarioAutenticado | string | null, id: string) {
    const origem = await this.obter(empresaId, id);
    return this.criar(
      empresaId,
      usuario,
      {
        oportunidadeId: origem.oportunidadeId,
        observacoes: origem.observacoes,
        descontoValor: origem.descontoValor,
        validadeEm: origem.validadeEm,
        descontoTipo: (origem as { descontoTipo?: string }).descontoTipo as never,
        descontoPercentual: (origem as { descontoPercentual?: number | null }).descontoPercentual,
        itens: origem.itens.map((i) => ({
          produtoId: i.produtoId,
          nome: i.nome,
          unidade: i.unidade,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
          desconto: i.desconto,
          codigoInterno: (i as { codigoInterno?: string | null }).codigoInterno,
          baseCusto: (i as { baseCusto?: string | null }).baseCusto as never,
          custoBase: (i as { custoBase?: number | null }).custoBase != null
            ? Number((i as { custoBase: unknown }).custoBase)
            : null,
          ipiPercentual: (i as { ipiPercentual?: number | null }).ipiPercentual != null
            ? Number((i as { ipiPercentual: unknown }).ipiPercentual)
            : null,
          stPercentual: (i as { stPercentual?: number | null }).stPercentual != null
            ? Number((i as { stPercentual: unknown }).stPercentual)
            : null,
          margem: (i as { margem?: number | null }).margem != null
            ? Number((i as { margem: unknown }).margem)
            : null,
          precoManual: Boolean((i as { precoManual?: boolean }).precoManual),
        })),
      },
      { orcamentoOrigemId: origem.id },
    );
  }

  async atualizar(
    empresaId: string,
    id: string,
    dto: AtualizarOrcamentoInput,
    usuario?: UsuarioAutenticado | string | null,
  ) {
    const atual = await this.obter(empresaId, id);
    this.assertEditavel(atual.status);

    const ecolume = await this.permissoes.empresaEcolume(empresaId);
    const podeVerCustos = await this.podeVerCustos(empresaId, usuario ?? null);
    const podeAlterarPreco = await this.podeAlterarPreco(empresaId, usuario ?? null, podeVerCustos);
    const paramsMontagem = ecolume
      ? await this.paramsMontagem(empresaId)
      : {
          descontoMaximoPercentual: null as number | null,
          margemPadraoGlobal: null as number | null,
          validadeOrcamentoDias: null as number | null,
        };
    if (ecolume && !podeVerCustos) {
      this.assertDescontoGeralSemCustos(
        dto,
        paramsMontagem.descontoMaximoPercentual ?? null,
        podeAlterarPreco,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const montados = dto.itens
        ? await this.montarItens(
            empresaId,
            dto.itens,
            { ecolume, podeVerCustos, podeAlterarPreco, ...paramsMontagem },
            tx,
          )
        : null;
      const itens = montados?.itens ?? null;
      const totais = totaisOrcamento({
        itens: itens ?? atual.itens,
        descontoTipo: dto.descontoTipo ?? (atual as { descontoTipo?: string }).descontoTipo,
        descontoValor: dto.descontoValor ?? atual.descontoValor,
        descontoPercentual:
          dto.descontoPercentual !== undefined
            ? dto.descontoPercentual
            : (atual as { descontoPercentual?: number | null }).descontoPercentual,
      });
      if (ecolume && !podeVerCustos && montados) {
        this.assertDescontoEfetivo(
          montados.totalSugerido,
          totais.total,
          paramsMontagem.descontoMaximoPercentual ?? null,
        );
      }

      const qtdItens = itens?.length ?? atual.itens.length;
      if (itens) {
        await tx.itemOrcamento.deleteMany({ where: { orcamentoId: id } });
        await tx.itemOrcamento.createMany({
          data: itens.map((item) => ({ ...item, orcamentoId: id })),
        });
      }
      if (qtdItens > 0) {
        await tx.orcamento.updateMany({
          where: {
            oportunidadeId: atual.oportunidadeId,
            empresaId,
            vigente: true,
            id: { not: id },
          },
          data: { vigente: false },
        });
      }
      await tx.orcamento.update({
        where: { id },
        data: {
          observacoes: dto.observacoes === undefined ? undefined : dto.observacoes,
          descontoValor: totais.descontoValor,
          descontoTipo: totais.descontoTipo,
          descontoPercentual: totais.descontoPercentual,
          subtotal: totais.subtotal,
          total: totais.total,
          validadeEm: dto.validadeEm === undefined ? undefined : dto.validadeEm,
          arquivoId: null,
          ...(qtdItens > 0 ? { vigente: true } : {}),
        },
      });
      await tx.oportunidade.update({
        where: { id: atual.oportunidadeId },
        data: {
          valorEstimado: totais.total,
          codigoOrcamento: atual.numero,
        },
      });
    });

    return this.obter(empresaId, id);
  }

  async gerarPdf(empresaId: string, id: string, usuarioId: string | null) {
    const orcamento = await this.obter(empresaId, id);
    const ecolume = await this.permissoes.empresaEcolume(empresaId);

    // ECOL-14: orçamento enviado/travado não regenera o PDF comercial (imuta o documento).
    if (
      ecolume &&
      orcamento.status !== StatusOrcamento.RASCUNHO &&
      orcamento.arquivoId
    ) {
      return orcamento;
    }

    const oportunidade = await this.prisma.oportunidade.findFirst({
      where: { id: orcamento.oportunidadeId, empresaId },
      include: { contato: true, obra: true },
    });
    const empresa = await this.platform.empresa.findUniqueOrThrow({ where: { id: empresaId } });

    let logoBuffer: Buffer | null = null;
    if (empresa.logoArquivoId) {
      try {
        const { buffer } = await this.arquivos.conteudo(empresaId, empresa.logoArquivoId);
        logoBuffer = buffer;
      } catch {
        this.logger.warn(`Logo da empresa ${empresaId} indisponivel para PDF`);
      }
    }

    const responsavelId = oportunidade?.responsavelId;
    const vendedor = responsavelId
      ? await this.platform.usuario.findFirst({
          where: { id: responsavelId, empresaId },
          select: { nome: true, email: true },
        })
      : null;

    const fiscal = (empresa.enderecoFiscal ?? {}) as {
      logradouro?: string;
      numero?: string;
      bairro?: string;
      municipio?: string;
      uf?: string;
      cep?: string;
    };
    const cepEmpresa = fiscal.cep?.replace(/\D/g, '') ?? '';
    const cepFormatado =
      cepEmpresa.length === 8 ? `${cepEmpresa.slice(0, 5)}-${cepEmpresa.slice(5)}` : fiscal.cep;
    const ruaEmpresa = [fiscal.logradouro, fiscal.numero].filter(Boolean).join(', ');
    const cidadeEmpresa = [fiscal.municipio || empresa.cidade, fiscal.uf || empresa.estado]
      .filter(Boolean)
      .join('/');
    const enderecoEmpresa =
      [ruaEmpresa, fiscal.bairro, cidadeEmpresa].filter(Boolean).join(', ') +
        (cepFormatado ? `${ruaEmpresa || fiscal.bairro || cidadeEmpresa ? ' - ' : ''}CEP ${cepFormatado}` : '') ||
      null;

    const obra = oportunidade?.obra;
    const enderecoObra = obra
      ? [
          [obra.endereco, obra.bairro].filter(Boolean).join(', '),
          [obra.cidade, obra.estado].filter(Boolean).join('/'),
          obra.cep,
        ]
          .filter(Boolean)
          .join(' · ') || null
      : null;

    // Valores persistidos da linha (ECOL-13); nunca recalcula com custo/produto atual.
    const dados: DadosPdfOrcamento = {
      empresa: {
        nome: empresa.nomeFantasia || empresa.nome,
        telefone: empresa.telefone,
        endereco: enderecoEmpresa,
        cnpj: empresa.cnpj,
      },
      vendedor: vendedor ? { nome: vendedor.nome, email: vendedor.email } : null,
      logo: logoBuffer,
      orcamento: {
        numero: orcamento.numero,
        versao: orcamento.versao,
        descontoValor: orcamento.descontoValor,
        subtotal: orcamento.subtotal,
        total: orcamento.total,
        validadeEm: orcamento.validadeEm,
        criadoEm: orcamento.criadoEm,
        observacoes: orcamento.observacoes,
        itens: orcamento.itens.map((i) => ({
          nome: i.nome,
          sku: ecolume ? null : (i.produto?.sku ?? null),
          unidade: i.unidade,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
          desconto: i.desconto,
          totalLinha: i.totalLinha,
        })),
      },
      cliente: oportunidade?.contato.nome ?? 'Cliente',
      telefoneCliente: oportunidade?.contato.telefone ?? null,
      obra: obra?.nome ?? null,
      enderecoObra,
      numeroPedido: oportunidade?.codigo ?? '—',
    };

    const pdf = ecolume
      ? await renderizarPdfEcolume(dados)
      : await renderizarPdfLegado(dados);

    const arquivo = await this.arquivos.enviar(empresaId, usuarioId, {
      nome: `${orcamento.numero}.pdf`,
      tipoMime: 'application/pdf',
      conteudo: pdf,
      entidade: 'ORCAMENTO',
      entidadeId: orcamento.oportunidadeId,
    });

    await this.prisma.orcamento.update({
      where: { id },
      data: { arquivoId: arquivo.id },
    });

    return this.obter(empresaId, id);
  }

  /** Conteúdo do PDF comercial (gera se rascunho; reutiliza arquivo se já enviado). */
  async conteudoPdf(empresaId: string, id: string, usuarioId: string | null) {
    let orcamento = await this.obter(empresaId, id);
    if (!orcamento.arquivoId) {
      orcamento = await this.gerarPdf(empresaId, id, usuarioId);
    } else {
      const ecolume = await this.permissoes.empresaEcolume(empresaId);
      if (!ecolume || orcamento.status === StatusOrcamento.RASCUNHO) {
        orcamento = await this.gerarPdf(empresaId, id, usuarioId);
      }
    }
    if (!orcamento.arquivoId) {
      throw Erros.invalido('PDF_INDISPONIVEL', 'Nao foi possivel obter o PDF do orcamento');
    }
    const { arquivo, buffer } = await this.arquivos.conteudo(empresaId, orcamento.arquivoId);
    return { orcamento, arquivo, buffer };
  }

  /**
   * Marca o orçamento como enviado/vigente (aceito = último enviado) e espelha o total na oportunidade.
   * Retorna dados prontos para o WhatsAppService anexar o PDF.
   */
  async prepararEnvio(empresaId: string, id: string, usuarioId: string | null) {
    let orcamento = await this.obter(empresaId, id);
    if (orcamento.itens.length === 0) {
      throw Erros.invalido('ORCAMENTO_SEM_ITENS', 'Inclua itens antes de enviar');
    }
    if (
      orcamento.status !== StatusOrcamento.RASCUNHO &&
      orcamento.status !== StatusOrcamento.ENVIADO
    ) {
      throw Erros.invalido(
        'ORCAMENTO_NAO_ENVIAVEL',
        'So e possivel enviar orcamentos em rascunho ou ja enviados',
      );
    }
    if (!orcamento.arquivoId) {
      orcamento = await this.gerarPdf(empresaId, id, usuarioId);
    }

    const ecolume = await this.permissoes.empresaEcolume(empresaId);
    const agora = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.orcamento.updateMany({
        where: { oportunidadeId: orcamento.oportunidadeId, empresaId, vigente: true },
        data: { vigente: false },
      });
      if (ecolume) {
        await tx.orcamento.updateMany({
          where: {
            oportunidadeId: orcamento.oportunidadeId,
            empresaId,
            status: StatusOrcamento.ENVIADO,
            id: { not: id },
          },
          data: { status: StatusOrcamento.SUBSTITUIDO, vigente: false },
        });
      }
      await tx.orcamento.update({
        where: { id },
        data: {
          status: StatusOrcamento.ENVIADO,
          vigente: true,
          aceitoEm: agora,
          enviadoEm: orcamento.enviadoEm ?? agora,
        },
      });
      await tx.oportunidade.update({
        where: { id: orcamento.oportunidadeId },
        data: {
          valorEstimado: orcamento.total,
          codigoOrcamento: orcamento.numero,
          dadosPersonalizados: {
            ...(((await tx.oportunidade.findFirst({
              where: { id: orcamento.oportunidadeId },
              select: { dadosPersonalizados: true },
            }))?.dadosPersonalizados ?? {}) as object),
            orcamento_arquivo_id: orcamento.arquivoId,
            orcamento_id: id,
          },
        },
      });
    });

    return this.obter(empresaId, id);
  }

  async enviar(
    empresaId: string,
    id: string,
    usuarioId: string,
    texto: string,
  ) {
    const orcamento = await this.prepararEnvio(empresaId, id, usuarioId);
    const envio = await this.whatsapp.enviarOrcamento(
      empresaId,
      orcamento.oportunidadeId,
      {
        texto,
        valorEstimado: orcamento.total,
        arquivoId: orcamento.arquivoId,
      },
      usuarioId,
    );
    return { orcamento, envio };
  }

  /**
   * No fechamento GANHA: o último orçamento montado vira CONVERTIDO
   * (mesmo se ainda for rascunho / sem envio WhatsApp).
   */
  async converterNoFechamento(
    empresaId: string,
    oportunidadeId: string,
    usuarioId?: string | null,
  ) {
    return this.prisma.$transaction(async (tx) =>
      this.converterOrcamentoFinal(tx, empresaId, oportunidadeId, usuarioId),
    );
  }

  async converterOrcamentoFinal(
    tx: Prisma.TransactionClient,
    empresaId: string,
    oportunidadeId: string,
    usuarioId?: string | null,
  ): Promise<string | null> {
    const jaConvertido = await tx.orcamento.findFirst({
      where: {
        empresaId,
        oportunidadeId,
        status: StatusOrcamento.CONVERTIDO,
      },
      orderBy: { convertidoEm: 'desc' },
    });
    if (jaConvertido) return jaConvertido.id;

    const candidatos = [
      StatusOrcamento.ENVIADO,
      StatusOrcamento.ACEITO,
      StatusOrcamento.RASCUNHO,
    ] as const;

    let final = await tx.orcamento.findFirst({
      where: {
        empresaId,
        oportunidadeId,
        vigente: true,
        status: { in: [...candidatos] },
      },
      include: { itens: { select: { id: true } } },
    });

    if (!final || final.itens.length === 0) {
      final = await tx.orcamento.findFirst({
        where: {
          empresaId,
          oportunidadeId,
          status: { in: [...candidatos] },
          itens: { some: {} },
        },
        orderBy: [{ atualizadoEm: 'desc' }, { versao: 'desc' }],
        include: { itens: { select: { id: true } } },
      });
    }

    if (!final || final.itens.length === 0) return null;

    await this.produtos.baixarPorOrcamento(
      tx,
      empresaId,
      final.id,
      oportunidadeId,
      usuarioId,
    );

    await tx.orcamento.updateMany({
      where: { oportunidadeId, empresaId, vigente: true, id: { not: final.id } },
      data: { vigente: false },
    });

    await tx.orcamento.update({
      where: { id: final.id },
      data: {
        status: StatusOrcamento.CONVERTIDO,
        vigente: true,
        convertidoEm: new Date(),
      },
    });

    return final.id;
  }

  async cancelarVigenteNoPerdido(empresaId: string, oportunidadeId: string) {
    await this.prisma.orcamento.updateMany({
      where: {
        empresaId,
        oportunidadeId,
        vigente: true,
        status: { in: [StatusOrcamento.ENVIADO, StatusOrcamento.ACEITO, StatusOrcamento.RASCUNHO] },
      },
      data: { status: StatusOrcamento.CANCELADO, vigente: false },
    });
  }


  /** ECOL-12 — marca enviado sem WhatsApp; trava edição e grava enviadoEm. */
  async marcarEnviado(empresaId: string, id: string) {
    const orcamento = await this.obter(empresaId, id);
    if (orcamento.status !== StatusOrcamento.RASCUNHO) {
      throw Erros.invalido(
        'ORCAMENTO_NAO_ENVIAVEL',
        'So e possivel marcar como enviado um orcamento em rascunho',
      );
    }
    if (orcamento.itens.length === 0) {
      throw Erros.invalido('ORCAMENTO_SEM_ITENS', 'Inclua itens antes de marcar como enviado');
    }

    const ecolume = await this.permissoes.empresaEcolume(empresaId);
    const agora = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.orcamento.updateMany({
        where: { oportunidadeId: orcamento.oportunidadeId, empresaId, vigente: true },
        data: { vigente: false },
      });
      if (ecolume) {
        await tx.orcamento.updateMany({
          where: {
            oportunidadeId: orcamento.oportunidadeId,
            empresaId,
            status: StatusOrcamento.ENVIADO,
            id: { not: id },
          },
          data: { status: StatusOrcamento.SUBSTITUIDO, vigente: false },
        });
      }
      await tx.orcamento.update({
        where: { id },
        data: {
          status: StatusOrcamento.ENVIADO,
          vigente: true,
          enviadoEm: agora,
        },
      });
      await tx.oportunidade.update({
        where: { id: orcamento.oportunidadeId },
        data: {
          valorEstimado: orcamento.total,
          codigoOrcamento: orcamento.numero,
        },
      });
    });

    return this.obter(empresaId, id);
  }

  async marcarRecusado(empresaId: string, id: string) {
    const orcamento = await this.obter(empresaId, id);
    if (orcamento.status !== StatusOrcamento.ENVIADO) {
      throw Erros.invalido(
        'TRANSICAO_INVALIDA',
        'So e possivel recusar orcamentos enviados',
      );
    }
    await this.prisma.orcamento.update({
      where: { id },
      data: { status: StatusOrcamento.RECUSADO, vigente: false },
    });
    return this.obter(empresaId, id);
  }

  /**
   * §16.2 — exclusão física de orçamento em RASCUNHO (ECOLUME). Sem efeito em estoque,
   * pagamento ou comissão; a trilha fica em LogAuditoria na mesma transação.
   */
  async excluir(empresaId: string, id: string, ator: { id: string; perfil: string }) {
    if (!(await this.permissoes.empresaEcolume(empresaId))) {
      throw Erros.naoEncontrado(
        'ORCAMENTO_EXCLUSAO_INDISPONIVEL',
        'Exclusao de orcamento nao esta disponivel para esta empresa',
      );
    }
    await this.permissoes.afirmar(
      { id: ator.id, empresaId, perfil: ator.perfil },
      PermissaoComercial.EXCLUIR_ORCAMENTO_RASCUNHO,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`orcamento-exclusao:${empresaId}:${id}`}))
      `;
      const orcamento = await tx.orcamento.findFirst({
        where: { id, empresaId },
        select: {
          id: true,
          numero: true,
          status: true,
          total: true,
          oportunidadeId: true,
        },
      });
      if (!orcamento) {
        throw Erros.naoEncontrado('ORCAMENTO_NAO_ENCONTRADO', 'Orcamento nao encontrado');
      }
      if (orcamento.status !== StatusOrcamento.RASCUNHO) {
        throw Erros.conflito(
          'ORCAMENTO_NAO_EXCLUIVEL',
          'So e possivel excluir orcamentos em rascunho',
        );
      }
      const pedido = await tx.pedido.findFirst({
        where: { orcamentoId: id, empresaId },
        select: { id: true },
      });
      if (pedido) {
        throw Erros.conflito(
          'ORCAMENTO_COM_PEDIDO',
          'Este orcamento possui pedido vinculado e nao pode ser excluido',
        );
      }

      const apagados = await tx.orcamento.deleteMany({
        where: { id, empresaId, status: StatusOrcamento.RASCUNHO },
      });
      if (apagados.count === 0) {
        throw Erros.naoEncontrado('ORCAMENTO_NAO_ENCONTRADO', 'Orcamento nao encontrado');
      }

      await this.auditoria?.registrar(tx, {
        empresaId,
        usuarioId: ator.id,
        tipo: TipoAuditoria.EXCLUSAO_ORCAMENTO,
        entidade: 'ORCAMENTO',
        entidadeId: orcamento.id,
        anterior: {
          numero: orcamento.numero,
          status: orcamento.status,
          total: orcamento.total,
          oportunidadeId: orcamento.oportunidadeId,
        },
        posterior: null,
      });
    });

    return { ok: true };
  }

  private assertEditavel(status: string) {
    if (STATUS_TRAVADOS.has(status) || status !== StatusOrcamento.RASCUNHO) {
      throw Erros.invalido(
        'ORCAMENTO_BLOQUEADO',
        'So e possivel editar orcamentos em rascunho',
      );
    }
  }

  private async reservarNumero(
    tx: Prisma.TransactionClient,
    empresaId: string,
    oportunidadeId: string,
    ecolume: boolean,
  ): Promise<{ numero: string; versao: number }> {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${`${empresaId}:orcamento-numero`}))
    `;

    if (!ecolume) {
      const ultima = await tx.orcamento.findFirst({
        where: { empresaId, oportunidadeId },
        orderBy: { versao: 'desc' },
        select: { versao: true },
      });
      const versao = (ultima?.versao ?? 0) + 1;
      const contagem = await tx.orcamento.count({ where: { empresaId } });
      return {
        numero: `ORC-${String(contagem + 1).padStart(4, '0')}-v${versao}`,
        versao,
      };
    }

    const lista = await tx.orcamento.findMany({
      where: { empresaId, numero: { startsWith: 'ORC-' } },
      select: { numero: true },
    });
    let max = 0;
    for (const o of lista) {
      const m = /^ORC-(\d+)$/.exec(o.numero);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return {
      numero: `ORC-${String(max + 1).padStart(4, '0')}`,
      versao: 1,
    };
  }

  private async paramsMontagem(empresaId: string): Promise<{
    descontoMaximoPercentual: number | null;
    margemPadraoGlobal: number | null;
    validadeOrcamentoDias: number | null;
  }> {
    const emp = this.platform?.empresa
      ? await this.platform.empresa.findUnique({
          where: { id: empresaId },
          select: { configuracoes: true },
        })
      : null;
    return {
      descontoMaximoPercentual: lerDescontoMaximoPercentual(emp?.configuracoes),
      margemPadraoGlobal: lerMargemPadraoGlobal(emp?.configuracoes),
      validadeOrcamentoDias: lerValidadeOrcamentoDias(emp?.configuracoes),
    };
  }

  private async montarItens(
    empresaId: string,
    itens: ItemInput[],
    opcoes: {
      ecolume: boolean;
      podeVerCustos: boolean;
      podeAlterarPreco?: boolean;
      descontoMaximoPercentual?: number | null;
      margemPadraoGlobal?: number | null;
      validadeOrcamentoDias?: number | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const saida = [];
    let totalSugerido = 0;
    for (let i = 0; i < itens.length; i++) {
      const bruto = itens[i]!;
      const salvarNoCadastro = Boolean(bruto.salvarNoCadastro);
      const fornecedorId = bruto.fornecedorId ?? null;
      const item: ItemInput = {
        produtoId: bruto.produtoId,
        nome: bruto.nome,
        unidade: bruto.unidade,
        quantidade: bruto.quantidade,
        precoUnitario: bruto.precoUnitario,
        desconto: bruto.desconto,
        codigoInterno: bruto.codigoInterno,
        baseCusto: bruto.baseCusto,
        custoBase: bruto.custoBase,
        ipiPercentual: bruto.ipiPercentual,
        stPercentual: bruto.stPercentual,
        margem: bruto.margem,
        precoManual: bruto.precoManual,
      };

      if (salvarNoCadastro) {
        if (!opcoes.ecolume) {
          throw Erros.invalido('CADASTRO_RAPIDO_INDISPONIVEL', 'Cadastro rapido so na personalizacao ECOLUME');
        }
        if (!tx) {
          throw Erros.invalido('CADASTRO_RAPIDO_TX', 'Cadastro rapido exige transacao do orcamento');
        }
        if (!opcoes.podeVerCustos) {
          throw Erros.invalido(
            'PRECO_ALTERACAO_INDISPONIVEL',
            'Sem VER_CUSTOS e sem limite ECOL-02, o cadastro rapido nao pode informar custo/preco',
          );
        }
        if (item.produtoId) {
          throw Erros.invalido('CADASTRO_RAPIDO_INVALIDO', 'Item com produto nao usa cadastro rapido');
        }
        if (!fornecedorId) {
          throw Erros.invalido('FORNECEDOR_OBRIGATORIO', 'Informe o fornecedor do item novo');
        }
        if (item.custoBase == null) {
          throw Erros.invalido('CUSTO_REFERENCIA_OBRIGATORIO', 'Informe o custo de referencia do item novo');
        }
        if (item.margem == null || item.margem <= 0) {
          throw Erros.invalido('MARGEM_OBRIGATORIA', 'Informe a margem do item novo');
        }

        const preview = montarItemEcolume(
          {
            ...item,
            baseCusto: 'INFORMADO',
            stPercentual: item.stPercentual ?? 0,
          },
          null,
          i,
          true,
          {
            descontoMaximoPercentual: opcoes.descontoMaximoPercentual,
            margemPadraoGlobal: opcoes.margemPadraoGlobal,
          },
        );
        if (preview.erro) throw Erros.invalido(preview.erro.codigo, preview.erro.mensagem);

        const criado = await this.produtos.criarCadastroRapidoTx(tx, empresaId, {
          nome: item.nome,
          descricaoComercial: item.nome,
          unidade: item.unidade,
          fornecedorId,
          custoReferencia: item.custoBase,
          ipi: item.ipiPercentual ?? 0,
          margem: item.margem,
          precoVenda: preview.item.precoUnitario,
        });
        item.produtoId = criado.id;
        item.codigoInterno = criado.codigoInterno;
        item.baseCusto = 'INFORMADO';
        if (item.stPercentual == null && criado.fornecedor?.aliquotaSt != null) {
          item.stPercentual = Number(criado.fornecedor.aliquotaSt);
        }
      } else if (!opcoes.ecolume && (bruto.salvarNoCadastro || bruto.fornecedorId)) {
        // Campos ECOL-15 ignorados no legado.
      }

      let produto: Awaited<ReturnType<OrcamentosService['carregarProdutoLinha']>> = null;
      if (item.produtoId) {
        produto = await this.carregarProdutoLinha(empresaId, item.produtoId, db);
        if (!produto) {
          throw Erros.naoEncontrado('PRODUTO_NAO_ENCONTRADO', 'Produto nao encontrado');
        }
      }
      if (opcoes.ecolume) {
        const r = montarItemEcolume(item, produto, i, opcoes.podeVerCustos, {
          descontoMaximoPercentual: opcoes.descontoMaximoPercentual,
          podeAlterarPreco: opcoes.podeAlterarPreco,
          margemPadraoGlobal: opcoes.margemPadraoGlobal,
        });
        if (r.erro) throw Erros.invalido(r.erro.codigo, r.erro.mensagem);
        if (r.precoSugerido != null) {
          totalSugerido += r.precoSugerido * r.item.quantidade;
        } else {
          totalSugerido += r.item.precoUnitario * r.item.quantidade;
        }
        saida.push(r.item);
      } else {
        saida.push(montarItemLegado(item, produto, i));
      }
    }
    return { itens: saida, totalSugerido };
  }

  private async carregarProdutoLinha(
    empresaId: string,
    produtoId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    return db.produto.findFirst({
      where: { id: produtoId, empresaId },
      select: {
        id: true,
        nome: true,
        unidade: true,
        precoVenda: true,
        codigoInterno: true,
        descricaoComercial: true,
        ipi: true,
        margem: true,
        custoMedio: true,
        ultimoPreco: true,
        fornecedor: { select: { aliquotaSt: true } },
      },
    });
  }

  private async podeVerCustos(
    empresaId: string,
    usuario: UsuarioAutenticado | { id: string; perfil?: string } | string | null,
  ): Promise<boolean> {
    if (!(await this.permissoes.empresaEcolume(empresaId))) return true;
    if (usuario == null || typeof usuario === 'string') {
      // Chamadas internas/duplicar sem perfil: trata como com custo (proprietário de testes).
      return true;
    }
    const ctx = await this.permissoes.resolver({
      id: usuario.id,
      empresaId,
      perfil: usuario.perfil ?? 'VENDEDOR',
    });
    return possuiPermissao(ctx, PermissaoComercial.VER_CUSTOS);
  }

  private async podeAlterarPreco(
    empresaId: string,
    usuario: UsuarioAutenticado | { id: string; perfil?: string } | string | null,
    jaPodeVerCustos: boolean,
  ): Promise<boolean> {
    if (jaPodeVerCustos) return true;
    if (!(await this.permissoes.empresaEcolume(empresaId))) return true;
    if (usuario == null || typeof usuario === 'string') return true;
    const ctx = await this.permissoes.resolver({
      id: usuario.id,
      empresaId,
      perfil: usuario.perfil ?? 'VENDEDOR',
    });
    return possuiPermissao(ctx, PermissaoComercial.ALTERAR_PRECO);
  }

  /** Sem ALTERAR_PRECO / limite ECOL-02, desconto geral positivo bloqueado. */
  private assertDescontoGeralSemCustos(
    dto: {
      descontoValor?: number | null;
      descontoTipo?: string | null;
      descontoPercentual?: number | null;
    },
    descontoMaximoPercentual: number | null,
    podeAlterarPreco: boolean,
  ) {
    const mudaDesconto =
      (dto.descontoValor != null && dto.descontoValor > 0) ||
      (dto.descontoPercentual != null && dto.descontoPercentual > 0) ||
      dto.descontoTipo === TipoDescontoOrcamento.PERCENTUAL;
    if (!mudaDesconto) return;
    if (!podeAlterarPreco) {
      throw Erros.invalido(
        'DESCONTO_ALTERACAO_INDISPONIVEL',
        'Sem VER_CUSTOS nem ALTERAR_PRECO, o desconto nao pode ser alterado',
      );
    }
    if (descontoMaximoPercentual == null) {
      throw Erros.invalido(
        'DESCONTO_ALTERACAO_INDISPONIVEL',
        'Sem permissao de custos e sem percentual maximo (ECOL-02), o desconto nao pode ser alterado',
      );
    }
  }

  private assertDescontoEfetivo(
    totalSugerido: number,
    totalFinal: number,
    descontoMaximoPercentual: number | null,
  ) {
    const r = validarDescontoEfetivoOrcamento({
      descontoMaximoPercentual,
      totalSugerido,
      totalFinal,
    });
    if (!r.ok) throw Erros.invalido(r.codigo, r.mensagem);
  }

  private async avisosEstoque(
    empresaId: string,
    itens: Array<{ produtoId: string | null; nome: string; quantidade: number; produto?: { estoqueAtual: number; controlaEstoque: boolean; nome: string } | null }>,
  ) {
    const avisos: Array<{
      produtoId: string;
      nome: string;
      solicitado: number;
      disponivel: number;
    }> = [];

    for (const item of itens) {
      if (!item.produtoId) continue;
      const produto =
        item.produto ??
        (await this.produtos.buscar(empresaId, item.produtoId));
      if (!produto || !produto.controlaEstoque) continue;
      if (item.quantidade > produto.estoqueAtual) {
        avisos.push({
          produtoId: item.produtoId,
          nome: produto.nome,
          solicitado: item.quantidade,
          disponivel: produto.estoqueAtual,
        });
      }
    }
    return avisos;
  }

  /** ECOL-19 — primeiro ORC leva o negócio a Orçamento em aberto. */
  private async avancarParaOrcamentoEmAberto(
    tx: Prisma.TransactionClient,
    empresaId: string,
    oportunidadeId: string,
    usuarioId?: string | null,
  ) {
    await garantirEtapasEcolume(tx, empresaId);
    const destino = await tx.etapaFunil.findFirst({
      where: { empresaId, chaveSistema: ChaveEtapaSistema.ORCAMENTO_EM_ABERTO, ativo: true },
    });
    if (!destino) return;
    const opp = await tx.oportunidade.findFirst({
      where: { id: oportunidadeId, empresaId },
      include: { etapa: true },
    });
    if (!opp || opp.etapaId === destino.id) return;
    if (opp.etapa.tipo === TipoEtapaFunil.PERDIDA) return;
    await tx.oportunidade.update({
      where: { id: oportunidadeId },
      data: { etapaId: destino.id, fechadaEm: null, motivoPerda: null },
    });
    await tx.historicoEtapaOportunidade.create({
      data: {
        empresaId,
        oportunidadeId,
        etapaId: destino.id,
        etapaNome: destino.nome,
        etapaAnteriorId: opp.etapaId,
        etapaAnteriorNome: opp.etapa.nome,
        origem: OrigemHistoricoEtapa.MANUAL,
        usuarioId: usuarioId ?? null,
      },
    });
  }

}
