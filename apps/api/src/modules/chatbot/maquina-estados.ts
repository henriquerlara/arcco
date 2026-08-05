import { IntencaoChatbot, type ChatbotConfig, type EstadoBot } from '@arcco/contratos';

export const FLUXO = {
  MENU: 'MENU',
  NOVO_ORCAMENTO: 'NOVO_ORCAMENTO',
  FINALIZADO: 'FINALIZADO',
} as const;

export const CHAVE_NOME = '_nome';
export const CHAVE_NECESSIDADE = '_necessidade';

const MAX_TENTATIVAS = 3;

export type AcaoChatbot = 'NENHUMA' | 'TRANSFERIR' | 'CRIAR_OPORTUNIDADE';

export interface PerguntaCampo {
  chave: string;
  texto: string;
}

export interface EntradaMaquina {
  texto: string;
  estado: EstadoBot;
  intencao: IntencaoChatbot;
  opcaoMenu: IntencaoChatbot | null;
  contatoConhecido: boolean;
  nomeContato?: string | null;
  perguntasCampos: PerguntaCampo[];
  config: ChatbotConfig;
  emHorario: boolean;
}

export interface DadosOportunidade {
  nome?: string;
  necessidade?: string;
  campos: Record<string, unknown>;
}

export interface SaidaMaquina {
  respostas: string[];
  novoEstado: EstadoBot;
  acao: AcaoChatbot;
  dadosOportunidade?: DadosOportunidade;
}

function menuInicial(config: ChatbotConfig, emHorario: boolean): string[] {
  const respostas: string[] = [];
  const saudacao =
    config.mensagemInicial?.trim() ||
    `Ola! Sou o ${config.nome || 'assistente'}. Como posso ajudar?`;
  respostas.push(saudacao);
  if (!emHorario && config.mensagemForaHorario?.trim()) {
    respostas.push(config.mensagemForaHorario);
  }
  respostas.push(
    [
      'Escolha uma opcao:',
      '1) Fazer um orcamento',
      '2) Acompanhar uma solicitacao',
      '3) Tirar uma duvida',
      '4) Falar com um atendente',
    ].join('\n'),
  );
  return respostas;
}

function estadoBase(estado: EstadoBot): EstadoBot {
  return {
    fluxo: estado.fluxo,
    etapa: estado.etapa,
    dadosColetados: estado.dadosColetados ?? {},
    ultimaPergunta: estado.ultimaPergunta,
    tentativas: estado.tentativas ?? 0,
  };
}

/** Monta a sequencia de perguntas do fluxo de novo orcamento. */
function montarPerguntas(entrada: EntradaMaquina): PerguntaCampo[] {
  const perguntas: PerguntaCampo[] = [];
  if (!entrada.contatoConhecido && !entrada.nomeContato) {
    perguntas.push({ chave: CHAVE_NOME, texto: 'Para comecar, qual o seu nome?' });
  }
  perguntas.push({
    chave: CHAVE_NECESSIDADE,
    texto: 'Certo! Me conte o que voce precisa orcar (produto, servico ou material).',
  });
  perguntas.push(...entrada.perguntasCampos);
  return perguntas;
}

function iniciarOrcamento(entrada: EntradaMaquina): SaidaMaquina {
  const perguntas = montarPerguntas(entrada);
  const primeira = perguntas[0]!;
  return {
    respostas: ['Perfeito! Vamos iniciar seu orcamento.', primeira.texto],
    acao: 'NENHUMA',
    novoEstado: {
      fluxo: FLUXO.NOVO_ORCAMENTO,
      etapa: '0',
      dadosColetados: {},
      ultimaPergunta: primeira.chave,
      tentativas: 0,
    },
  };
}

function transferir(entrada: EntradaMaquina, base: EstadoBot): SaidaMaquina {
  const msg =
    entrada.config.mensagemTransferencia?.trim() ||
    'Vou transferir voce para um atendente. Em instantes alguem continua por aqui.';
  return {
    respostas: [msg],
    acao: 'TRANSFERIR',
    novoEstado: { ...base, fluxo: FLUXO.FINALIZADO },
  };
}

/**
 * Maquina de estados do chatbot. Pura e deterministica (sem I/O), o que facilita testes.
 * O chamador (ChatbotService) executa os efeitos colaterais das acoes retornadas.
 */
