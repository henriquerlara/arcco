import type {
  Atividade,
  ParametrosPaginacao,
  RespostaPaginada,
} from '@/types';
import { desembrulhar, http } from './http';

export interface FiltrosAtividade extends ParametrosPaginacao {
  tipo?: string;
  responsavelId?: string;
  concluida?: boolean;
  atrasadas?: boolean;
  de?: string;
  ate?: string;
}

export const servicoAtividades = {
  listar(filtros: FiltrosAtividade = {}): Promise<RespostaPaginada<Atividade>> {
    return http.get<RespostaPaginada<Atividade>>('/atividades', { ...filtros });
  },
  async criar(dados: Partial<Atividade>): Promise<Atividade> {
    return desembrulhar<Atividade>(await http.post('/atividades', dados));
  },
  async atualizar(id: string, dados: Partial<Atividade>): Promise<Atividade> {
    return desembrulhar<Atividade>(await http.patch(`/atividades/${id}`, dados));
  },
  async concluir(id: string, concluida = true): Promise<Atividade> {
    return desembrulhar<Atividade>(await http.patch(`/atividades/${id}`, { concluida }));
  },
  excluir(id: string): Promise<void> {
    return http.delete(`/atividades/${id}`);
  },
};
