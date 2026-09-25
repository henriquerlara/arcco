import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  StatusOrcamento,
  type atualizarOrcamentoSchema,
  type criarOrcamentoSchema,
  type itemOrcamentoInputSchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { ArquivosService } from '../arquivos/arquivos.service';
import { ProdutosService } from '../produtos/produtos.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

type ItemInput = z.infer<typeof itemOrcamentoInputSchema>;
type CriarOrcamentoInput = z.infer<typeof criarOrcamentoSchema>;
type AtualizarOrcamentoInput = z.infer<typeof atualizarOrcamentoSchema>;

const INCLUDE = {
  itens: { include: { produto: true }, orderBy: { ordem: 'asc' as const } },
} as const;

const INCLUDE_EMISSAO = {
  itens: { include: { produto: true }, orderBy: { ordem: 'asc' as const } },
  oportunidade: { include: { contato: true, etapa: true } },
} as const;

@Injectable()
export class OrcamentosService {
  private readonly logger = new Logger(OrcamentosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platform: PlatformPrismaService,
    private readonly arquivos: ArquivosService,
    private readonly produtos: ProdutosService,
    @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsapp: WhatsAppService,
  ) {}

  listarPorOportunidade(empresaId: string, oportunidadeId: string) {
    return this.prisma.orcamento.findMany({
      where: { empresaId, oportunidadeId },
      include: INCLUDE,
      orderBy: { versao: 'desc' },
    });
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
    return { ...orcamento, avisosEstoque: await this.avisosEstoque(empresaId, orcamento.itens) };
  }

