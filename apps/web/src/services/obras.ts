import type { Obra, ParametrosPaginacao, RespostaPaginada } from '@/types';
import { desembrulhar, http } from './http';

export interface FiltrosObra extends ParametrosPaginacao {
  status?: string;
  cidade?: string;
}

export const servicoObras = {
  listar(filtros: FiltrosObra = {}): Promise<RespostaPaginada<Obra>> {
    return http.get<RespostaPaginada<Obra>>('/obras', { ...filtros });
  },
  async obter(id: string): Promise<Obra> {
    return desembrulhar<Obra>(await http.get(`/obras/${id}`));
  },
  async criar(dados: Partial<Obra>): Promise<Obra> {
    return desembrulhar<Obra>(await http.post('/obras', dados));
  },
  async atualizar(id: string, dados: Partial<Obra>): Promise<Obra> {
    return desembrulhar<Obra>(await http.patch(`/obras/${id}`, dados));
  },
  excluir(id: string): Promise<void> {
    return http.delete(`/obras/${id}`);
  },
  vincularContato(obraId: string, contatoId: string, papel: string): Promise<void> {
    return http.post(`/obras/${obraId}/contatos`, { contatoId, papel });
  },
  desvincularContato(obraId: string, vinculoId: string): Promise<void> {
    return http.delete(`/obras/${obraId}/contatos/${vinculoId}`);
  },
};
