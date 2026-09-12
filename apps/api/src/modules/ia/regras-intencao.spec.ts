import { describe, expect, it } from 'vitest';
import { IntencaoChatbot } from '@arcco/contratos';
import { classificarIntencaoRegras, intencaoPorOpcaoMenu } from './regras-intencao';

describe('classificarIntencaoRegras', () => {
  it('detecta orcamento', () => {
    expect(classificarIntencaoRegras('quero um orçamento').intencao).toBe(
      IntencaoChatbot.NOVO_ORCAMENTO,
    );
    expect(classificarIntencaoRegras('preciso de uma cotação').intencao).toBe(
      IntencaoChatbot.NOVO_ORCAMENTO,
    );
  });

  it('detecta falar com pessoa', () => {
    expect(classificarIntencaoRegras('quero falar com um atendente').intencao).toBe(
      IntencaoChatbot.FALAR_COM_PESSOA,
    );
  });

  it('detecta negociacao', () => {
    expect(classificarIntencaoRegras('quero negociar o desconto').intencao).toBe(
      IntencaoChatbot.NEGOCIAR_ORCAMENTO,
    );
  });

  it('detecta entrega', () => {
    expect(classificarIntencaoRegras('cadê a entrega').intencao).toBe(IntencaoChatbot.ENTREGA);
  });

  it('detecta financeiro e sac', () => {
    expect(classificarIntencaoRegras('preciso do boleto').intencao).toBe(IntencaoChatbot.FINANCEIRO);
    expect(classificarIntencaoRegras('setor de sac').intencao).toBe(IntencaoChatbot.SAC);
  });

  it('retorna OUTRO para texto desconhecido', () => {
    expect(classificarIntencaoRegras('blablabla xyz').intencao).toBe(IntencaoChatbot.OUTRO);
  });

  it('trata saudacao como OUTRO', () => {
    expect(classificarIntencaoRegras('oi').intencao).toBe(IntencaoChatbot.OUTRO);
    expect(classificarIntencaoRegras('bom dia').intencao).toBe(IntencaoChatbot.OUTRO);
  });
});

describe('intencaoPorOpcaoMenu - Ecolume v8', () => {
  it('mapeia 1-5 para as secoes do PDF', () => {
    expect(intencaoPorOpcaoMenu('1')).toBe(IntencaoChatbot.VENDAS);
    expect(intencaoPorOpcaoMenu('2')).toBe(IntencaoChatbot.FINANCEIRO);
    expect(intencaoPorOpcaoMenu('3')).toBe(IntencaoChatbot.SAC);
    expect(intencaoPorOpcaoMenu('4')).toBe(IntencaoChatbot.ENTREGA);
    expect(intencaoPorOpcaoMenu('5')).toBe(IntencaoChatbot.OUTRO);
  });

  it('retorna null fora do menu', () => {
    expect(intencaoPorOpcaoMenu('9')).toBeNull();
    expect(intencaoPorOpcaoMenu('ola')).toBeNull();
  });
});
