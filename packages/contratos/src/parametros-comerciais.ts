/**
 * ECOL-02 — parâmetros comerciais por empresa (§16.4).
 * Defaults só onde o PDF fixa. Desconto máximo: sem default inventado (null = bloqueado).
 * Margem/validade: sugestões P6 (estrutura pronta; uso opcional).
 * Fiscal: estrutura P3 vazia — não inventar CFOP/CST/regime.
 */

import { ModeloPagamentoPedido, MOTIVOS_PERDA_PADRAO, RT_PADRAO_PARCEIRO } from './enums/index.js';
import {
  CONFIG_DIAS_ORCAMENTO_SEM_MOVIMENTACAO,
  DIAS_ORCAMENTO_SEM_MOVIMENTACAO_PADRAO,
  lerDiasOrcamentoSemMovimentacao,
} from './follow-up-orcamento.js';
import {
  CONFIG_DIAS_CHECKLIST_PENDENTE,
  DIAS_ALERTA_DASHBOARD_PADRAO,
  lerDiasChecklistPendente,
} from './dashboard-ecolume.js';
import {
  CONFIG_FISCAL_CFOP,
  CONFIG_FISCAL_CSOSN,
  CONFIG_FISCAL_CST,
  CONFIG_FISCAL_NATUREZA,
  CONFIG_FISCAL_REGIME,
  lerParametrosFiscais,
  type ParametrosFiscaisNfe,
} from './nfe-pedido.js';

export const CONFIG_RT_PADRAO_PARCEIRO = 'rtPadraoParceiro';
export const CONFIG_BASE_RT_COMISSAO = 'baseRtComissao';
export const CONFIG_MARGEM_PADRAO_GLOBAL = 'margemPadraoGlobal';
export const CONFIG_VALIDADE_ORCAMENTO_DIAS = 'validadeOrcamentoDias';
export const CONFIG_DESCONTO_MAXIMO_PERCENTUAL = 'descontoMaximoPercentual';
export const CONFIG_MODELOS_PAGAMENTO = 'modelosPagamentoHabilitados';
export const CONFIG_MOTIVOS_PERDA = 'motivosPerda';
export const CONFIG_TRATAMENTO_ST = 'tratamentoSt';
export const CONFIG_INFOS_COMPLEMENTARES_NFE = 'informacoesComplementaresNfe';

/** P1: única base aprovada até definição do contador. */
export const BaseRtComissao = {
  TOTAL_PEDIDO: 'TOTAL_PEDIDO',
} as const;
export type BaseRtComissao = (typeof BaseRtComissao)[keyof typeof BaseRtComissao];

/** Sugestões P6 (não obrigatórias no caminho crítico). */
export const MARGEM_PADRAO_GLOBAL_SUGESTAO_P6 = 1.6;
export const VALIDADE_ORCAMENTO_DIAS_SUGESTAO_P6 = 15;

export type MotivoPerdaConfig = {
  codigo: string;
  rotulo: string;
  exigeDescricao: boolean;
};

export type ParametrosComerciaisEcolume = {
  diasOrcamentoSemMovimentacao: number;
  diasChecklistPendente: number;
  rtPadraoParceiro: number;
  baseRtComissao: BaseRtComissao;
  /** null = não aplicar margem global (P6). */
  margemPadraoGlobal: number | null;
  /** null = sem validade automática (P6). */
  validadeOrcamentoDias: number | null;
  /** null = sem limite → desconto/preço manual bloqueados sem VER_CUSTOS. */
  descontoMaximoPercentual: number | null;
  modelosPagamentoHabilitados: string[];
  motivosPerda: MotivoPerdaConfig[];
  fiscal: ParametrosFiscaisNfe;
};

