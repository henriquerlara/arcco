/**
 * ECOL-24 — parâmetros fiscais e validação cadastral (sem inventar regra tributária).
 * P3: regime, CFOP, CSOSN/CST e ST só vêm de Empresa.configuracoes quando o contador definir.
 */

export const CONFIG_FISCAL_REGIME = 'regimeTributario';
export const CONFIG_FISCAL_CFOP = 'cfopPadrao';
export const CONFIG_FISCAL_CSOSN = 'csosnPadrao';
export const CONFIG_FISCAL_CST = 'cstPadrao';
export const CONFIG_FISCAL_NATUREZA = 'naturezaOperacao';

/**
 * Mesmas chaves de `parametros-comerciais.ts` (duplicadas aqui para evitar ciclo de import).
 * Texto livre do contador — o ARCCO não deduz tributação a partir deles.
 */
export const CONFIG_FISCAL_TRATAMENTO_ST = 'tratamentoSt';
export const CONFIG_FISCAL_INFOS_COMPLEMENTARES = 'informacoesComplementaresNfe';

export type ParametrosFiscaisNfe = {
  regimeTributario: string | null;
  cfopPadrao: string | null;
  csosnPadrao: string | null;
  cstPadrao: string | null;
  naturezaOperacao: string | null;
  /** Texto do contador (P3). Não participa de `parametrosFiscaisCompletos`. */
  tratamentoSt: string | null;
  /** Texto do contador (P3). Vai em informacoes_adicionais_contribuinte. */
  informacoesComplementaresNfe: string | null;
};

export function lerParametrosFiscais(configuracoes: unknown): ParametrosFiscaisNfe {
  const raw = (configuracoes ?? {}) as Record<string, unknown>;
  const str = (k: string) => {
    const v = raw[k];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  return {
    regimeTributario: str(CONFIG_FISCAL_REGIME),
    cfopPadrao: str(CONFIG_FISCAL_CFOP),
    csosnPadrao: str(CONFIG_FISCAL_CSOSN),
    cstPadrao: str(CONFIG_FISCAL_CST),
    naturezaOperacao: str(CONFIG_FISCAL_NATUREZA),
    tratamentoSt: str(CONFIG_FISCAL_TRATAMENTO_ST),
    informacoesComplementaresNfe: str(CONFIG_FISCAL_INFOS_COMPLEMENTARES),
  };
}

/** Emissão real (Focus) exige parâmetros P3. Mock estrutural não. */
export function parametrosFiscaisCompletos(p: ParametrosFiscaisNfe): boolean {
  if (!p.regimeTributario || !p.cfopPadrao || !p.naturezaOperacao) return false;
  // Simples usa CSOSN; demais CST — exige ao menos um.
  return Boolean(p.csosnPadrao || p.cstPadrao);
}

export type PendenciaFiscal = {
  codigo: string;
  campo: string;
  mensagem: string;
  onde: string;
  itemPedidoId?: string;
};

export function digitosDoc(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '');
}
