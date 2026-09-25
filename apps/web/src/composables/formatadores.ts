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

/** Interpreta "1.250,50", "1250.50" ou "1250" como reais. */
export function parsearMoeda(valor: string | number | null | undefined): number | null {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : null;
  }
  if (!valor) return null;
  const t = String(valor).trim().replace(/[R$\s]/gi, '');
  if (!t) return null;
  const normalizado = t.includes(',')
    ? t.replace(/\./g, '').replace(',', '.')
    : t;
  const n = Number(normalizado);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
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

export type TipoMascara = 'telefone' | 'documento' | 'cnpj' | 'cep' | 'uf' | 'ncm' | 'moeda';

/** Valor numérico no campo, sem o símbolo R$. */
export function formatarMoedaCampo(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor) || valor === 0) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

function digitos(valor: string, max: number): string {
  return valor.replace(/\D/g, '').slice(0, max);
}

function mascaraCpf(d: string): string {
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)].filter(Boolean);
  if (p.length <= 1) return p[0] ?? '';
  if (p.length === 2) return `${p[0]}.${p[1]}`;
  if (p.length === 3) return `${p[0]}.${p[1]}.${p[2]}`;
  return `${p[0]}.${p[1]}.${p[2]}-${p[3]}`;
}

function mascaraCnpj(d: string): string {
  const p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)].filter(
    Boolean,
  );
  if (p.length <= 1) return p[0] ?? '';
  if (p.length === 2) return `${p[0]}.${p[1]}`;
  if (p.length === 3) return `${p[0]}.${p[1]}.${p[2]}`;
  if (p.length === 4) return `${p[0]}.${p[1]}.${p[2]}/${p[3]}`;
  return `${p[0]}.${p[1]}.${p[2]}/${p[3]}-${p[4]}`;
}

function mascaraTelefoneDigitos(d: string): string {
  if (!d) return '';
  if (d.startsWith('55') && d.length > 11) {
    return `+55 ${mascaraTelefoneDigitos(d.slice(2, 13))}`;
  }
  const n = d.slice(0, 11);
  if (n.length <= 2) return `(${n}`;
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

function mascaraMoedaDigitos(d: string): string {
  const limpo = d.replace(/^0+/, '');
  if (!limpo) return '';
  const cents = limpo.padStart(3, '0');
  const inteiro = cents.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteiro},${cents.slice(-2)}`;
}

export function aplicarMascara(tipo: TipoMascara, valor: string | number | null | undefined): string {
  const texto = valor == null ? '' : String(valor);
  if (tipo === 'uf') return texto.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
  if (tipo === 'moeda') {
    if (typeof valor === 'number' && Number.isFinite(valor)) {
      return mascaraMoedaDigitos(String(Math.round(valor * 100)));
    }
    return mascaraMoedaDigitos(texto.replace(/\D/g, ''));
  }
  if (tipo === 'telefone') return mascaraTelefoneDigitos(digitos(texto, 13));
  if (tipo === 'cep') {
    const d = digitos(texto, 8);
    return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
  }
  if (tipo === 'ncm') {
    const d = digitos(texto, 8);
    if (d.length <= 4) return d;
    if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
    return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
  }
  if (tipo === 'cnpj') return mascaraCnpj(digitos(texto, 14));
  const doc = digitos(texto, 14);
  return doc.length > 11 ? mascaraCnpj(doc) : mascaraCpf(doc);
}

export function formatarTelefone(telefone: string | null | undefined): string {
  if (!telefone) return '—';
  const d = telefone.replace(/\D/g, '');
  if (!d) return telefone;
  return mascaraTelefoneDigitos(d.slice(0, 13));
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
