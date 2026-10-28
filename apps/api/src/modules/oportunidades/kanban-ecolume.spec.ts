import { describe, expect, it } from 'vitest';
import {
  ChaveEtapaSistema,
  FaseKanbanPedido,
  StatusOrcamento,
  StatusPedido,
  TipoEtapaFunil,
} from '@arcco/contratos';
import {
  colunaPedidoDe,
  colunaPreVendaDe,
  resolverMotivoPerda,
  temOrcamentoAberto,
} from './kanban-ecolume';

describe('kanban-ecolume helpers ECOL-19', () => {
  it('novo negocio sem ORC → Novo contato', () => {
    expect(
      colunaPreVendaDe({
        chaveEtapa: ChaveEtapaSistema.NOVO_CONTATO,
        tipoEtapa: TipoEtapaFunil.ABERTA,
        orcs: [],
        temPedidoAtivo: false,
      }),
    ).toBe(ChaveEtapaSistema.NOVO_CONTATO);
  });

  it('ORC aberto → Orçamento em aberto', () => {
    expect(
      colunaPreVendaDe({
        chaveEtapa: ChaveEtapaSistema.NOVO_CONTATO,
        tipoEtapa: TipoEtapaFunil.ABERTA,
        orcs: [{ status: StatusOrcamento.RASCUNHO }],
        temPedidoAtivo: false,
      }),
    ).toBe(ChaveEtapaSistema.ORCAMENTO_EM_ABERTO);
  });

  it('sem ORC aberto com pedido → sem card pré-venda', () => {
    expect(
      colunaPreVendaDe({
        chaveEtapa: ChaveEtapaSistema.ORCAMENTO_EM_ABERTO,
        tipoEtapa: TipoEtapaFunil.ABERTA,
        orcs: [{ status: StatusOrcamento.CONVERTIDO }],
        temPedidoAtivo: true,
      }),
    ).toBeNull();
  });

  it('ORC aberto + pedido → permanece em Orçamento em aberto', () => {
    expect(
      colunaPreVendaDe({
        chaveEtapa: ChaveEtapaSistema.ORCAMENTO_EM_ABERTO,
        tipoEtapa: TipoEtapaFunil.ABERTA,
        orcs: [
          { status: StatusOrcamento.CONVERTIDO },
          { status: StatusOrcamento.ENVIADO },
        ],
        temPedidoAtivo: true,
      }),
    ).toBe(ChaveEtapaSistema.ORCAMENTO_EM_ABERTO);
  });

  it('perdido', () => {
    expect(
      colunaPreVendaDe({
        chaveEtapa: ChaveEtapaSistema.PERDIDO,
        tipoEtapa: TipoEtapaFunil.PERDIDA,
        orcs: [{ status: StatusOrcamento.RASCUNHO }],
        temPedidoAtivo: false,
      }),
    ).toBe(ChaveEtapaSistema.PERDIDO);
  });

  it('pedido confirmado / finalizado / cancelado', () => {
    expect(
      colunaPedidoDe({
        status: StatusPedido.CONFIRMADO,
        faseKanban: FaseKanbanPedido.PEDIDO_CONFIRMADO,
      }),
    ).toBe(ChaveEtapaSistema.PEDIDO_CONFIRMADO);
    expect(
      colunaPedidoDe({
        status: StatusPedido.FINALIZADO,
        faseKanban: FaseKanbanPedido.ENTREGUE,
      }),
    ).toBe(ChaveEtapaSistema.PEDIDO_FINALIZADO);
    expect(
      colunaPedidoDe({
        status: StatusPedido.CANCELADO,
        faseKanban: FaseKanbanPedido.EM_SEPARACAO,
      }),
    ).toBeNull();
  });

  it('temOrcamentoAberto', () => {
    expect(temOrcamentoAberto([{ status: StatusOrcamento.RECUSADO }])).toBe(false);
    expect(temOrcamentoAberto([{ status: StatusOrcamento.ENVIADO }])).toBe(true);
  });

  it('motivo perda exige descrição em OUTRO', () => {
    expect(resolverMotivoPerda({ codigoMotivoPerda: 'PRECO' })).toEqual({
      motivo: 'Preço',
      codigo: 'PRECO',
    });
    expect(resolverMotivoPerda({ codigoMotivoPerda: 'OUTRO' })).toEqual({
      erro: 'Descreva o motivo (Outro)',
    });
    expect(
      resolverMotivoPerda({ codigoMotivoPerda: 'OUTRO', motivoPerda: 'Cliente sumiu' }),
    ).toEqual({ motivo: 'Cliente sumiu', codigo: 'OUTRO' });
  });
});