function str(raw: Record<string, unknown>, k: string): string | null {
  const v = raw[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function num(
  raw: Record<string, unknown>,
  k: string,
  opts: { min?: number; max?: number; integer?: boolean } = {},
): number | null {
  const v = raw[k];
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (opts.integer && !Number.isInteger(n)) return null;
  if (opts.min != null && n < opts.min) return null;
  if (opts.max != null && n > opts.max) return null;
  return n;
}

export function modelosPagamentoPadrao(): string[] {
  return Object.values(ModeloPagamentoPedido);
}

export function motivosPerdaDeConfig(configuracoes: unknown): MotivoPerdaConfig[] {
  const raw = (configuracoes ?? {}) as Record<string, unknown>;
  const lista = raw[CONFIG_MOTIVOS_PERDA];
  if (!Array.isArray(lista) || lista.length === 0) {
    return MOTIVOS_PERDA_PADRAO.map((m) => ({ ...m }));
  }
  const saida: MotivoPerdaConfig[] = [];
  for (const item of lista) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const codigo = typeof o.codigo === 'string' ? o.codigo.trim() : '';
    const rotulo = typeof o.rotulo === 'string' ? o.rotulo.trim() : '';
    if (!codigo || !rotulo) continue;
    saida.push({
      codigo: codigo.slice(0, 40),
      rotulo: rotulo.slice(0, 120),
      exigeDescricao: Boolean(o.exigeDescricao),
    });
  }
  return saida.length ? saida : MOTIVOS_PERDA_PADRAO.map((m) => ({ ...m }));
}

export function lerRtPadraoParceiro(configuracoes: unknown): number {
  const raw = (configuracoes ?? {}) as Record<string, unknown>;
  const n = num(raw, CONFIG_RT_PADRAO_PARCEIRO, { min: 0, max: 100 });
  return n ?? RT_PADRAO_PARCEIRO;
}

export function lerBaseRtComissao(configuracoes: unknown): BaseRtComissao {
  const raw = (configuracoes ?? {}) as Record<string, unknown>;
  const v = str(raw, CONFIG_BASE_RT_COMISSAO);
  // P1: só TOTAL_PEDIDO é válido
  void v;
  return BaseRtComissao.TOTAL_PEDIDO;
}

export function lerMargemPadraoGlobal(configuracoes: unknown): number | null {
  const raw = (configuracoes ?? {}) as Record<string, unknown>;
  return num(raw, CONFIG_MARGEM_PADRAO_GLOBAL, { min: 0.0001, max: 100 });
}

export function lerValidadeOrcamentoDias(configuracoes: unknown): number | null {
  const raw = (configuracoes ?? {}) as Record<string, unknown>;
  const n = num(raw, CONFIG_VALIDADE_ORCAMENTO_DIAS, { min: 1, max: 365, integer: true });
  return n;
}

export function lerDescontoMaximoPercentual(configuracoes: unknown): number | null {
  const raw = (configuracoes ?? {}) as Record<string, unknown>;
  return num(raw, CONFIG_DESCONTO_MAXIMO_PERCENTUAL, { min: 0, max: 100 });
}

export function lerModelosPagamentoHabilitados(configuracoes: unknown): string[] {
  const raw = (configuracoes ?? {}) as Record<string, unknown>;
  const lista = raw[CONFIG_MODELOS_PAGAMENTO];
  const todos = modelosPagamentoPadrao();
  if (!Array.isArray(lista) || lista.length === 0) return todos;
  const set = new Set(todos);
  const filtrados = lista
    .filter((x): x is string => typeof x === 'string' && set.has(x));
  return filtrados.length ? filtrados : todos;
}

export function lerParametrosComerciais(configuracoes: unknown): ParametrosComerciaisEcolume {
  const raw = (configuracoes ?? {}) as Record<string, unknown>;
  const fiscal = lerParametrosFiscais(configuracoes);
  return {
    diasOrcamentoSemMovimentacao: lerDiasOrcamentoSemMovimentacao(configuracoes),
    diasChecklistPendente: lerDiasChecklistPendente(configuracoes),
    rtPadraoParceiro: lerRtPadraoParceiro(configuracoes),
    baseRtComissao: lerBaseRtComissao(configuracoes),
    margemPadraoGlobal: lerMargemPadraoGlobal(configuracoes),
    validadeOrcamentoDias: lerValidadeOrcamentoDias(configuracoes),
    descontoMaximoPercentual: lerDescontoMaximoPercentual(configuracoes),
    modelosPagamentoHabilitados: lerModelosPagamentoHabilitados(configuracoes),
    motivosPerda: motivosPerdaDeConfig(configuracoes),
    fiscal,
  };
}

/** Defaults documentados (desconto máximo permanece null). */
export function parametrosComerciaisPadrao(): ParametrosComerciaisEcolume {
  return {
    diasOrcamentoSemMovimentacao: DIAS_ORCAMENTO_SEM_MOVIMENTACAO_PADRAO,
    diasChecklistPendente: DIAS_ALERTA_DASHBOARD_PADRAO,
    rtPadraoParceiro: RT_PADRAO_PARCEIRO,
    baseRtComissao: BaseRtComissao.TOTAL_PEDIDO,
    margemPadraoGlobal: null,
    validadeOrcamentoDias: null,
    descontoMaximoPercentual: null,
    modelosPagamentoHabilitados: modelosPagamentoPadrao(),
    motivosPerda: MOTIVOS_PERDA_PADRAO.map((m) => ({ ...m })),
    fiscal: {
      regimeTributario: null,
      cfopPadrao: null,
      csosnPadrao: null,
      cstPadrao: null,
      naturezaOperacao: null,
      tratamentoSt: null,
      informacoesComplementaresNfe: null,
    },
  };
}

export function percentualDescontoSobreSugerido(
  precoSugerido: number,
  precoPraticado: number,
): number {
  if (!(precoSugerido > 0)) return 0;
  if (precoPraticado >= precoSugerido - 1e-9) return 0;
  return ((precoSugerido - precoPraticado) / precoSugerido) * 100;
}

/**
 * Valida preço/desconto de linha sem VER_CUSTOS.
 * Sem limite configurado: qualquer alteração vs sugerido é bloqueada.
 */
export function validarPrecoDentroDoDescontoMaximo(entrada: {
  precoSugerido: number | null;
  precoPraticado: number;
  descontoMaximoPercentual: number | null;
}): { ok: true } | { ok: false; codigo: string; mensagem: string } {
  const sugerido = entrada.precoSugerido;
  if (sugerido == null || !(sugerido > 0)) {
    return {
      ok: false,
      codigo: 'PRECO_ALTERACAO_INDISPONIVEL',
      mensagem:
        'Sem preco sugerido e sem VER_CUSTOS, o preco manual nao pode ser informado (item avulso ou sem formula)',
    };
  }
  const diff = Math.abs(entrada.precoPraticado - sugerido);
  if (diff <= 0.009) return { ok: true };

  if (entrada.descontoMaximoPercentual == null) {
    return {
      ok: false,
      codigo: 'PRECO_ALTERACAO_INDISPONIVEL',
      mensagem:
        'Sem permissao de custos e sem percentual maximo configurado (ECOL-02), o preco nao pode ser alterado',
    };
  }

  // Aumento de preço sem VER_CUSTOS: permitido (não revela custo).
  if (entrada.precoPraticado > sugerido + 0.009) return { ok: true };

  // Tolerância monetária (R$ 0,01): arredondamento de preço não deve estourar o teto.
  const piso = sugerido * (1 - entrada.descontoMaximoPercentual / 100);
  if (entrada.precoPraticado + 0.01 < piso) {
    const pct = percentualDescontoSobreSugerido(sugerido, entrada.precoPraticado);
    return {
      ok: false,
      codigo: 'DESCONTO_ACIMA_DO_LIMITE',
      mensagem: `Desconto de ${pct.toFixed(2)}% excede o maximo de ${entrada.descontoMaximoPercentual}%`,
    };
  }
  return { ok: true };
}

/** Combina linhas + desconto geral vs total sugerido. */
export function validarDescontoEfetivoOrcamento(entrada: {
  descontoMaximoPercentual: number | null;
  totalSugerido: number;
  totalFinal: number;
}): { ok: true } | { ok: false; codigo: string; mensagem: string } {
  if (!(entrada.totalSugerido > 0)) return { ok: true };
  if (entrada.totalFinal >= entrada.totalSugerido - 1e-9) return { ok: true };

  if (entrada.descontoMaximoPercentual == null) {
    return {
      ok: false,
      codigo: 'DESCONTO_ALTERACAO_INDISPONIVEL',
      mensagem:
        'Sem permissao de custos e sem percentual maximo (ECOL-02), o desconto nao pode ser alterado',
    };
  }

  const piso =
    entrada.totalSugerido * (1 - entrada.descontoMaximoPercentual / 100);
  if (entrada.totalFinal + 0.01 < piso) {
    const pct =
      ((entrada.totalSugerido - entrada.totalFinal) / entrada.totalSugerido) * 100;
    return {
      ok: false,
      codigo: 'DESCONTO_ACIMA_DO_LIMITE',
      mensagem: `Desconto efetivo de ${pct.toFixed(2)}% excede o maximo de ${entrada.descontoMaximoPercentual}% (linhas + geral)`,
    };
  }
  return { ok: true };
}

/** Chaves fiscais/seguras graváveis em JSON (nunca token/senha). */
export const CHAVES_PARAMETROS_GRAVAVEIS = [
  CONFIG_DIAS_ORCAMENTO_SEM_MOVIMENTACAO,
  CONFIG_DIAS_CHECKLIST_PENDENTE,
  CONFIG_RT_PADRAO_PARCEIRO,
  CONFIG_BASE_RT_COMISSAO,
  CONFIG_MARGEM_PADRAO_GLOBAL,
  CONFIG_VALIDADE_ORCAMENTO_DIAS,
  CONFIG_DESCONTO_MAXIMO_PERCENTUAL,
  CONFIG_MODELOS_PAGAMENTO,
  CONFIG_MOTIVOS_PERDA,
  CONFIG_FISCAL_REGIME,
  CONFIG_FISCAL_CFOP,
  CONFIG_FISCAL_CSOSN,
  CONFIG_FISCAL_CST,
  CONFIG_FISCAL_NATUREZA,
  CONFIG_TRATAMENTO_ST,
  CONFIG_INFOS_COMPLEMENTARES_NFE,
] as const;
