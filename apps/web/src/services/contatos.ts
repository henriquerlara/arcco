import type {
  Contato,
  ParametrosPaginacao,
  RespostaPaginada,
} from '@/types';
import { desembrulhar, http } from './http';

export interface FiltrosContato extends ParametrosPaginacao {
  tipo?: string;
  responsavelId?: string;
}

export const servicoContatos = {
  listar(filtros: FiltrosContato = {}): Promise<RespostaPaginada<Contato>> {
    return http.get<RespostaPaginada<Contato>>('/contatos', { ...filtros });
  },
  async obter(id: string): Promise<Contato> {
    return desembrulhar<Contato>(await http.get(`/contatos/${id}`));
  },
  async criar(dados: Partial<Contato>): Promise<Contato> {
    return desembrulhar<Contato>(await http.post('/contatos', dados));
  },
  async atualizar(id: string, dados: Partial<Contato>): Promise<Contato> {
    return desembrulhar<Contato>(await http.patch(`/contatos/${id}`, dados));
  },
  excluir(id: string): Promise<void> {
    return http.delete(`/contatos/${id}`);
  },
};
