import { desembrulhar, http } from './http';

export type PreviewConversao = {
  orcamento: {
    id: string;
    numero: string;
    status: string;
    total: number;
    subtotal: number;
    itens: Array<{
      id: string;
      produtoId: string | null;
      nome: string;
      quantidade: number;
      precoUnitario: number;
      desconto: number;
      totalLinha: number;
      controlaEstoque: boolean;
      saldoAtual: number | null;
      saldoPrevisto: number | null;
      negativoPrevisto: boolean;
    }>;
  };
  outrosOrcamentosAbertos: Array<{
    id: string;
    numero: string;
    status: string;
    total: number;
  }>;
  comissao: {
    parceiroId: string;
    rtPercentual: number;
    baseCalculo: number;
    valorComissao: number;
    baseOrigem: string;
  } | null;
  avisosEstoqueNegativo: Array<{ produtoId: string; nome: string; saldoPrevisto: number }>;
};

export type ChecklistItemPedido = {
  id: string;
  tipo: string;
  rotulo: string;
  aplicavel: boolean;
  automatico: boolean;
  concluido: boolean;
  concluidoEm?: string | null;
  ordem: number;
};

export type Pedido = {
  id: string;
  numero: string;
  status: string;
  total: number;
  valorRecebido?: number;
  valorAReceber?: number;
  canceladoEm?: string | null;
  motivoCancelamento?: string | null;
  avisoPagamento?: { soma: number; totalPedido: number; diferenca: number } | null;
  alertaPagamentosRecebidos?: { valorRecebido: number; mensagem: string } | null;
  alertaComissaoPaga?: { mensagem: string } | null;
  pagamentos?: Array<Record<string, unknown>>;
  comissao?: Record<string, unknown> | null;
  checklist?: ChecklistItemPedido[];
};

export const servicoPedidos = {
  async previsualizarConversao(orcamentoId: string): Promise<PreviewConversao> {
    return desembrulhar<PreviewConversao>(
      await http.get(`/pedidos/conversao/previsualizar/${orcamentoId}`),
    );
  },
  async converter(dados: {
    orcamentoId: string;
    modeloPagamento: string;
    parcelas?: number;
    percentualSinal?: number;
    vencimentosBoletos?: string[];
    linhasPersonalizadas?: Array<{
      forma: string;
      valor: number;
      vencimentoEm?: string | null;
      recebido?: boolean;
    }>;
    orcamentosSubstituirIds?: string[];
  }): Promise<Pedido> {
    return desembrulhar<Pedido>(await http.post('/pedidos/converter', dados));
  },
  async listarPorOportunidade(oportunidadeId: string): Promise<Pedido[]> {
    return desembrulhar<Pedido[]>(await http.get(`/pedidos/oportunidade/${oportunidadeId}`));
  },
  async obter(id: string): Promise<Pedido> {
    return desembrulhar<Pedido>(await http.get(`/pedidos/${id}`));
  },
  async cancelar(
    id: string,
    dados: { motivo: string; confirmar: true },
  ): Promise<Pedido> {
    return desembrulhar<Pedido>(await http.post(`/pedidos/${id}/cancelar`, dados));
  },
  async moverKanban(
    id: string,
    faseKanban: 'PEDIDO_CONFIRMADO' | 'EM_SEPARACAO' | 'PRONTO_ENTREGA' | 'ENTREGUE',
  ): Promise<Pedido> {
    return desembrulhar<Pedido>(
      await http.post(`/pedidos/${id}/mover-kanban`, { faseKanban }),
    );
  },
  async marcarChecklist(
    pedidoId: string,
    itemId: string,
    concluido: boolean,
  ): Promise<Pedido> {
    return desembrulhar<Pedido>(
      await http.patch(`/pedidos/${pedidoId}/checklist/${itemId}`, { concluido }),
    );
  },
  async marcarPagamentoRecebido(
    pedidoId: string,
    pagamentoId: string,
    recebidoEm?: string,
  ): Promise<unknown> {
    return desembrulhar(
      await http.patch(`/pedidos/${pedidoId}/pagamentos/${pagamentoId}/receber`, {
        ...(recebidoEm ? { recebidoEm } : {}),
      }),
    );
  },
};
