/**
 * Normaliza numeros de telefone brasileiros para um formato canonico (somente digitos,
 * com codigo do pais 55). Usado para deduplicar contatos e casar conversas do WhatsApp.
 *
 * Regras:
 * - Remove tudo que nao for digito.
 * - Remove zeros de tronco a esquerda.
 * - Assume Brasil (55) quando o numero nao tras codigo de pais.
 * - Mantem numeros internacionais que ja venham com outro DDI.
 */
export function normalizarTelefone(entrada: string | null | undefined): string {
  if (!entrada) return '';

  let digitos = String(entrada).replace(/\D+/g, '');
  if (!digitos) return '';

  // Remove zeros de tronco a esquerda (ex.: 0 antes do DDD).
  digitos = digitos.replace(/^0+/, '');

  // Ja possui DDI Brasil e comprimento coerente (12 ou 13 digitos: 55 + DDD + numero).
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) {
    return digitos;
  }

  // Numero nacional sem DDI: 10 (fixo) ou 11 (celular) digitos -> prefixa 55.
  if (digitos.length === 10 || digitos.length === 11) {
    return `55${digitos}`;
  }

  // Numero internacional com outro DDI: mantem como veio.
  if (digitos.length > 13) {
    return digitos;
  }

  // Fallback: se ja parecer conter DDI, mantem; senao prefixa 55.
  if (digitos.startsWith('55')) return digitos;
  return `55${digitos}`;
}

/**
 * Formata para exibicao amigavel: +55 (11) 99999-9999.
 */
export function formatarTelefone(normalizado: string): string {
  const d = normalizarTelefone(normalizado);
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const resto = d.slice(4);
    if (resto.length === 9) {
      return `+55 (${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
    }
    return `+55 (${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  }
  return `+${d}`;
}

export function telefonesIguais(a: string, b: string): boolean {
  return normalizarTelefone(a) === normalizarTelefone(b);
}
