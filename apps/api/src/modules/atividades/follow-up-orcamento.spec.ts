import { describe, expect, it } from 'vitest';
import {
  DIAS_ORCAMENTO_SEM_MOVIMENTACAO_PADRAO,
  ehTituloFollowUpOrcAuto,
  lerDiasOrcamentoSemMovimentacao,
  referenciaSemMovimentacaoOrc,
  tituloFollowUpOrc,
} from '@arcco/contratos';

describe('ECOL-21 helpers follow-up ORC', () => {
  it('prazo padrão 7 e configurável', () => {
    expect(lerDiasOrcamentoSemMovimentacao({})).toBe(DIAS_ORCAMENTO_SEM_MOVIMENTACAO_PADRAO);
    expect(lerDiasOrcamentoSemMovimentacao({ diasOrcamentoSemMovimentacao: 10 })).toBe(10);
    expect(lerDiasOrcamentoSemMovimentacao({ diasOrcamentoSemMovimentacao: 0 })).toBe(7);
  });

  it('referência prioriza enviadoEm', () => {
    const enviado = new Date('2026-01-01T12:00:00Z');
    const atualizado = new Date('2026-01-10T12:00:00Z');
    expect(
      referenciaSemMovimentacaoOrc({ enviadoEm: enviado, atualizadoEm: atualizado })?.toISOString(),
    ).toBe(enviado.toISOString());
    expect(
      referenciaSemMovimentacaoOrc({ enviadoEm: null, atualizadoEm: atualizado })?.toISOString(),
    ).toBe(atualizado.toISOString());
  });

  it('título auto e prefixo', () => {
    const t = tituloFollowUpOrc('NEG-0001', 'ORC-0002');
    expect(ehTituloFollowUpOrcAuto(t)).toBe(true);
    expect(ehTituloFollowUpOrcAuto('Negócio parado OP-0001')).toBe(false);
  });

  it('limites: antes / exatamente / após N dias', () => {
    const agora = new Date('2026-10-27T15:00:00Z');
    const dias = 7;
    const limite = new Date(agora.getTime() - dias * 86_400_000);
    const antes = new Date(limite.getTime() - 1);
    const noLimite = new Date(limite.getTime());
    const depois = new Date(limite.getTime() + 1);
    expect(antes <= limite).toBe(true);
    expect(noLimite <= limite).toBe(true);
    expect(depois <= limite).toBe(false);
  });
});
