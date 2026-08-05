import { TipoEtapaFunil } from '@arcco/contratos';

export interface EtapaAlvo {
  id: string;
  tipo: TipoEtapaFunil;
  ativo: boolean;
}

export interface ResultadoTransicao {
  permitido: boolean;
  erro?: string;
  fechadaEm: Date | null;
  motivoPerda: string | null;
}

/**
 * Regras de transicao de etapa de uma oportunidade no funil.
 * - Nao permite mover para etapa inativa.
 * - Etapa PERDIDA exige motivo de perda.
 * - Etapas GANHA/PERDIDA marcam a data de fechamento.
 * - Reabrir (voltar para ABERTA) limpa fechamento e motivo de perda.
 */
export function avaliarTransicaoEtapa(
  destino: EtapaAlvo | null | undefined,
  motivoPerda?: string | null,
  agora: Date = new Date(),
): ResultadoTransicao {
  if (!destino) {
    return {
      permitido: false,
      erro: 'Etapa de destino nao encontrada',
      fechadaEm: null,
      motivoPerda: null,
    };
  }

  if (!destino.ativo) {
    return {
      permitido: false,
      erro: 'Nao e possivel mover para uma etapa inativa',
      fechadaEm: null,
      motivoPerda: null,
    };
  }

  if (destino.tipo === TipoEtapaFunil.PERDIDA) {
    if (!motivoPerda || motivoPerda.trim().length === 0) {
      return {
        permitido: false,
        erro: 'Informe o motivo da perda',
        fechadaEm: null,
        motivoPerda: null,
      };
    }
    return { permitido: true, fechadaEm: agora, motivoPerda: motivoPerda.trim() };
  }

  if (destino.tipo === TipoEtapaFunil.GANHA) {
    return { permitido: true, fechadaEm: agora, motivoPerda: null };
  }

  // Etapa aberta: oportunidade permanece/volta a estar em andamento.
  return { permitido: true, fechadaEm: null, motivoPerda: null };
}
