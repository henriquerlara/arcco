import { describe, expect, it } from 'vitest';
import { IntencaoChatbot } from '@arcco/contratos';
import { classificarIntencaoRegras, intencaoPorOpcaoMenu } from './regras-intencao';

describe('classificarIntencaoRegras', () => {
  it('detecta pedido de orcamento', () => {
    expect(classificarIntencaoRegras('quero um orcamento de luminarias').intencao).toBe(
      IntencaoChatbot.NOVO_ORCAMENTO,
    );
    expect(classificarIntencaoRegras('quanto custa o concreto?').intencao).toBe(
      IntencaoChatbot.NOVO_ORCAMENTO,
    );
  });

  it('detecta pedido para falar com humano com prioridade', () => {
    expect(classificarIntencaoRegras('quero falar com um atendente').intencao).toBe(
      IntencaoChatbot.FALAR_COM_PESSOA,
    );
  });

  it('detecta negociacao', () => {
    expect(classificarIntencaoRegras('tem desconto?').intencao).toBe(
      IntencaoChatbot.NEGOCIAR_ORCAMENTO,
    );
  });

  it('detecta entrega', () => {
    expect(classificarIntencaoRegras('qual o prazo de entrega do frete').intencao).toBe(
      IntencaoChatbot.ENTREGA,
    );
  });

  it('retorna OUTRO para texto sem correspondencia', () => {
    expect(classificarIntencaoRegras('blablabla xyz').intencao).toBe(IntencaoChatbot.OUTRO);
  });

  it('retorna confianca 0 para texto vazio', () => {
    expect(classificarIntencaoRegras('   ').confianca).toBe(0);
  });
});

describe('intencaoPorOpcaoMenu', () => {
  it('mapeia opcoes numericas', () => {
    expect(intencaoPorOpcaoMenu('1')).toBe(IntencaoChatbot.NOVO_ORCAMENTO);
    expect(intencaoPorOpcaoMenu('4')).toBe(IntencaoChatbot.FALAR_COM_PESSOA);
    expect(intencaoPorOpcaoMenu('nenhuma')).toBeNull();
  });
});
