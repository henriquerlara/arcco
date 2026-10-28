import type {
  ComissaoParceiroLinha,
  Contato,
  ParametrosPaginacao,
  RespostaPaginada,
} from '@/types';
import { desembrulhar, http } from './http';

export interface FiltrosContato extends ParametrosPaginacao {
  tipo?: string;
  natureza?: string;
  parceiro?: string;
  cidade?: string;
  responsavelId?: string;
  /** ECOL-10b — período das métricas de parceiros (YYYY-MM-DD ou ISO). */
  de?: string;
  ate?: string;
}

export interface FiltrosComissoes extends ParametrosPaginacao {
  de?: string;
  ate?: string;
  parceiroId?: string;
  /** Padrão A_PAGAR; 'TODAS' remove o filtro. */
  status?: string;
}

export type RespostaComissoes = RespostaPaginada<ComissaoParceiroLinha> & {
  total: number;
  /** Ausente sem a permissão VER_COMISSOES. */
  totalComissaoAPagar?: number;
};

export const servicoContatos = {
  listar(filtros: FiltrosContato = {}): Promise<RespostaPaginada<Contato>> {
    return http.get<RespostaPaginada<Contato>>('/contatos', { ...filtros });
  },
  listarComissoes(filtros: FiltrosComissoes = {}): Promise<RespostaComissoes> {
    return http.get<RespostaComissoes>('/contatos/comissoes', { ...filtros });
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
