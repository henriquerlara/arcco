import { describe, expect, it } from 'vitest';
import { ModeloPagamentoPedido, StatusPagamentoPedido } from '@arcco/contratos';
import { arredondarDinheiro, montarLinhasPagamento } from './pagamentos-pedido';

describe('ECOL-17 modelos de pagamento §11.4', () => {
  const total = 1642.56;

  it('Pix à vista RECEBIDO', () => {
    const { linhas, soma, diferenca } = montarLinhasPagamento(total, {
      modeloPagamento: ModeloPagamentoPedido.PIX_AVISTA,
    });
    expect(linhas).toHaveLength(1);
    expect(Number(linhas[0]!.valor)).toBe(total);
    expect(linhas[0]!.status).toBe(StatusPagamentoPedido.RECEBIDO);
    expect(soma).toBe(total);
    expect(diferenca).toBe(0);
  });

  it('Cartão débito RECEBIDO', () => {
    const { linhas } = montarLinhasPagamento(total, {
      modeloPagamento: ModeloPagamentoPedido.CARTAO_DEBITO,
    });
    expect(linhas[0]!.forma).toMatch(/débito/i);
    expect(linhas[0]!.status).toBe(StatusPagamentoPedido.RECEBIDO);
  });

  it('Cartão crédito N parcelas', () => {
    const { linhas, soma } = montarLinhasPagamento(total, {
      modeloPagamento: ModeloPagamentoPedido.CARTAO_CREDITO,
      parcelas: 3,
    });
    expect(linhas).toHaveLength(3);
    expect(soma).toBe(total);
    expect(linhas[0]!.status).toBe(StatusPagamentoPedido.RECEBIDO);
    expect(linhas[1]!.status).toBe(StatusPagamentoPedido.PREVISTO);
  });

  it('Sinal 50% + restante = duas linhas 821,28', () => {
    const { linhas, soma } = montarLinhasPagamento(total, {
      modeloPagamento: ModeloPagamentoPedido.SINAL_RESTANTE_ENTREGA,
      percentualSinal: 50,
    });
    expect(linhas).toHaveLength(2);
    expect(Number(linhas[0]!.valor)).toBe(821.28);
    expect(Number(linhas[1]!.valor)).toBe(821.28);
    expect(linhas[0]!.status).toBe(StatusPagamentoPedido.RECEBIDO);
    expect(linhas[1]!.status).toBe(StatusPagamentoPedido.PREVISTO);
    expect(soma).toBe(total);
  });

  it('Sinal + boletos', () => {
    const { linhas, soma } = montarLinhasPagamento(total, {
      modeloPagamento: ModeloPagamentoPedido.SINAL_BOLETOS,
      percentualSinal: 50,
      parcelas: 2,
    });
    expect(linhas).toHaveLength(3);
    expect(linhas[0]!.forma).toBe('Sinal');
    expect(linhas[1]!.forma).toMatch(/Boleto/);
    expect(soma).toBe(total);
  });

  it('Personalizado com soma divergente não bloqueia', () => {
    const { linhas, soma, diferenca } = montarLinhasPagamento(total, {
      modeloPagamento: ModeloPagamentoPedido.PERSONALIZADO,
      linhasPersonalizadas: [
        { forma: 'Pix', valor: 500, recebido: true },
        { forma: 'Boleto', valor: 1000 },
      ],
    });
    expect(linhas).toHaveLength(2);
    expect(soma).toBe(1500);
    expect(diferenca).toBe(arredondarDinheiro(1500 - total));
    expect(diferenca).not.toBe(0);
  });
});
