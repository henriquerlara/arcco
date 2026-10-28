import {
  ModeloPagamentoPedido,
  StatusPagamentoPedido,
} from '@arcco/contratos';
import { Prisma } from '@prisma/client';

export type EntradaConversaoPagamento = {
  modeloPagamento: (typeof ModeloPagamentoPedido)[keyof typeof ModeloPagamentoPedido];
  parcelas?: number;
  percentualSinal?: number;
  vencimentosBoletos?: Date[];
  linhasPersonalizadas?: Array<{
    forma: string;
    valor: number;
    vencimentoEm?: Date | null;
    recebido?: boolean;
  }>;
};

export type LinhaPagamentoMontada = {
  modelo: (typeof ModeloPagamentoPedido)[keyof typeof ModeloPagamentoPedido];
  forma: string;
  valor: Prisma.Decimal;
  vencimentoEm: Date | null;
  status: (typeof StatusPagamentoPedido)[keyof typeof StatusPagamentoPedido];
  recebidoEm: Date | null;
  ordem: number;
};

/** Arredonda em centavos (2 casas). */
export function arredondarDinheiro(valor: number): number {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function dec(valor: number): Prisma.Decimal {
  return new Prisma.Decimal(arredondarDinheiro(valor).toFixed(4));
}

function parcelasIguais(total: number, n: number): number[] {
  const base = arredondarDinheiro(total / n);
  const valores = Array.from({ length: n }, () => base);
  const soma = arredondarDinheiro(valores.reduce((a, b) => a + b, 0));
  valores[n - 1] = arredondarDinheiro(valores[n - 1]! + (total - soma));
  return valores;
}

/**
 * ECOL-17 §11.4 — monta linhas sem gravar.
 * Pix / débito / crédito à vista (1x): RECEBIDO na conversão.
 * Sinal: RECEBIDO; restante/boletos: PREVISTO.
 * Soma ≠ total: avisada pelo chamador, não bloqueia.
 */
export function montarLinhasPagamento(
  totalPedido: number,
  entrada: EntradaConversaoPagamento,
  agora = new Date(),
): { linhas: LinhaPagamentoMontada[]; soma: number; diferenca: number } {
  const total = arredondarDinheiro(Math.max(0, totalPedido));
  const modelo = entrada.modeloPagamento;
  const linhas: LinhaPagamentoMontada[] = [];

  if (modelo === ModeloPagamentoPedido.PIX_AVISTA) {
    linhas.push({
      modelo,
      forma: 'Pix',
      valor: dec(total),
      vencimentoEm: agora,
      status: StatusPagamentoPedido.RECEBIDO,
      recebidoEm: agora,
      ordem: 0,
    });
  } else if (modelo === ModeloPagamentoPedido.CARTAO_DEBITO) {
    linhas.push({
      modelo,
      forma: 'Cartão de débito',
      valor: dec(total),
      vencimentoEm: agora,
      status: StatusPagamentoPedido.RECEBIDO,
      recebidoEm: agora,
      ordem: 0,
    });
  } else if (modelo === ModeloPagamentoPedido.CARTAO_CREDITO) {
    const n = Math.max(1, entrada.parcelas ?? 1);
    const valores = parcelasIguais(total, n);
    valores.forEach((valor, i) => {
      const aVista = n === 1;
      linhas.push({
        modelo,
        forma: n === 1 ? 'Cartão de crédito' : `Cartão de crédito ${i + 1}/${n}`,
        valor: dec(valor),
        vencimentoEm: new Date(agora.getTime() + i * 30 * 24 * 60 * 60 * 1000),
        status: aVista || i === 0 ? StatusPagamentoPedido.RECEBIDO : StatusPagamentoPedido.PREVISTO,
        recebidoEm: aVista || i === 0 ? agora : null,
        ordem: i,
      });
    });
  } else if (modelo === ModeloPagamentoPedido.SINAL_RESTANTE_ENTREGA) {
    const pct = Math.min(99, Math.max(1, entrada.percentualSinal ?? 50));
    const sinal = arredondarDinheiro((total * pct) / 100);
    const resto = arredondarDinheiro(total - sinal);
    linhas.push({
      modelo,
      forma: 'Sinal',
      valor: dec(sinal),
      vencimentoEm: agora,
      status: StatusPagamentoPedido.RECEBIDO,
      recebidoEm: agora,
      ordem: 0,
    });
    linhas.push({
      modelo,
      forma: 'Restante na entrega',
      valor: dec(resto),
      vencimentoEm: null,
      status: StatusPagamentoPedido.PREVISTO,
      recebidoEm: null,
      ordem: 1,
    });
  } else if (modelo === ModeloPagamentoPedido.SINAL_BOLETOS) {
    const pct = Math.min(99, Math.max(1, entrada.percentualSinal ?? 50));
    const n = Math.max(1, entrada.parcelas ?? 1);
    const sinal = arredondarDinheiro((total * pct) / 100);
    const resto = arredondarDinheiro(total - sinal);
    linhas.push({
      modelo,
      forma: 'Sinal',
      valor: dec(sinal),
      vencimentoEm: agora,
      status: StatusPagamentoPedido.RECEBIDO,
      recebidoEm: agora,
      ordem: 0,
    });
    const valores = parcelasIguais(resto, n);
    valores.forEach((valor, i) => {
      const venc =
        entrada.vencimentosBoletos?.[i] ??
        new Date(agora.getTime() + (i + 1) * 30 * 24 * 60 * 60 * 1000);
      linhas.push({
        modelo,
        forma: `Boleto ${i + 1}/${n}`,
        valor: dec(valor),
        vencimentoEm: venc,
        status: StatusPagamentoPedido.PREVISTO,
        recebidoEm: null,
        ordem: i + 1,
      });
    });
  } else {
    (entrada.linhasPersonalizadas ?? []).forEach((l, i) => {
      const recebido = !!l.recebido;
      linhas.push({
        modelo,
        forma: l.forma,
        valor: dec(Math.max(0, l.valor)),
        vencimentoEm: l.vencimentoEm ?? null,
        status: recebido ? StatusPagamentoPedido.RECEBIDO : StatusPagamentoPedido.PREVISTO,
        recebidoEm: recebido ? agora : null,
        ordem: i,
      });
    });
  }

  const soma = arredondarDinheiro(linhas.reduce((a, l) => a + Number(l.valor), 0));
  return { linhas, soma, diferenca: arredondarDinheiro(soma - total) };
}
