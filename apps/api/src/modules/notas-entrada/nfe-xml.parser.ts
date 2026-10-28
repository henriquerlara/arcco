import { Erros } from '../../common/erros/erros';

export const LIMITE_XML_BYTES = 2 * 1024 * 1024;

export type ItemNfeXml = {
  numeroItem: number;
  codigoProduto: string;
  descricao: string;
  ncm: string | null;
  cest: string | null;
  origemFiscal: string | null;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  ipi: number | null;
};

export type NfeXmlParseado = {
  chaveAcesso: string;
  numero: string | null;
  serie: string | null;
  emitidoEm: Date | null;
  emitenteCnpj: string;
  emitenteNome: string;
  valorTotal: number;
  itens: ItemNfeXml[];
};

function textoTag(bloco: string, nome: string): string | null {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${nome}>`,
    'i',
  );
  const m = bloco.match(re);
  if (!m) return null;
  return m[1]!.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function numeroBr(valor: string | null): number | null {
  if (valor == null || valor === '') return null;
  const n = Number(valor.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function digitos(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '');
}

/** Recusa DOCTYPE/ENTITY e payloads grandes antes de qualquer parse. */
export function sanitizarXmlNfe(entrada: string | Buffer): string {
  const buffer = typeof entrada === 'string' ? Buffer.from(entrada, 'utf8') : entrada;
  if (buffer.length === 0) {
    throw Erros.invalido('XML_VAZIO', 'Arquivo XML vazio');
  }
  if (buffer.length > LIMITE_XML_BYTES) {
    throw Erros.invalido('XML_GRANDE', `XML excede o limite de ${LIMITE_XML_BYTES} bytes`);
  }
  const texto = buffer.toString('utf8');
  if (/<!DOCTYPE/i.test(texto) || /<!ENTITY/i.test(texto)) {
    throw Erros.invalido('XML_INSEGURO', 'XML com declaracoes proibidas (DOCTYPE/ENTITY)');
  }
  if (/SYSTEM\s+["']/i.test(texto) || /PUBLIC\s+["']/i.test(texto)) {
    throw Erros.invalido('XML_INSEGURO', 'XML com referencias externas proibidas');
  }
  return texto;
}

function extrairChave(xml: string): string {
  const chNFe = digitos(textoTag(xml, 'chNFe'));
  if (chNFe.length === 44) return chNFe;
  const idMatch = xml.match(/\bId\s*=\s*["']NFe(\d{44})["']/i);
  if (idMatch?.[1]) return idMatch[1];
  throw Erros.invalido('CHAVE_INVALIDA', 'Chave de acesso da NF-e ausente ou invalida');
}

function extrairOrigem(det: string): string | null {
  const orig = textoTag(det, 'orig');
  return orig != null && orig !== '' ? orig : null;
}

function extrairIpi(det: string): number | null {
  const p = numeroBr(textoTag(det, 'pIPI'));
  return p;
}

/**
 * Parser mínimo de NF-e / nfeProc sem dependência externa.
 * Não resolve entidades externas; exige chave de 44 dígitos.
 */
export function parsearNfeXml(entrada: string | Buffer): NfeXmlParseado {
  const xml = sanitizarXmlNfe(entrada);
  if (!/<(?:[\w.-]+:)?(?:nfeProc|NFe)\b/i.test(xml)) {
    throw Erros.invalido('XML_NAO_NFE', 'Documento nao reconhecido como NF-e');
  }

  const chaveAcesso = extrairChave(xml);
  const emitBloco = xml.match(
    /<(?:[\w.-]+:)?emit\b[\s\S]*?<\/(?:[\w.-]+:)?emit>/i,
  )?.[0];
  if (!emitBloco) {
    throw Erros.invalido('XML_EMITENTE', 'Emitente da NF-e nao encontrado');
  }
  const emitenteCnpj = digitos(textoTag(emitBloco, 'CNPJ'));
  if (emitenteCnpj.length !== 14) {
    throw Erros.invalido('XML_EMITENTE', 'CNPJ do emitente ausente ou invalido');
  }
  const emitenteNome = textoTag(emitBloco, 'xNome') || textoTag(emitBloco, 'xFant') || 'Fornecedor';

  const numero = textoTag(xml, 'nNF');
  const serie = textoTag(xml, 'serie');
  const dhEmi = textoTag(xml, 'dhEmi') || textoTag(xml, 'dEmi');
  let emitidoEm: Date | null = null;
  if (dhEmi) {
    const d = new Date(dhEmi);
    if (!Number.isNaN(d.getTime())) emitidoEm = d;
  }

  const vNF = numeroBr(textoTag(xml, 'vNF'));
  if (vNF == null) {
    throw Erros.invalido('XML_TOTAL', 'Valor total da NF-e nao encontrado');
  }

  const dets = [...xml.matchAll(/<(?:[\w.-]+:)?det\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?det>/gi)];
  if (dets.length === 0) {
    throw Erros.invalido('XML_ITENS', 'NF-e sem itens');
  }

  const itens: ItemNfeXml[] = dets.map((m, idx) => {
    const attrs = m[1] ?? '';
    const corpo = m[2] ?? '';
    const nItemAttr = attrs.match(/\bnItem\s*=\s*["'](\d+)["']/i)?.[1];
    const numeroItem = nItemAttr ? Number(nItemAttr) : idx + 1;
    const codigoProduto = (textoTag(corpo, 'cProd') || '').trim();
    const descricao = (textoTag(corpo, 'xProd') || codigoProduto || `Item ${numeroItem}`).trim();
    const unidade = (textoTag(corpo, 'uCom') || 'UN').trim().slice(0, 10) || 'UN';
    const quantidade = numeroBr(textoTag(corpo, 'qCom'));
    const valorUnitario = numeroBr(textoTag(corpo, 'vUnCom'));
    const valorTotal = numeroBr(textoTag(corpo, 'vProd'));
    if (quantidade == null || quantidade <= 0) {
      throw Erros.invalido('XML_ITEM', `Quantidade invalida no item ${numeroItem}`);
    }
    if (valorUnitario == null || valorUnitario < 0) {
      throw Erros.invalido('XML_ITEM', `Valor unitario invalido no item ${numeroItem}`);
    }
    return {
      numeroItem,
      codigoProduto,
      descricao,
      ncm: digitos(textoTag(corpo, 'NCM')) || null,
      cest: digitos(textoTag(corpo, 'CEST')) || null,
      origemFiscal: extrairOrigem(corpo),
      unidade,
      quantidade,
      valorUnitario,
      valorTotal: valorTotal ?? quantidade * valorUnitario,
      ipi: extrairIpi(corpo),
    };
  });

  return {
    chaveAcesso,
    numero,
    serie,
    emitidoEm,
    emitenteCnpj,
    emitenteNome,
    valorTotal: vNF,
    itens,
  };
}
