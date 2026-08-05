import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function paraData(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null;
  const data = valor instanceof Date ? valor : parseISO(valor);
  return isValid(data) ? data : null;
}

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

export function formatarNumero(valor: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR').format(valor ?? 0);
}

export function formatarPercentual(valor: number | null | undefined): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(valor ?? 0)}%`;
}

export function formatarData(valor: string | Date | null | undefined): string {
  const data = paraData(valor);
  return data ? format(data, "dd 'de' MMM 'de' yyyy", { locale: ptBR }) : '—';
}

export function formatarDataCurta(valor: string | Date | null | undefined): string {
  const data = paraData(valor);
  return data ? format(data, 'dd/MM/yyyy', { locale: ptBR }) : '—';
}

export function formatarDataHora(valor: string | Date | null | undefined): string {
  const data = paraData(valor);
  return data ? format(data, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—';
}

export function formatarHora(valor: string | Date | null | undefined): string {
  const data = paraData(valor);
  return data ? format(data, 'HH:mm', { locale: ptBR }) : '';
}

export function tempoRelativo(valor: string | Date | null | undefined): string {
  const data = paraData(valor);
  if (!data) return '';
  return formatDistanceToNow(data, { addSuffix: true, locale: ptBR });
}

export function formatarTelefone(telefone: string | null | undefined): string {
  if (!telefone) return '—';
  const d = telefone.replace(/\D/g, '');
  if (d.length === 13) {
    return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return telefone;
}

export function iniciais(nome: string | null | undefined): string {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';
  return (primeira + ultima).toUpperCase() || '?';
}

export function estaAtrasada(vencimento: string | Date | null | undefined): boolean {
  const data = paraData(vencimento);
  return data ? data.getTime() < Date.now() : false;
}
