import type {
  Orcamento,
  Produto,
  MovimentacaoEstoque,
  MovimentacaoEstoqueGlobal,
  ResumoEstoque,
  GrupoListaCompra,
  ProdutoEstoqueEcolume,
} from '@/types';
import { desembrulhar, http } from './http';

export const servicoProdutos = {
  async listar(apenasAtivos = false): Promise<Produto[]> {
    return desembrulhar<Produto[]>(
      await http.get('/produtos', apenasAtivos ? { ativos: '1' } : undefined),
    );
  },
  async listarEstoque(filtros: {
    busca?: string;
    criticos?: boolean;
    fornecedorId?: string;
    status?: string;
  } = {}): Promise<Produto[] | ProdutoEstoqueEcolume[]> {
    return desembrulhar<Produto[] | ProdutoEstoqueEcolume[]>(
      await http.get('/produtos/estoque', {
        ...(filtros.busca ? { busca: filtros.busca } : {}),
        ...(filtros.criticos ? { criticos: '1' } : {}),
        ...(filtros.fornecedorId ? { fornecedorId: filtros.fornecedorId } : {}),
        ...(filtros.status ? { status: filtros.status } : {}),
      }),
    );
  },
  async resumoEstoque(): Promise<ResumoEstoque> {
    return desembrulhar<ResumoEstoque>(await http.get('/produtos/estoque/resumo'));
  },
  async listarMovimentacoesEstoque(filtros: {
    produtoId?: string;
    tipo?: string;
    de?: string;
    ate?: string;
    usuarioId?: string;
    limite?: number;
  } = {}): Promise<MovimentacaoEstoqueGlobal[]> {
    return desembrulhar<MovimentacaoEstoqueGlobal[]>(
      await http.get('/produtos/estoque/movimentacoes', {
        ...(filtros.produtoId ? { produtoId: filtros.produtoId } : {}),
        ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
        ...(filtros.de ? { de: filtros.de } : {}),
        ...(filtros.ate ? { ate: filtros.ate } : {}),
        ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
        ...(filtros.limite ? { limite: String(filtros.limite) } : {}),
      }),
    );
  },
  async listaCompra(): Promise<GrupoListaCompra[]> {
    return desembrulhar<GrupoListaCompra[]>(await http.get('/produtos/estoque/lista-compra'));
  },
  async obter(id: string): Promise<Produto> {
    return desembrulhar<Produto>(await http.get(`/produtos/${id}`));
  },
  async movimentacoes(id: string): Promise<MovimentacaoEstoque[]> {
    return desembrulhar<MovimentacaoEstoque[]>(
      await http.get(`/produtos/${id}/movimentacoes`),
    );
  },
  async criar(dados: Partial<Produto> & { saldoInicial?: number }): Promise<Produto> {
    return desembrulhar<Produto>(await http.post('/produtos', dados));
  },
  async atualizar(id: string, dados: Partial<Produto>): Promise<Produto> {
    return desembrulhar<Produto>(await http.patch(`/produtos/${id}`, dados));
  },
  async remover(id: string): Promise<void> {
    await http.delete(`/produtos/${id}`);
  },
  async entrada(id: string, quantidade: number, observacao?: string): Promise<Produto> {
    return desembrulhar<Produto>(
      await http.post(`/produtos/${id}/entrada`, { quantidade, observacao }),
    );
  },
  async ajuste(
    id: string,
    dados:
      | { saldoContado: number; observacao: string }
      | {
          saldoContado?: number;
          diferenca?: number;
          saldoAnteriorEsperado?: number;
          motivo?: string;
          observacao?: string;
          precoUnitarioCusto?: number;
          custoReferenciaSaldo?: number;
        },
  ): Promise<Produto> {
    return desembrulhar<Produto>(await http.post(`/produtos/${id}/ajuste`, dados));
  },
};

export const servicoOrcamentos = {
  async listar(oportunidadeId: string): Promise<Orcamento[]> {
    return desembrulhar<Orcamento[]>(await http.get('/orcamentos', { oportunidadeId }));
  },
  async obter(id: string): Promise<Orcamento> {
    return desembrulhar<Orcamento>(await http.get(`/orcamentos/${id}`));
  },
  async criar(dados: {
    oportunidadeId: string;
    observacoes?: string | null;
    descontoValor?: number;
    descontoTipo?: 'VALOR' | 'PERCENTUAL';
    descontoPercentual?: number | null;
    itens: Array<Record<string, unknown>>;
  }): Promise<Orcamento> {
    return desembrulhar<Orcamento>(await http.post('/orcamentos', dados));
  },
  async atualizar(
    id: string,
    dados: {
      observacoes?: string | null;
      descontoValor?: number;
      descontoTipo?: 'VALOR' | 'PERCENTUAL';
      descontoPercentual?: number | null;
      itens?: Array<Record<string, unknown>>;
    },
  ): Promise<Orcamento> {
    return desembrulhar<Orcamento>(await http.patch(`/orcamentos/${id}`, dados));
  },
  async gerarPdf(id: string): Promise<Orcamento> {
    return desembrulhar<Orcamento>(await http.post(`/orcamentos/${id}/gerar-pdf`));
  },
  async enviar(id: string, texto: string): Promise<{ orcamento: Orcamento }> {
    return desembrulhar<{ orcamento: Orcamento }>(
      await http.post(`/orcamentos/${id}/enviar`, { texto }),
    );
  },
  async duplicar(id: string): Promise<Orcamento> {
    return desembrulhar<Orcamento>(await http.post(`/orcamentos/${id}/duplicar`));
  },
  async marcarEnviado(id: string): Promise<Orcamento> {
    return desembrulhar<Orcamento>(await http.post(`/orcamentos/${id}/marcar-enviado`));
  },
  /** §16.2 — exclui orçamento em RASCUNHO (exige EXCLUIR_ORCAMENTO_RASCUNHO). */
  async excluir(id: string): Promise<{ ok: true }> {
    return desembrulhar<{ ok: true }>(await http.delete(`/orcamentos/${id}`));
  },
};