  async criar(empresaId: string, usuarioId: string | null, dto: CriarOrcamentoInput) {
    const oportunidade = await this.prisma.oportunidade.findFirst({
      where: { id: dto.oportunidadeId, empresaId },
    });
    if (!oportunidade) {
      throw Erros.naoEncontrado('OPORTUNIDADE_NAO_ENCONTRADA', 'Oportunidade nao encontrada');
    }

    const ultima = await this.prisma.orcamento.findFirst({
      where: { empresaId, oportunidadeId: dto.oportunidadeId },
      orderBy: { versao: 'desc' },
      select: { versao: true },
    });
    const versao = (ultima?.versao ?? 0) + 1;
    const contagem = await this.prisma.orcamento.count({ where: { empresaId } });
    const numero = `ORC-${String(contagem + 1).padStart(4, '0')}-v${versao}`;
    const itens = await this.montarItens(empresaId, dto.itens);
    const subtotal = itens.reduce((acc, i) => acc + i.totalLinha, 0);
    const descontoValor = dto.descontoValor ?? 0;
    const total = Math.max(0, subtotal - descontoValor);

    const criado = await this.prisma.$transaction(async (tx) => {
      // Último orçamento montado passa a ser o vigente (mesmo sem envio WhatsApp).
      if (itens.length > 0) {
        await tx.orcamento.updateMany({
          where: { oportunidadeId: dto.oportunidadeId, empresaId, vigente: true },
          data: { vigente: false },
        });
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
          descontoValor,
          subtotal,
          total,
          validadeEm: dto.validadeEm ?? null,
          criadoPorId: usuarioId,
          itens: { create: itens },
        },
        include: INCLUDE,
      });
      await tx.oportunidade.update({
        where: { id: dto.oportunidadeId },
        data: {
          valorEstimado: total,
          codigoOrcamento: numero,
        },
      });
      return orc;
    });

    return {
      ...criado,
      avisosEstoque: await this.avisosEstoque(empresaId, criado.itens),
    };
  }

  async atualizar(empresaId: string, id: string, dto: AtualizarOrcamentoInput) {
    const atual = await this.obter(empresaId, id);
    if (atual.status !== StatusOrcamento.RASCUNHO) {
      throw Erros.invalido('ORCAMENTO_BLOQUEADO', 'So e possivel editar orcamentos em rascunho');
    }

    const itens = dto.itens ? await this.montarItens(empresaId, dto.itens) : null;
    const subtotal = itens
      ? itens.reduce((acc, i) => acc + i.totalLinha, 0)
      : atual.subtotal;
    const descontoValor = dto.descontoValor ?? atual.descontoValor;
    const total = Math.max(0, subtotal - descontoValor);

    const qtdItens = itens?.length ?? atual.itens.length;
    await this.prisma.$transaction(async (tx) => {
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
          descontoValor,
          subtotal,
          total,
          validadeEm: dto.validadeEm === undefined ? undefined : dto.validadeEm,
          arquivoId: null,
          ...(qtdItens > 0 ? { vigente: true } : {}),
        },
      });
      await tx.oportunidade.update({
        where: { id: atual.oportunidadeId },
        data: {
          valorEstimado: total,
          codigoOrcamento: atual.numero,
        },
      });
    });

    return this.obter(empresaId, id);
  }

  async gerarPdf(empresaId: string, id: string, usuarioId: string | null) {
    const orcamento = await this.obter(empresaId, id);
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

    const pdf = await this.renderizarPdf({
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
          sku: i.produto?.sku ?? null,
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
    });

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

  /**
   * Marca o orçamento como enviado/vigente (aceito = último enviado) e espelha o total na oportunidade.
   * Retorna dados prontos para o WhatsAppService anexar o PDF.
   */
  async prepararEnvio(empresaId: string, id: string, usuarioId: string | null) {
    let orcamento = await this.obter(empresaId, id);
    if (orcamento.itens.length === 0) {
      throw Erros.invalido('ORCAMENTO_SEM_ITENS', 'Inclua itens antes de enviar');
    }
    if (!orcamento.arquivoId) {
      orcamento = await this.gerarPdf(empresaId, id, usuarioId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.orcamento.updateMany({
        where: { oportunidadeId: orcamento.oportunidadeId, empresaId, vigente: true },
        data: { vigente: false },
      });
      await tx.orcamento.update({
        where: { id },
        data: {
          status: StatusOrcamento.ENVIADO,
          vigente: true,
          aceitoEm: new Date(),
          enviadoEm: new Date(),
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

  private async montarItens(empresaId: string, itens: ItemInput[]) {
    const saida: Array<{
      produtoId: string | null;
      nome: string;
      unidade: string;
      quantidade: number;
      precoUnitario: number;
      desconto: number;
      totalLinha: number;
      ordem: number;
    }> = [];

    for (let i = 0; i < itens.length; i++) {
      const item = itens[i]!;
      let nome = item.nome;
      let unidade = item.unidade ?? 'un';
      let precoUnitario = item.precoUnitario;
      let produtoId: string | null = item.produtoId ?? null;

      if (produtoId) {
        const produto = await this.produtos.obter(empresaId, produtoId);
        nome = produto.nome;
        unidade = produto.unidade;
        if (item.precoUnitario === undefined || item.precoUnitario === null) {
          precoUnitario = produto.precoVenda;
        }
      }

      const desconto = item.desconto ?? 0;
      const totalLinha = Math.max(0, item.quantidade * precoUnitario - desconto);
      saida.push({
        produtoId,
        nome,
        unidade,
        quantidade: item.quantidade,
        precoUnitario,
        desconto,
        totalLinha,
        ordem: i,
      });
    }
    return saida;
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

  private renderizarPdf(dados: {
    empresa: {
      nome: string;
      telefone: string | null;
      endereco: string | null;
      cnpj: string | null;
    };
    vendedor: { nome: string; email: string } | null;
    logo: Buffer | null;
    orcamento: {
      numero: string;
      versao: number;
      descontoValor: number;
      subtotal: number;
      total: number;
      validadeEm: Date | null;
      criadoEm: Date;
      observacoes: string | null;
      itens: Array<{
        nome: string;
        sku: string | null;
        unidade: string;
        quantidade: number;
        precoUnitario: number;
        desconto: number;
        totalLinha: number;
      }>;
    };
    cliente: string;
    telefoneCliente: string | null;
    obra: string | null;
    enderecoObra: string | null;
    numeroPedido: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const moeda = (v: number) =>
        v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const telefone = (valor: string | null | undefined) => {
        if (!valor) return null;
        const d = valor.replace(/\D/g, '');
        const nacional =
          d.startsWith('55') && (d.length === 12 || d.length === 13) ? d.slice(2) : d;
        const comPais = nacional !== d;
        let formatado: string | null = null;
        if (nacional.length === 11) {
          formatado = `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
        } else if (nacional.length === 10) {
          formatado = `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
        }
        if (!formatado) return valor;
        return comPais ? `+55 ${formatado}` : formatado;
      };
      const cnpj = (valor: string | null | undefined) => {
        if (!valor) return null;
        const d = valor.replace(/\D/g, '');
        if (d.length !== 14) return valor;
        return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
      };

      if (dados.logo) {
        try {
          doc.image(dados.logo, 48, 40, { fit: [110, 72] });
        } catch {
          /* logo inválida — segue sem imagem */
        }
      }

      const hx = dados.logo ? 172 : 48;
      const cabecalho = [
        dados.empresa.endereco,
        telefone(dados.empresa.telefone),
        cnpj(dados.empresa.cnpj) ? `CNPJ ${cnpj(dados.empresa.cnpj)}` : null,
        dados.vendedor
          ? `Vendedor: ${dados.vendedor.nome}${dados.vendedor.email ? ` · ${dados.vendedor.email}` : ''}`
          : null,
      ].filter(Boolean) as string[];

      doc.fillColor('#073b42').fontSize(14).text(dados.empresa.nome, hx, 40, { width: 370 });
      let hy = doc.y + 2;
      doc.fontSize(8).fillColor('#12383b');
      for (const linha of cabecalho) {
        doc.text(linha, hx, hy, { width: 370 });
        hy = doc.y + 1;
      }

      const inicio = Math.max(hy + 16, 108);
      doc.fillColor('#073b42').fontSize(14).text('Orçamento comercial', 48, inicio);
      doc.fontSize(10).fillColor('#12383b');
      doc.text(
        `Nº orçamento: ${dados.orcamento.numero}  ·  versão ${dados.orcamento.versao}  ·  ${dados.orcamento.criadoEm.toLocaleDateString('pt-BR')}`,
      );
      doc.text(`Nº pedido: ${dados.numeroPedido}`);
      const foneCliente = telefone(dados.telefoneCliente);
      doc.text(`Cliente: ${dados.cliente}${foneCliente ? `  ·  ${foneCliente}` : ''}`);
      if (dados.obra) doc.text(`Projeto: ${dados.obra}`);
      if (dados.enderecoObra) doc.text(`Endereço: ${dados.enderecoObra}`, { width: 500 });
      if (dados.orcamento.validadeEm) {
        doc.text(`Validade: ${dados.orcamento.validadeEm.toLocaleDateString('pt-BR')}`);
      }

      doc.moveDown();
      const y0 = doc.y;
      doc.fontSize(9).fillColor('#687473');
      doc.text('Qtd', 48, y0, { width: 36 });
      doc.text('Und.', 86, y0, { width: 36 });
      doc.text('Item', 126, y0, { width: 210 });
      doc.text('Unit.', 340, y0, { width: 90 });
      doc.text('Total', 430, y0, { width: 117, align: 'right' });
      doc
        .moveTo(48, y0 + 14)
        .lineTo(547, y0 + 14)
        .strokeColor('#d8d2c7')
        .stroke();

      let y = y0 + 22;
      for (const item of dados.orcamento.itens) {
        doc.fontSize(10).fillColor('#12383b');
        const rotulo = item.sku ? `${item.nome}\n${item.sku}` : item.nome;
        const altura = Math.max(16, doc.heightOfString(rotulo, { width: 200 }));
        if (y + altura > 720) {
          doc.addPage();
          y = 48;
        }
        doc.text(String(item.quantidade), 48, y, { width: 36 });
        doc.text(item.unidade, 86, y, { width: 36 });
        doc.text(item.nome, 126, y, { width: 200 });
        if (item.sku) {
          doc.fontSize(8).fillColor('#687473').text(item.sku, 126, y + 12, { width: 200 });
        }
        doc.fontSize(10).fillColor('#12383b');
        doc.text(moeda(item.precoUnitario), 340, y, { width: 90 });
        doc.text(moeda(item.totalLinha), 430, y, { width: 117, align: 'right' });
        y += item.sku ? altura + 8 : 22;
      }

      doc
        .moveTo(48, y)
        .lineTo(547, y)
        .strokeColor('#d8d2c7')
        .stroke();
      y += 12;
      doc.fontSize(10).fillColor('#687473').text(`Subtotal: ${moeda(dados.orcamento.subtotal)}`, 350, y, {
        width: 190,
        align: 'right',
      });
      y += 16;
      if (dados.orcamento.descontoValor > 0) {
        doc.text(`Desconto: ${moeda(dados.orcamento.descontoValor)}`, 350, y, {
          width: 190,
          align: 'right',
        });
        y += 16;
      }
      doc
        .fillColor('#073b42')
        .fontSize(12)
        .text(`Total: ${moeda(dados.orcamento.total)}`, 350, y, { width: 190, align: 'right' });
      y += 28;

      const obs = dados.orcamento.observacoes?.trim();
      if (obs) {
        if (y > 700) {
          doc.addPage();
          y = 48;
        }
        doc.fontSize(9).fillColor('#687473').text('Observações', 48, y, { width: 500 });
        y = doc.y + 2;
        doc.fontSize(10).fillColor('#12383b').text(obs, 48, y, { width: 500 });
        y = doc.y + 16;
      }

      if (y > 760) {
        doc.addPage();
        y = 48;
      }
      doc
        .fontSize(8)
        .fillColor('#687473')
        .text(
          'Documento gerado pela ARCCO. Este orçamento não substitui nota fiscal.',
          48,
          Math.max(y, 780),
          { width: 500, align: 'center' },
        );

      doc.end();
    });
  }
}
