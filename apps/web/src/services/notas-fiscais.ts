import { desembrulhar, http } from './http';
import type { NotaFiscal } from '@/types';

export interface FocusNfeStatus {
  configurado: boolean;
  ambiente: 'homologacao' | 'producao';
  modo: 'focus' | 'mock';
  mensagem: string;
}

export const servicoNotasFiscais = {
  statusIntegracao(): Promise<FocusNfeStatus> {
    return http.get('/integrations/focus-nfe/status').then(desembrulhar<FocusNfeStatus>);
  },
  listarPorOportunidade(oportunidadeId: string): Promise<NotaFiscal[]> {
    return http
      .get(`/oportunidades/${oportunidadeId}/notas-fiscais`)
      .then(desembrulhar<NotaFiscal[]>);
  },
  listarPorOrcamento(orcamentoId: string): Promise<NotaFiscal[]> {
    return http.get(`/orcamentos/${orcamentoId}/notas-fiscais`).then(desembrulhar<NotaFiscal[]>);
  },
  emitir(orcamentoId: string): Promise<NotaFiscal> {
    return http.post(`/orcamentos/${orcamentoId}/emitir-nf`).then(desembrulhar<NotaFiscal>);
  },
  sincronizar(id: string): Promise<NotaFiscal> {
    return http.post(`/notas-fiscais/${id}/sincronizar`).then(desembrulhar<NotaFiscal>);
  },
};
