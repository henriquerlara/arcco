import { randomUUID } from 'node:crypto';
import {
  lerAjustes,
  statusGeralAjustes,
  type ItemAjuste,
} from './ajustes';

export function novoItemAjuste(texto: string): ItemAjuste {
  return {
    id: randomUUID(),
    texto: texto.trim(),
    status: 'pendente',
    criadoEm: new Date().toISOString(),
  };
}

export function persistirAjustes(
  dados: Record<string, unknown>,
  ajustes: ItemAjuste[],
): Record<string, unknown> {
  const comId = ajustes.map((item) =>
    item.id.startsWith('legado-') || !item.id
      ? { ...item, id: randomUUID() }
      : item,
  );
  return {
    ...dados,
    ajustes: comId,
    ajuste_status: statusGeralAjustes(comId),
  };
}

export { lerAjustes, statusGeralAjustes };
export type { ItemAjuste };
