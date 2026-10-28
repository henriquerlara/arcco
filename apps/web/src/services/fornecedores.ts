import type { Fornecedor } from '@/types';
import { desembrulhar, http } from './http';

export type FornecedorInput = {
  nome: string;
  nomeCurto?: string | null;
  cnpj: string;
  aliquotaSt: number;
  contatoNome?: string | null;
  telefone?: string | null;
  email?: string | null;
  observacoes?: string | null;
  ativo?: boolean;
};

export const servicoFornecedores = {
  async listar(busca?: string): Promise<Fornecedor[]> {
    return desembrulhar<Fornecedor[]>(
      await http.get('/fornecedores', busca ? { busca } : undefined),
    );
  },
  async obter(id: string): Promise<Fornecedor> {
    return desembrulhar<Fornecedor>(await http.get(`/fornecedores/${id}`));
  },
  async criar(dados: FornecedorInput): Promise<Fornecedor> {
    return desembrulhar<Fornecedor>(await http.post('/fornecedores', dados));
  },
  async atualizar(id: string, dados: Partial<FornecedorInput>): Promise<Fornecedor> {
    return desembrulhar<Fornecedor>(await http.patch(`/fornecedores/${id}`, dados));
  },
  async remover(id: string): Promise<void> {
    await http.delete(`/fornecedores/${id}`);
  },
};
