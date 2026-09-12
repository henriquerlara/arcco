/**
 * Fila serial por telefone: processa mensagens na ordem do timestamp,
 * evitando resposta fora de ordem quando webhook/poller atrasam em lote.
 */
export class FilaMensagensPorTelefone {
  private readonly filas = new Map<string, Promise<unknown>>();

  enfileirar<T>(chave: string, trabalho: () => Promise<T>): Promise<T> {
    const anterior = this.filas.get(chave) ?? Promise.resolve();
    const proxima = anterior.catch(() => undefined).then(() => trabalho());
    // A promise guardada na fila precisa engolir rejeição: `finally` cria
    // outra promise. Sem catch, o Node trata como unhandledRejection e cai.
    const armazenada = proxima.catch(() => undefined).finally(() => {
      if (this.filas.get(chave) === armazenada) this.filas.delete(chave);
    });
    this.filas.set(chave, armazenada);
    return proxima;
  }
}
