import { Erros } from '../erros/erros';

interface Registro {
  contagem: number;
  reiniciaEm: number;
}

/**
 * Rate limiter em memoria simples (por processo). Suficiente para o MVP —
 * substituir por Redis quando escalar horizontalmente.
 */
export class RateLimiterMemoria {
  private readonly mapa = new Map<string, Registro>();

  constructor(
    private readonly limite: number,
    private readonly janelaMs: number,
  ) {}

  consumir(chave: string): void {
    const agora = Date.now();
    const registro = this.mapa.get(chave);

    if (!registro || agora > registro.reiniciaEm) {
      this.mapa.set(chave, { contagem: 1, reiniciaEm: agora + this.janelaMs });
      return;
    }

    registro.contagem += 1;
    if (registro.contagem > this.limite) {
      const segundos = Math.ceil((registro.reiniciaEm - agora) / 1000);
      throw Erros.limiteTaxa(`Muitas tentativas. Tente novamente em ${segundos}s`);
    }
  }

  reiniciar(chave: string): void {
    this.mapa.delete(chave);
  }
}
