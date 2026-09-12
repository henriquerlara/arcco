import type { Orcamento, Produto, MovimentacaoEstoque, ResumoEstoque } from '@/types';
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
  } = {}): Promise<Produto[]> {
    return desembrulhar<Produto[]>(
      await http.get('/produtos/estoque', {
        ...(filtros.busca ? { busca: filtros.busca } : {}),
        ...(filtros.criticos ? { criticos: '1' } : {}),
      }),
    );
  },
  async resumoEstoque(): Promise<ResumoEstoque> {
    return desembrulhar<ResumoEstoque>(await http.get('/produtos/estoque/resumo'));
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
  async ajuste(id: string, saldoContado: number, observacao: string): Promise<Produto> {
    return desembrulhar<Produto>(
      await http.post(`/produtos/${id}/ajuste`, { saldoContado, observacao }),
    );
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
    itens: Array<{
      produtoId?: string | null;
      nome: string;
      unidade?: string;
      quantidade: number;
      precoUnitario: number;
      desconto?: number;
    }>;
  }): Promise<Orcamento> {
    return desembrulhar<Orcamento>(await http.post('/orcamentos', dados));
  },
  async atualizar(
    id: string,
    dados: {
      observacoes?: string | null;
      descontoValor?: number;
      itens?: Array<{
        produtoId?: string | null;
        nome: string;
        unidade?: string;
        quantidade: number;
        precoUnitario: number;
        desconto?: number;
      }>;
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
};
