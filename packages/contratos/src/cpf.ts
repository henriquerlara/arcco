/** Remove máscara. */
export function digitosCpf(valor: string): string {
  return valor.replace(/\D/g, '');
}

function digitoVerificadorCpf(base: string, pesoInicial: number): number {
  let soma = 0;
  for (let i = 0; i < base.length; i += 1) {
    soma += Number(base[i]) * (pesoInicial - i);
  }
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/** Valida CPF brasileiro (11 dígitos + dígitos verificadores). */
export function cpfValido(valor: string): boolean {
  const cpf = digitosCpf(valor);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;
  const d1 = digitoVerificadorCpf(cpf.slice(0, 9), 10);
  const d2 = digitoVerificadorCpf(cpf.slice(0, 10), 11);
  return cpf.endsWith(`${d1}${d2}`);
}
