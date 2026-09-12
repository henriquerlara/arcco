export interface ItemAjuste {
  id: string;
  texto: string;
  status: 'pendente' | 'corrigido';
  criadoEm: string;
}

function itemDeBruto(valor: unknown): ItemAjuste | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const obj = valor as Record<string, unknown>;
  const texto = String(obj.texto ?? '').trim();
  if (!texto) return null;
  return {
    id: typeof obj.id === 'string' && obj.id ? obj.id : '',
    texto,
    status: obj.status === 'corrigido' ? 'corrigido' : 'pendente',
    criadoEm: typeof obj.criadoEm === 'string' ? obj.criadoEm : '',
  };
}

/** Lê a lista de ajustes (array novo) ou parte a descrição antiga em blocos. */
export function lerAjustes(
  dados: Record<string, unknown> | null | undefined,
  descricao?: string | null,
): ItemAjuste[] {
  const bruto = dados?.ajustes;
  if (Array.isArray(bruto) && bruto.length > 0) {
    return bruto.map(itemDeBruto).filter((item): item is ItemAjuste => item !== null);
  }

  const partes = String(descricao ?? '')
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (partes.length === 0) return [];

  const statusGlobal: ItemAjuste['status'] =
    String(dados?.ajuste_status ?? 'pendente') === 'corrigido' ? 'corrigido' : 'pendente';

  return partes.map((texto, indice) => ({
    id: `legado-${indice}`,
    texto,
    status: statusGlobal,
    criadoEm: '',
  }));
}

export function statusGeralAjustes(ajustes: ItemAjuste[]): 'pendente' | 'corrigido' {
  if (ajustes.length === 0) return 'pendente';
  return ajustes.every((item) => item.status === 'corrigido') ? 'corrigido' : 'pendente';
}

export function temAjustePendente(
  dados: Record<string, unknown> | null | undefined,
  descricao?: string | null,
): boolean {
  const tipo = String(dados?.tipo_solicitacao ?? '').toLowerCase();
  if (!tipo.includes('ajuste')) return false;
  const lista = lerAjustes(dados, descricao);
  if (lista.length > 0) return lista.some((item) => item.status === 'pendente');
  return String(dados?.ajuste_status ?? 'pendente') !== 'corrigido';
}
