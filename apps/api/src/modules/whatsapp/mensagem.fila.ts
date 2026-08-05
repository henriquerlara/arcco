/**
 * Fila serial por telefone: processa mensagens na ordem do timestamp,
 * evitando resposta fora de ordem quando webhook/poller atrasam em lote.
 */
export class FilaMensagensPorTelefone {
  private readonly filas = new Map<string, Promise<unknown>>();

  enfileirar<T>(chave: string, trabalho: () => Promise<T>): Promise<T> {
    const anterior = this.filas.get(chave) ?? Promise.resolve();
    const proxima = anterior
      .catch(() => undefined)
      .then(() => trabalho());
    this.filas.set(
      chave,
      proxima.finally(() => {
        if (this.filas.get(chave) === proxima) this.filas.delete(chave);
      }),
    );
    return proxima;
  }
}
