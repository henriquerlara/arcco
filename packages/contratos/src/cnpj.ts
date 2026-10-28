/** Remove máscara. */
export function digitosCnpj(valor: string): string {
  return valor.replace(/\D/g, '');
}

function digitoVerificador(base: string, pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < pesos.length; i += 1) {
    soma += Number(base[i]) * pesos[i]!;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Valida CNPJ brasileiro (14 dígitos + dígitos verificadores). */
export function cnpjValido(valor: string): boolean {
  const cnpj = digitosCnpj(valor);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;
  const d1 = digitoVerificador(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digitoVerificador(cnpj.slice(0, 12) + String(d1), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${d1}${d2}`);
}
