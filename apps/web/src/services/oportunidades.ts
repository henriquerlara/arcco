import type {
  EtapaFunil,
  Oportunidade,
  ParametrosPaginacao,
  RespostaPaginada,
} from '@/types';
import { desembrulhar, http } from './http';

export interface FiltrosOportunidade extends ParametrosPaginacao {
  etapaId?: string;
  responsavelId?: string;
  categoriaId?: string;
  prioridade?: string;
}

export interface ColunaPipeline {
  etapa: EtapaFunil;
  oportunidades: Oportunidade[];
}

export const servicoOportunidades = {
  listar(filtros: FiltrosOportunidade = {}): Promise<RespostaPaginada<Oportunidade>> {
    return http.get<RespostaPaginada<Oportunidade>>('/oportunidades', { ...filtros });
  },
  async obter(id: string): Promise<Oportunidade> {
    return desembrulhar<Oportunidade>(await http.get(`/oportunidades/${id}`));
  },
  async criar(dados: Partial<Oportunidade>): Promise<Oportunidade> {
    return desembrulhar<Oportunidade>(await http.post('/oportunidades', dados));
  },
  async atualizar(id: string, dados: Partial<Oportunidade>): Promise<Oportunidade> {
    return desembrulhar<Oportunidade>(await http.patch(`/oportunidades/${id}`, dados));
  },
  async mover(id: string, etapaId: string, motivoPerda?: string): Promise<Oportunidade> {
    return desembrulhar<Oportunidade>(
      await http.post(`/oportunidades/${id}/mover`, { etapaId, motivoPerda }),
    );
  },
  excluir(id: string): Promise<void> {
    return http.delete(`/oportunidades/${id}`);
  },
  async pipeline(filtros: Omit<FiltrosOportunidade, 'pagina' | 'porPagina'> = {}): Promise<
    ColunaPipeline[]
  > {
    return desembrulhar<ColunaPipeline[]>(
      await http.get('/oportunidades/kanban', { ...filtros }),
    );
  },
};
