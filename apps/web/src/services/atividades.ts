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
  pedidoId?: string;
  oportunidadeId?: string;
  entregasAFazer?: boolean;
  de?: string;
  ate?: string;
}

export type SugestaoEntrega = {
  pedidoId: string;
  numero: string;
  oportunidadeId: string;
  negocioCodigo: string;
  negocioTitulo: string;
  contatoId: string;
  tituloSugerido: string;
  responsavelIdSugerido: string | null;
  contatoLocalNome: string;
  contatoLocalTelefone: string;
  endereco: {
    origem: 'OBRA' | 'CLIENTE';
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
  };
  itensConferencia: Array<{
    id: string;
    descricaoComercial: string;
    nomeFiscal: string;
    quantidade: number;
    unidade: string;
  }>;
};

export const servicoAtividades = {
  listar(filtros: FiltrosAtividade = {}): Promise<RespostaPaginada<Atividade>> {
    return http.get<RespostaPaginada<Atividade>>('/atividades', { ...filtros });
  },
  async obter(id: string): Promise<Atividade> {
    return desembrulhar<Atividade>(await http.get(`/atividades/${id}`));
  },
  async criar(dados: Record<string, unknown>): Promise<Atividade> {
    return desembrulhar<Atividade>(await http.post('/atividades', dados));
  },
  async atualizar(id: string, dados: Record<string, unknown>): Promise<Atividade> {
    return desembrulhar<Atividade>(await http.patch(`/atividades/${id}`, dados));
  },
  async concluir(id: string, concluida = true): Promise<Atividade> {
    if (!concluida) {
      return desembrulhar<Atividade>(await http.patch(`/atividades/${id}`, { concluida: false }));
    }
    return desembrulhar<Atividade>(await http.post(`/atividades/${id}/concluir`));
  },
  async concluirEntrega(id: string, final: boolean): Promise<Atividade> {
    return desembrulhar<Atividade>(
      await http.post(`/atividades/${id}/concluir-entrega`, { final }),
    );
  },
  async concluirFollowUp(id: string, resultado: string): Promise<Atividade> {
    return desembrulhar<Atividade>(
      await http.post(`/atividades/${id}/concluir-follow-up`, { resultado }),
    );
  },
  async sugerirEntrega(pedidoId: string): Promise<SugestaoEntrega> {
    return desembrulhar<SugestaoEntrega>(
      await http.get(`/atividades/entrega/sugerir/${pedidoId}`),
    );
  },
  async resumoAgenda(todas = false): Promise<{
    doDia: number;
    atrasadas: number;
    total: number;
    itens: Array<{
      id: string;
      tipo: string;
      titulo: string;
      vencimento: string;
      atrasada: boolean;
      doDia: boolean;
      oportunidadeId: string | null;
      negocioCodigo: string | null;
      contatoNome: string | null;
      pedidoId: string | null;
      pedidoNumero: string | null;
    }>;
  }> {
    return desembrulhar(
      await http.get('/atividades/resumo-agenda', { todas: todas ? '1' : undefined }),
    );
  },
  excluir(id: string): Promise<void> {
    return http.delete(`/atividades/${id}`);
  },
};
