import { describe, expect, it } from 'vitest';
import { IntencaoChatbot, type ChatbotConfig, type EstadoBot } from '@arcco/contratos';
import { avancarChatbot, FLUXO, CHAVE_NECESSIDADE } from './maquina-estados';

const config: ChatbotConfig = {
  ativo: true,
  nome: 'Assistente ARCCO',
  mensagemInicial: 'Ola! Sou o assistente.',
  mensagemForaHorario: 'Estamos fora do horario.',
  mensagemTransferencia: 'Transferindo para atendente.',
  mensagemFinal: 'Solicitacao registrada!',
};

const estadoVazio: EstadoBot = { dadosColetados: {}, tentativas: 0 };

const base = {
  intencao: IntencaoChatbot.OUTRO,
  opcaoMenu: null as IntencaoChatbot | null,
  contatoConhecido: true,
  nomeContato: 'Cliente',
  perguntasCampos: [] as { chave: string; texto: string }[],
  config,
  emHorario: true,
};

describe('avancarChatbot - menu inicial', () => {
  it('mostra o menu quando a intencao e desconhecida na primeira interacao', () => {
    const saida = avancarChatbot({ ...base, texto: 'oi', estado: estadoVazio });
    expect(saida.acao).toBe('NENHUMA');
    expect(saida.novoEstado.fluxo).toBe(FLUXO.MENU);
    expect(saida.respostas.join('\n')).toContain('Fazer um orcamento');
  });

  it('inclui mensagem de fora de horario quando aplicavel', () => {
    const saida = avancarChatbot({ ...base, texto: 'oi', estado: estadoVazio, emHorario: false });
    expect(saida.respostas.join('\n')).toContain('fora do horario');
  });
});

describe('avancarChatbot - transferir para humano', () => {
  it('transfere ao escolher a opcao 4', () => {
    const saida = avancarChatbot({
      ...base,
      texto: '4',
      opcaoMenu: IntencaoChatbot.FALAR_COM_PESSOA,
      estado: { fluxo: FLUXO.MENU, dadosColetados: {}, tentativas: 0 },
    });
    expect(saida.acao).toBe('TRANSFERIR');
  });

  it('transfere apos exceder tentativas', () => {
    const saida = avancarChatbot({
      ...base,
      texto: 'nao entendo',
      estado: { fluxo: FLUXO.MENU, dadosColetados: {}, tentativas: 2 },
    });
    expect(saida.acao).toBe('TRANSFERIR');
  });
});

describe('avancarChatbot - fluxo de novo orcamento', () => {
  it('inicia o fluxo e faz a primeira pergunta (necessidade, contato conhecido)', () => {
    const saida = avancarChatbot({
      ...base,
      texto: '1',
      opcaoMenu: IntencaoChatbot.NOVO_ORCAMENTO,
      estado: { fluxo: FLUXO.MENU, dadosColetados: {}, tentativas: 0 },
    });
    expect(saida.novoEstado.fluxo).toBe(FLUXO.NOVO_ORCAMENTO);
    expect(saida.novoEstado.ultimaPergunta).toBe(CHAVE_NECESSIDADE);
  });

  it('coleta respostas e cria a oportunidade ao final', () => {
    // Passo 0: ja perguntou a necessidade (etapa '0').
    const estadoColetando: EstadoBot = {
      fluxo: FLUXO.NOVO_ORCAMENTO,
      etapa: '0',
      dadosColetados: {},
      ultimaPergunta: CHAVE_NECESSIDADE,
      tentativas: 0,
    };

    // Sem campos extras: responder a necessidade encerra o fluxo.
    const saida = avancarChatbot({
      ...base,
      texto: 'Preciso de 50 luminarias de LED',
      estado: estadoColetando,
    });

    expect(saida.acao).toBe('CRIAR_OPORTUNIDADE');
    expect(saida.dadosOportunidade?.necessidade).toBe('Preciso de 50 luminarias de LED');
    expect(saida.novoEstado.fluxo).toBe(FLUXO.FINALIZADO);
    expect(saida.respostas[0]).toContain('registrada');
  });

  it('pergunta campos personalizados do chatbot em sequencia', () => {
    const estadoColetando: EstadoBot = {
      fluxo: FLUXO.NOVO_ORCAMENTO,
      etapa: '0',
      dadosColetados: {},
      ultimaPergunta: CHAVE_NECESSIDADE,
      tentativas: 0,
    };

    const saida = avancarChatbot({
      ...base,
      texto: 'Concreto usinado',
      perguntasCampos: [{ chave: 'volume_m3', texto: 'Qual o volume em m3?' }],
      estado: estadoColetando,
    });

    expect(saida.acao).toBe('NENHUMA');
    expect(saida.respostas[0]).toBe('Qual o volume em m3?');
    expect(saida.novoEstado.ultimaPergunta).toBe('volume_m3');
  });
});