export function avancarChatbot(entrada: EntradaMaquina): SaidaMaquina {
  const base = estadoBase(entrada.estado);
  const fluxoAtual = base.fluxo ?? FLUXO.MENU;

  // --- Fluxo de coleta de orcamento em andamento ---
  if (fluxoAtual === FLUXO.NOVO_ORCAMENTO) {
    const perguntas = montarPerguntas(entrada);
    const indiceAtual = Number.parseInt(base.etapa ?? '0', 10);
    const perguntaRespondida = perguntas[indiceAtual];
    const dados = { ...(base.dadosColetados ?? {}) };

    if (perguntaRespondida) {
      dados[perguntaRespondida.chave] = entrada.texto.trim();
    }

    const proximoIndice = indiceAtual + 1;
    const proxima = perguntas[proximoIndice];

    if (proxima) {
      return {
        respostas: [proxima.texto],
        acao: 'NENHUMA',
        novoEstado: {
          fluxo: FLUXO.NOVO_ORCAMENTO,
          etapa: String(proximoIndice),
          dadosColetados: dados,
          ultimaPergunta: proxima.chave,
          tentativas: 0,
        },
      };
    }

    // Todas as perguntas respondidas -> cria oportunidade.
    const campos: Record<string, unknown> = {};
    for (const [chave, valor] of Object.entries(dados)) {
      if (chave !== CHAVE_NOME && chave !== CHAVE_NECESSIDADE) campos[chave] = valor;
    }

    const final =
      entrada.config.mensagemFinal?.trim() ||
      'Obrigado! Sua solicitacao foi registrada e nossa equipe dara sequencia por aqui.';

    return {
      respostas: [final],
      acao: 'CRIAR_OPORTUNIDADE',
      dadosOportunidade: {
        nome: dados[CHAVE_NOME] as string | undefined,
        necessidade: dados[CHAVE_NECESSIDADE] as string | undefined,
        campos,
      },
      novoEstado: {
        fluxo: FLUXO.FINALIZADO,
        etapa: 'concluido',
        dadosColetados: dados,
        tentativas: 0,
      },
    };
  }

  // --- Menu / roteamento por intencao ---
  const intencao = entrada.opcaoMenu ?? entrada.intencao;

  // Primeira interacao (sem fluxo definido) e mensagem generica -> mostra menu.
  const primeiraInteracao = !base.fluxo;

  switch (intencao) {
    case IntencaoChatbot.NOVO_ORCAMENTO:
      return iniciarOrcamento(entrada);

    case IntencaoChatbot.FALAR_COM_PESSOA:
      return transferir(entrada, base);

    case IntencaoChatbot.ACOMPANHAR_SOLICITACAO:
    case IntencaoChatbot.FINANCEIRO:
    case IntencaoChatbot.ENTREGA:
    case IntencaoChatbot.POS_VENDA:
    case IntencaoChatbot.NEGOCIAR_ORCAMENTO:
    case IntencaoChatbot.AJUSTAR_ORCAMENTO:
      return transferir(entrada, base);

    case IntencaoChatbot.DUVIDA:
      // No menu, pede para escolher opção em vez de transferir logo
      return {
        respostas: [
          'Claro! Me diga em uma frase o que voce precisa, ou escolha uma opcao do menu:',
          [
            '1) Fazer um orcamento',
            '2) Acompanhar uma solicitacao',
            '3) Tirar uma duvida',
            '4) Falar com um atendente',
          ].join('\n'),
        ],
        acao: 'NENHUMA',
        novoEstado: {
          fluxo: FLUXO.MENU,
          dadosColetados: base.dadosColetados ?? {},
          tentativas: base.tentativas ?? 0,
        },
      };

    default: {
      // Intencao desconhecida: reapresenta o menu ate o limite de tentativas.
      const tentativas = (base.tentativas ?? 0) + 1;
      if (!primeiraInteracao && tentativas >= MAX_TENTATIVAS) {
        return transferir(entrada, { ...base, tentativas });
      }
      return {
        respostas: menuInicial(entrada.config, entrada.emHorario),
        acao: 'NENHUMA',
        novoEstado: {
          fluxo: FLUXO.MENU,
          dadosColetados: base.dadosColetados ?? {},
          tentativas: primeiraInteracao ? 0 : tentativas,
        },
      };
    }
  }
}
