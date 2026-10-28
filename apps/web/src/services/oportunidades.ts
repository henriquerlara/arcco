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
  parceiroId?: string;
  periodoDe?: string;
  periodoAte?: string;
  escopo?: 'pre' | 'pos' | 'todos';
  finalizadosDias?: number;
}

export interface ColunaPipeline {
  etapa: EtapaFunil;
  oportunidades: Oportunidade[];
}

export type CardKanbanNegocio = {
  tipo: 'NEGOCIO';
  id: string;
  codigo: string;
  titulo: string;
  clienteNome: string | null;
  parceiroNome: string | null;
  valorOrcamentoAberto: number | null;
  quantidadeOrcamentos: number;
  responsavel: { id: string; nome: string; email: string } | null;
  prioridade: string;
  diasParado: number;
  etapaId: string;
  motivoPerda: string | null;
};

export type CardKanbanPedido = {
  tipo: 'PEDIDO';
  id: string;
  numero: string;
  oportunidadeId: string;
  negocioCodigo: string | null;
  negocioTitulo: string | null;
  clienteNome: string | null;
  valor: number;
  pendenciasChecklist: Array<{ tipo: string; rotulo: string }>;
  dataEntrega: string | null;
  entregaAtividadeId?: string | null;
  periodoEntrega?: string | null;
  responsavel: { id: string; nome: string; email: string } | null;
  faseKanban: string | null;
  status: string;
};

export type ColunaKanbanEcolume = {
  chave: string;
  nome: string;
  tipo: 'NEGOCIO' | 'PEDIDO';
  cards: Array<CardKanbanNegocio | CardKanbanPedido>;
};

export type PipelineEcolume = {
  modo: 'ecolume';
  preVenda: ColunaKanbanEcolume[];
  posVenda: ColunaKanbanEcolume[];
  totalOrcamentosAbertos: number;
  motivosPerda: Array<{ codigo: string; rotulo: string; exigeDescricao: boolean }>;
  finalizadosDias: number;
  etapasPre?: Record<string, string>;
};

export type ResultadoBuscaKanban = {
  tipo: 'NEGOCIO' | 'ORCAMENTO' | 'PEDIDO' | null;
  oportunidadeId: string | null;
  destaque: Record<string, string> | null;
};

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
  async mover(
    id: string,
    etapaId: string,
    motivoPerda?: string,
    codigoMotivoPerda?: string,
  ): Promise<Oportunidade> {
    return desembrulhar<Oportunidade>(
      await http.post(`/oportunidades/${id}/mover`, {
        etapaId,
        motivoPerda,
        codigoMotivoPerda,
      }),
    );
  },
  async marcarAjusteCorrigido(id: string, ajusteId?: string): Promise<Oportunidade> {
    return desembrulhar<Oportunidade>(
      await http.post(`/oportunidades/${id}/ajuste-corrigido`, ajusteId ? { ajusteId } : {}),
    );
  },
  excluir(id: string): Promise<void> {
    return http.delete(`/oportunidades/${id}`);
  },
  async pipeline(
    filtros: Omit<FiltrosOportunidade, 'pagina' | 'porPagina'> = {},
  ): Promise<ColunaPipeline[] | PipelineEcolume> {
    return desembrulhar<ColunaPipeline[] | PipelineEcolume>(
      await http.get('/oportunidades/kanban', { ...filtros }),
    );
  },
  async buscarKanban(q: string): Promise<ResultadoBuscaKanban> {
    return desembrulhar<ResultadoBuscaKanban>(
      await http.get('/oportunidades/kanban/buscar', { q }),
    );
  },
};
