import { TipoAtividade } from '@arcco/contratos';

/** Cores estáveis por tipo (§13.4) — ECOLUME. */
export const COR_TIPO_ATIVIDADE: Partial<Record<TipoAtividade, string>> = {
  ENTREGA: '#0f766e',
  VISITA: '#1d4ed8',
  REUNIAO: '#b45309',
  FOLLOW_UP: '#c2410c',
  TAREFA: '#475569',
};

export const LEGENDA_TIPOS_ECOLUME: Array<{ tipo: TipoAtividade; rotulo: string; cor: string }> = [
  { tipo: TipoAtividade.ENTREGA, rotulo: 'Entrega', cor: COR_TIPO_ATIVIDADE.ENTREGA! },
  { tipo: TipoAtividade.VISITA, rotulo: 'Visita', cor: COR_TIPO_ATIVIDADE.VISITA! },
  { tipo: TipoAtividade.REUNIAO, rotulo: 'Reunião', cor: COR_TIPO_ATIVIDADE.REUNIAO! },
  { tipo: TipoAtividade.FOLLOW_UP, rotulo: 'Follow-up', cor: COR_TIPO_ATIVIDADE.FOLLOW_UP! },
  { tipo: TipoAtividade.TAREFA, rotulo: 'Tarefa', cor: COR_TIPO_ATIVIDADE.TAREFA! },
];

export function corTipoAtividade(tipo: string): string {
  return COR_TIPO_ATIVIDADE[tipo as TipoAtividade] ?? '#64748b';
}
