import { inflateSync } from 'node:zlib';
import PDFDocument from 'pdfkit';

export type DadosPdfOrcamento = {
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
};

const moeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function telefoneFmt(valor: string | null | undefined) {
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
}

function cnpjFmt(valor: string | null | undefined) {
  if (!valor) return null;
  const d = valor.replace(/\D/g, '');
  if (d.length !== 14) return valor;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function cabecalhoEmpresa(doc: PDFKit.PDFDocument, dados: DadosPdfOrcamento) {
  if (dados.logo) {
    try {
      doc.image(dados.logo, 48, 40, { fit: [110, 72] });
    } catch {
      /* logo inválida */
    }
  }
  const hx = dados.logo ? 172 : 48;
  const linhas = [
    dados.empresa.endereco,
    telefoneFmt(dados.empresa.telefone),
    cnpjFmt(dados.empresa.cnpj) ? `CNPJ ${cnpjFmt(dados.empresa.cnpj)}` : null,
    dados.vendedor
      ? `Vendedor: ${dados.vendedor.nome}${dados.vendedor.email ? ` · ${dados.vendedor.email}` : ''}`
      : null,
  ].filter(Boolean) as string[];

  doc.fillColor('#073b42').fontSize(14).text(dados.empresa.nome, hx, 40, { width: 370 });
  let hy = doc.y + 2;
  doc.fontSize(8).fillColor('#12383b');
  for (const linha of linhas) {
    doc.text(linha, hx, hy, { width: 370 });
    hy = doc.y + 1;
  }
  return Math.max(hy + 16, 108);
}

/** PDF legado (com SKU / versão). */
export function renderizarPdfLegado(dados: DadosPdfOrcamento): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, compress: false });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const inicio = cabecalhoEmpresa(doc, dados);
    doc.fillColor('#073b42').fontSize(14).text('Orçamento comercial', 48, inicio);
    doc.fontSize(10).fillColor('#12383b');
    doc.text(
      `Nº orçamento: ${dados.orcamento.numero}  ·  versão ${dados.orcamento.versao}  ·  ${dados.orcamento.criadoEm.toLocaleDateString('pt-BR')}`,
    );
    doc.text(`Nº pedido: ${dados.numeroPedido}`);
    const foneCliente = telefoneFmt(dados.telefoneCliente);
    doc.text(`Cliente: ${dados.cliente}${foneCliente ? `  ·  ${foneCliente}` : ''}`);
    if (dados.obra) doc.text(`Projeto: ${dados.obra}`);
    if (dados.enderecoObra) doc.text(`Endereço: ${dados.enderecoObra}`, { width: 500 });
    if (dados.orcamento.validadeEm) {
      doc.text(`Validade: ${dados.orcamento.validadeEm.toLocaleDateString('pt-BR')}`);
    }

    doc.moveDown();
    let y = desenharTabela(doc, dados, true);
    y = desenharTotais(doc, dados, y);
    y = desenharObs(doc, dados, y);
    rodape(doc, y);
    doc.end();
  });
}

/**
 * PDF comercial ECOLUME (§10.5): só descrição comercial da linha e valores persistidos.
 * Sem SKU, códigos, custos, IPI, ST, margem ou nome fiscal.
 */
export function renderizarPdfEcolume(dados: DadosPdfOrcamento): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, compress: false });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const inicio = cabecalhoEmpresa(doc, dados);
    doc.fillColor('#073b42').fontSize(14).text('Orçamento comercial', 48, inicio);
    doc.fontSize(10).fillColor('#12383b');
    doc.text(
      `${dados.orcamento.numero}  ·  ${dados.orcamento.criadoEm.toLocaleDateString('pt-BR')}`,
    );
    if (dados.numeroPedido && dados.numeroPedido !== '—') {
      doc.text(`Negócio: ${dados.numeroPedido}`);
    }
    const foneCliente = telefoneFmt(dados.telefoneCliente);
    doc.text(`Cliente: ${dados.cliente}${foneCliente ? `  ·  ${foneCliente}` : ''}`);
    if (dados.obra) doc.text(`Projeto: ${dados.obra}`);
    if (dados.enderecoObra) doc.text(`Endereço: ${dados.enderecoObra}`, { width: 500 });
    if (dados.orcamento.validadeEm) {
      doc.text(`Validade: ${dados.orcamento.validadeEm.toLocaleDateString('pt-BR')}`);
    }

    doc.moveDown();
    let y = desenharTabela(doc, dados, false);
    y = desenharTotais(doc, dados, y);
    y = desenharObs(doc, dados, y);
    rodape(doc, y);
    doc.end();
  });
}

