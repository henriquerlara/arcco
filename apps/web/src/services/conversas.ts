import { ModoAtendimento } from '@arcco/contratos';
import type {
  ContextoComercial,
  Conversa,
  Mensagem,
  ParametrosPaginacao,
  RespostaPaginada,
} from '@/types';
import { desembrulhar, http } from './http';

export interface FiltrosConversa extends ParametrosPaginacao {
  status?: string;
  modo?: string;
  responsavelId?: string;
}

export const servicoConversas = {
  listar(filtros: FiltrosConversa = {}): Promise<RespostaPaginada<Conversa>> {
    return http.get<RespostaPaginada<Conversa>>('/conversas', { ...filtros });
  },
  async obter(id: string): Promise<Conversa> {
    return desembrulhar<Conversa>(await http.get(`/conversas/${id}`));
  },
  async porOportunidade(oportunidadeId: string): Promise<Conversa> {
    return desembrulhar<Conversa>(
      await http.get(`/conversas/por-oportunidade/${oportunidadeId}`),
    );
  },
  async mensagens(id: string): Promise<Mensagem[]> {
    const resposta = await http.get<Mensagem[] | RespostaPaginada<Mensagem>>(
      `/conversas/${id}/mensagens`,
    );
    if (Array.isArray(resposta)) return resposta;
    if (resposta && typeof resposta === 'object' && Array.isArray(resposta.dados)) {
      return resposta.dados;
    }
    return [];
  },
  /** Não há endpoint dedicado: o contexto é derivado do detalhe da conversa. */
  async contexto(id: string): Promise<ContextoComercial> {
    const conversa = await this.obter(id);
    const coletados = conversa.estadoBot?.dadosColetados ?? {};
    const dadosColetados = Object.fromEntries(
      Object.entries(coletados).filter(([chave]) => !chave.startsWith('_')),
    );
    return {
      contato: conversa.contato ?? null,
      oportunidade: conversa.oportunidade ?? null,
      resumo: conversa.estadoBot?.resumo ?? null,
      dadosColetados,
    };
  },
  /** Envio manual do atendente via WhatsApp. */
  async enviar(id: string, texto: string): Promise<Mensagem> {
    return desembrulhar<Mensagem>(
      await http.post(`/whatsapp/conversas/${id}/enviar`, { texto }),
    );
  },
  /** Envia orçamento e avança a oportunidade para Negociação. */
  async enviarOrcamento(
    oportunidadeId: string,
    dados: { texto: string; valorEstimado: number; arquivoId?: string },
  ): Promise<{ mensagem: Mensagem; oportunidadeId: string; conversaId: string }> {
    return desembrulhar(
      await http.post(`/whatsapp/oportunidades/${oportunidadeId}/enviar-orcamento`, dados),
    );
  },
  async assumir(id: string): Promise<Conversa> {
    return desembrulhar<Conversa>(await http.post(`/conversas/${id}/assumir`));
  },
  async transferir(id: string): Promise<Conversa> {
    return desembrulhar<Conversa>(await http.post(`/conversas/${id}/transferir`));
  },
  async devolverAoBot(id: string): Promise<Conversa> {
    return desembrulhar<Conversa>(
      await http.post(`/conversas/${id}/modo/${ModoAtendimento.BOT}`),
    );
  },
  async finalizar(id: string): Promise<Conversa> {
    return desembrulhar<Conversa>(await http.post(`/conversas/${id}/finalizar`));
  },
  async marcarLida(id: string): Promise<Conversa> {
    return desembrulhar<Conversa>(await http.post(`/conversas/${id}/marcar-lida`));
  },
};
