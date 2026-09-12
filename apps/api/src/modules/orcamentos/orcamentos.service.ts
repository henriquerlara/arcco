import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  StatusOrcamento,
  type atualizarOrcamentoSchema,
  type criarOrcamentoSchema,
  type itemOrcamentoInputSchema,
} from '@arcco/contratos';
import type { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { ArquivosService } from '../arquivos/arquivos.service';
import { ProdutosService } from '../produtos/produtos.service';

type ItemInput = z.infer<typeof itemOrcamentoInputSchema>;
type CriarOrcamentoInput = z.infer<typeof criarOrcamentoSchema>;
type AtualizarOrcamentoInput = z.infer<typeof atualizarOrcamentoSchema>;

const INCLUDE = {
  itens: { include: { produto: true }, orderBy: { ordem: 'asc' as const } },
} as const;

@Injectable()
export class OrcamentosService {
  private readonly logger = new Logger(OrcamentosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly arquivos: ArquivosService,
    private readonly produtos: ProdutosService,
  ) {}

  listarPorOportunidade(empresaId: string, oportunidadeId: string) {
    return this.prisma.orcamento.findMany({
      where: { empresaId, oportunidadeId },
      include: INCLUDE,
      orderBy: { versao: 'desc' },
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
      const orc = await tx.orcamento.create({
        data: {
          empresaId,
          oportunidadeId: dto.oportunidadeId,
          numero,
          versao,
          status: StatusOrcamento.RASCUNHO,
          vigente: false,
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

    await this.prisma.$transaction(async (tx) => {
      if (itens) {
        await tx.itemOrcamento.deleteMany({ where: { orcamentoId: id } });
        await tx.itemOrcamento.createMany({
          data: itens.map((item) => ({ ...item, orcamentoId: id })),
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
    const empresa = await this.prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });

    let logoBuffer: Buffer | null = null;
    if (empresa.logoArquivoId) {
      try {
        const { buffer } = await this.arquivos.conteudo(empresaId, empresa.logoArquivoId);
        logoBuffer = buffer;
      } catch {
        this.logger.warn(`Logo da empresa ${empresaId} indisponivel para PDF`);
      }
    }

    const pdf = await this.renderizarPdf({
      empresa: {
        nome: empresa.nomeFantasia || empresa.nome,
        telefone: empresa.telefone,
        cidade: empresa.cidade,
        estado: empresa.estado,
      },
      logo: logoBuffer,
      orcamento: {
        numero: orcamento.numero,
        versao: orcamento.versao,
        descontoValor: orcamento.descontoValor,
        subtotal: orcamento.subtotal,
        total: orcamento.total,
        validadeEm: orcamento.validadeEm,
        itens: orcamento.itens.map((i) => ({
          nome: i.nome,
          unidade: i.unidade,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
          desconto: i.desconto,
          totalLinha: i.totalLinha,
        })),
      },
      cliente: oportunidade?.contato.nome ?? 'Cliente',
      obra: oportunidade?.obra?.nome ?? null,
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

  async converterNoFechamento(
    empresaId: string,
    oportunidadeId: string,
    usuarioId?: string | null,
  ) {
    const vigente = await this.prisma.orcamento.findFirst({
      where: {
        empresaId,
        oportunidadeId,
        vigente: true,
        status: { in: [StatusOrcamento.ENVIADO, StatusOrcamento.ACEITO] },
      },
    });
    if (!vigente) return null;

    await this.prisma.$transaction(async (tx) => {
      await this.produtos.baixarPorOrcamento(
        tx,
        empresaId,
        vigente.id,
        oportunidadeId,
        usuarioId,
      );
      await tx.orcamento.update({
        where: { id: vigente.id },
        data: { status: StatusOrcamento.CONVERTIDO, convertidoEm: new Date() },
      });
    });

    return vigente.id;
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
        (await this.prisma.produto.findFirst({ where: { id: item.produtoId, empresaId } }));
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
    empresa: { nome: string; telefone: string | null; cidade: string | null; estado: string | null };
    logo: Buffer | null;
    orcamento: {
      numero: string;
      versao: number;
      descontoValor: number;
      subtotal: number;
      total: number;
      validadeEm: Date | null;
      itens: Array<{
        nome: string;
        unidade: string;
        quantidade: number;
        precoUnitario: number;
        desconto: number;
        totalLinha: number;
      }>;
    };
    cliente: string;
    obra: string | null;
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

      if (dados.logo) {
        try {
          doc.image(dados.logo, 48, 40, { fit: [120, 48] });
        } catch {
          /* logo inválida — segue sem imagem */
        }
      }

      doc
        .fillColor('#073b42')
        .fontSize(18)
        .text(dados.empresa.nome, dados.logo ? 180 : 48, 48, { width: 360 });
      doc
        .fontSize(9)
        .fillColor('#687473')
        .text(
          [dados.empresa.telefone, [dados.empresa.cidade, dados.empresa.estado].filter(Boolean).join(' / ')]
            .filter(Boolean)
            .join(' · ') || ' ',
          dados.logo ? 180 : 48,
          72,
        );

      doc.moveDown(2);
      doc.fillColor('#073b42').fontSize(14).text('Orçamento comercial', 48);
      doc
        .fontSize(10)
        .fillColor('#12383b')
        .text(`Nº orçamento: ${dados.orcamento.numero}  ·  versão ${dados.orcamento.versao}`)
        .text(`Nº pedido: ${dados.numeroPedido}`)
        .text(`Cliente: ${dados.cliente}`);
      if (dados.obra) doc.text(`Projeto: ${dados.obra}`);
      if (dados.orcamento.validadeEm) {
        doc.text(
          `Validade: ${dados.orcamento.validadeEm.toLocaleDateString('pt-BR')}`,
        );
      }

      doc.moveDown();
      const y0 = doc.y;
      doc.fontSize(9).fillColor('#687473');
      doc.text('Item', 48, y0, { width: 200 });
      doc.text('Qtd', 250, y0, { width: 50 });
      doc.text('Unit.', 300, y0, { width: 80 });
      doc.text('Total', 450, y0, { width: 90, align: 'right' });
      doc
        .moveTo(48, y0 + 14)
        .lineTo(547, y0 + 14)
        .strokeColor('#d8d2c7')
        .stroke();

      let y = y0 + 22;
      doc.fillColor('#12383b').fontSize(10);
      for (const item of dados.orcamento.itens) {
        if (y > 720) {
          doc.addPage();
          y = 48;
        }
        doc.text(item.nome, 48, y, { width: 190 });
        doc.text(`${item.quantidade} ${item.unidade}`, 250, y, { width: 50 });
        doc.text(moeda(item.precoUnitario), 300, y, { width: 80 });
        doc.text(moeda(item.totalLinha), 450, y, { width: 90, align: 'right' });
        y += 22;
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

      doc
        .fontSize(8)
        .fillColor('#687473')
        .text(
          'Documento gerado pela ARCCO. Este orçamento não substitui nota fiscal.',
          48,
          780,
          { width: 500, align: 'center' },
        );

      doc.end();
    });
  }
}