function desenharTabela(doc: PDFKit.PDFDocument, dados: DadosPdfOrcamento, comSku: boolean) {
  const y0 = doc.y;
  doc.fontSize(9).fillColor('#687473');
  doc.text('Qtd', 48, y0, { width: 36 });
  doc.text('Und.', 86, y0, { width: 36 });
  doc.text('Item', 126, y0, { width: 210 });
  doc.text('Unit.', 340, y0, { width: 90 });
  doc.text('Total', 430, y0, { width: 117, align: 'right' });
  doc.moveTo(48, y0 + 14).lineTo(547, y0 + 14).strokeColor('#d8d2c7').stroke();

  let y = y0 + 22;
  for (const item of dados.orcamento.itens) {
    doc.fontSize(10).fillColor('#12383b');
    const rotulo = comSku && item.sku ? `${item.nome}\n${item.sku}` : item.nome;
    const altura = Math.max(16, doc.heightOfString(rotulo, { width: 200 }));
    if (y + altura > 720) {
      doc.addPage();
      y = 48;
    }
    doc.text(String(item.quantidade), 48, y, { width: 36 });
    doc.text(item.unidade, 86, y, { width: 36 });
    doc.text(item.nome, 126, y, { width: 200 });
    let extra = 0;
    if (comSku && item.sku) {
      doc.fontSize(8).fillColor('#687473').text(item.sku, 126, y + 12, { width: 200 });
      extra = 12;
    } else if (!comSku && item.desconto > 0) {
      doc
        .fontSize(8)
        .fillColor('#687473')
        .text(`Desc. linha ${moeda(item.desconto)}`, 126, y + 12, { width: 200 });
      extra = 12;
    }
    doc.fontSize(10).fillColor('#12383b');
    doc.text(moeda(item.precoUnitario), 340, y, { width: 90 });
    doc.text(moeda(item.totalLinha), 430, y, { width: 117, align: 'right' });
    y += Math.max(altura, 16) + extra + 6;
  }
  return y;
}

function desenharTotais(doc: PDFKit.PDFDocument, dados: DadosPdfOrcamento, y: number) {
  doc.moveTo(48, y).lineTo(547, y).strokeColor('#d8d2c7').stroke();
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
  return y + 28;
}

function desenharObs(doc: PDFKit.PDFDocument, dados: DadosPdfOrcamento, y: number) {
  const obs = dados.orcamento.observacoes?.trim();
  if (!obs) return y;
  if (y > 700) {
    doc.addPage();
    y = 48;
  }
  doc.fontSize(9).fillColor('#687473').text('Observações', 48, y, { width: 500 });
  y = doc.y + 2;
  doc.fontSize(10).fillColor('#12383b').text(obs, 48, y, { width: 500 });
  return doc.y + 16;
}

function rodape(doc: PDFKit.PDFDocument, y: number) {
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
}

function decodificarLiteralPdf(literal: string): string {
  return literal
    .replace(/\\n/g, '\n')
    .replace(/\\([\\()])/g, '$1')
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

/** Hex de TJ do PDFKit é WinAnsi/latin1 (não UTF-16). */
function decodificarHexPdf(hex: string): string {
  const limpo = hex.replace(/[^0-9A-Fa-f]/g, '');
  if (!limpo) return '';
  return Buffer.from(limpo, 'hex').toString('latin1');
}

function coletarTextoDeBloco(bloco: string, partes: string[]) {
  const re = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bloco))) {
    partes.push(decodificarLiteralPdf(m[0].replace(/\)\s*Tj$/, '').slice(1)));
  }
  const reTj = /\[(.*?)\]\s*TJ/gs;
  while ((m = reTj.exec(bloco))) {
    const inner = m[1] ?? '';
    for (const pedaco of inner.matchAll(/\((?:\\.|[^\\)])*\)/g)) {
      partes.push(decodificarLiteralPdf(pedaco[0].slice(1, -1)));
    }
    for (const pedaco of inner.matchAll(/<([0-9A-Fa-f]+)>/g)) {
      partes.push(decodificarHexPdf(pedaco[1] ?? ''));
    }
  }
}

function coletarTextoDeConteudo(conteudo: string, partes: string[]) {
  // Só operadores de texto (BT…ET); evita streams de fonte/imagem.
  const blocos = conteudo.matchAll(/\bBT\b([\s\S]*?)\bET\b/g);
  let achou = false;
  for (const bloco of blocos) {
    achou = true;
    coletarTextoDeBloco(bloco[1] ?? '', partes);
  }
  if (!achou) coletarTextoDeBloco(conteudo, partes);
}

/** Extrai texto literal de um PDF gerado pelo PDFKit (para testes). */
export function extrairTextoPdf(buffer: Buffer): string {
  const raw = buffer.toString('binary');
  const partes: string[] = [];

  const reStream = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  const conteúdos: string[] = [];
  while ((m = reStream.exec(raw))) {
    let body = Buffer.from(m[1], 'binary');
    if (body[0] === 0x0d && body[1] === 0x0a) body = body.subarray(2);
    else if (body[0] === 0x0a) body = body.subarray(1);
    try {
      conteúdos.push(inflateSync(body).toString('binary'));
    } catch {
      conteúdos.push(body.toString('binary'));
    }
  }

  const candidatos = conteúdos.length > 0 ? conteúdos : [raw];
  for (const c of candidatos) {
    if (/\bBT\b/.test(c) && /\bTJ\b|\bTj\b/.test(c)) {
      coletarTextoDeConteudo(c, partes);
    }
  }
  if (partes.length === 0) coletarTextoDeConteudo(raw, partes);
  // PDFKit fragmenta por kerning; junta sem espaço e normaliza depois nos testes.
  return partes.join('');
}

/** Remove espaços/NBSP para asserções tolerantes ao kerning do PDFKit. */
export function compactarTextoPdf(texto: string): string {
  return texto.replace(/[\s\u00a0]+/g, '');
}

/** Termos que não podem aparecer no PDF comercial ECOLUME. */
export const TERMOS_PROIBIDOS_PDF_ECOLUME = [
  'custoMedio',
  'custo médio',
  'Custo médio',
  'ultimoPreco',
  'último preço',
  'custoBase',
  'IPI',
  'margem',
  'Margem',
  'fornecedor',
  'Fornecedor',
  'nomeFiscal',
  'NCM',
  'CEST',
  'EAN',
  'SKU',
  'codigoInterno',
  'código interno',
] as const;
