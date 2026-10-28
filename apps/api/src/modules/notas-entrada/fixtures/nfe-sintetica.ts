/** Fixtures XML sintéticas para ECOL-07 (não são notas reais). */

export const CNPJ_EMIT_A = '11222333000181';
export const CNPJ_EMIT_B = '34028316000103';

export function montarNfeXml(opcoes: {
  chave: string;
  cnpjEmit?: string;
  nomeEmit?: string;
  numero?: string;
  serie?: string;
  vNF?: number;
  itens: Array<{
    nItem: number;
    cProd: string;
    xProd: string;
    NCM?: string;
    CEST?: string;
    orig?: string;
    uCom?: string;
    qCom: number;
    vUnCom: number;
    vProd?: number;
    pIPI?: number;
  }>;
  comDoctype?: boolean;
}): string {
  const cnpj = opcoes.cnpjEmit ?? CNPJ_EMIT_A;
  const itensXml = opcoes.itens
    .map((item) => {
      const vProd = item.vProd ?? item.qCom * item.vUnCom;
      const ipi =
        item.pIPI != null
          ? `<IPI><IPITrib><pIPI>${item.pIPI}</pIPI></IPITrib></IPI>`
          : '';
      return `<det nItem="${item.nItem}"><prod>
        <cProd>${item.cProd}</cProd>
        <xProd>${item.xProd}</xProd>
        <NCM>${item.NCM ?? '94054010'}</NCM>
        ${item.CEST ? `<CEST>${item.CEST}</CEST>` : ''}
        <CFOP>5102</CFOP>
        <uCom>${item.uCom ?? 'UN'}</uCom>
        <qCom>${item.qCom}</qCom>
        <vUnCom>${item.vUnCom}</vUnCom>
        <vProd>${vProd}</vProd>
      </prod><imposto>
        <ICMS><ICMS00><orig>${item.orig ?? '0'}</orig><CST>00</CST></ICMS00></ICMS>
        ${ipi}
      </imposto></det>`;
    })
    .join('');

  const corpo = `<?xml version="1.0" encoding="UTF-8"?>
${opcoes.comDoctype ? '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>' : ''}
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe${opcoes.chave}">
      <ide>
        <nNF>${opcoes.numero ?? '100'}</nNF>
        <serie>${opcoes.serie ?? '1'}</serie>
        <dhEmi>2026-10-20T10:00:00-03:00</dhEmi>
        <tpNF>1</tpNF>
      </ide>
      <emit>
        <CNPJ>${cnpj}</CNPJ>
        <xNome>${opcoes.nomeEmit ?? 'Fornecedor Teste LTDA'}</xNome>
      </emit>
      ${itensXml}
      <total><ICMSTot><vNF>${opcoes.vNF ?? 100}</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
  <protNFe><infProt><chNFe>${opcoes.chave}</chNFe></infProt></protNFe>
</nfeProc>`;
  return corpo;
}

export const CHAVE_A = '35261011222333000181550010000001001234567890';
export const CHAVE_B = '35261011222333000181550010000001011234567891';
export const CHAVE_C = '35261034028316000103550010000002001234567892';
export const CHAVE_D = '35261011222333000181550010000003001234567893';
export const CHAVE_E = '35261011222333000181550010000004001234567894';
export const CHAVE_F = '35261011222333000181550010000005001234567895';
export const CHAVE_G = '35261011222333000181550010000006001234567896';
export const CHAVE_H = '35261011222333000181550010000007001234567897';
