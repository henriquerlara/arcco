/**
 * Distribuicao de leads/oportunidades entre vendedores (round-robin com balanceamento
 * pela carga atual). Determinista para facilitar testes.
 */

export interface CandidatoVendedor {
  id: string;
  ativo: boolean;
  cargaAtual: number;
}

/**
 * Escolhe o vendedor com menor carga atual. Em empate, mantem ordem estavel
 * (o primeiro da lista vence), garantindo previsibilidade.
 */
export function atribuirVendedor(
  candidatos: CandidatoVendedor[],
): CandidatoVendedor | null {
  const ativos = candidatos.filter((c) => c.ativo);
  if (ativos.length === 0) return null;

  let escolhido = ativos[0]!;
  for (const candidato of ativos) {
    if (candidato.cargaAtual < escolhido.cargaAtual) {
      escolhido = candidato;
    }
  }
  return escolhido;
}

/**
 * Round-robin puro baseado em um contador (util quando nao se quer considerar carga).
 */
export function proximoRoundRobin(
  candidatos: CandidatoVendedor[],
  contador: number,
): CandidatoVendedor | null {
  const ativos = candidatos.filter((c) => c.ativo);
  if (ativos.length === 0) return null;
  const indice = ((contador % ativos.length) + ativos.length) % ativos.length;
  return ativos[indice]!;
}
