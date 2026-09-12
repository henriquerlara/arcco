import { IntencaoChatbot, type ChatbotConfig, type EstadoBot } from '@arcco/contratos';
import * as M from './mensagens-ecolume';

export const FLUXO = {
  MENU: 'MENU',
  VENDAS: 'VENDAS',
  FINANCEIRO: 'FINANCEIRO',
  SAC: 'SAC',
  ENTREGA: 'ENTREGA',
  OUTROS: 'OUTROS',
  FINALIZADO: 'FINALIZADO',
} as const;

export type AcaoChatbot = 'NENHUMA' | 'TRANSFERIR' | 'CRIAR_OPORTUNIDADE';

export interface EntradaMaquina {
  texto: string;
  estado: EstadoBot;
  /** Resultado do lookup de CPF (somente quando etapa = novo_cpf). */
  cadastroEncontrado?: boolean;
  intencao: IntencaoChatbot;
  opcaoMenu: IntencaoChatbot | null;
  config: ChatbotConfig;
  emHorario: boolean;
}

export interface DadosOportunidade {
  titulo?: string;
  nome?: string;
  necessidade?: string;
  descricao?: string;
  codigoOrcamento?: string;
  campos: Record<string, unknown>;
}

export interface SaidaMaquina {
  respostas: string[];
  novoEstado: EstadoBot;
  acao: AcaoChatbot;
  dadosOportunidade?: DadosOportunidade;
}

type Dados = Record<string, unknown>;

function estadoBase(estado: EstadoBot): EstadoBot {
  return {
    fluxo: estado.fluxo,
    etapa: estado.etapa,
    dadosColetados: { ...(estado.dadosColetados ?? {}) },
    ultimaPergunta: estado.ultimaPergunta,
    tentativas: estado.tentativas ?? 0,
    resumo: estado.resumo,
  };
}

function textoProjeto(config: ChatbotConfig): string {
  return config.textoPerguntaProjeto?.trim() || 'a lista de materiais';
}

function saudacao(config: ChatbotConfig): string {
  return config.mensagemInicial?.trim() || M.SAUDACAO_PADRAO;
}

function opcao(texto: string, max: number): number | null {
  const m = texto.trim().match(/^(\d+)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= max ? n : null;
}

function invalida(base: EstadoBot, etapa: string, menu: string): SaidaMaquina {
  return {
    respostas: [M.OPCAO_INVALIDA, menu],
    acao: 'NENHUMA',
    novoEstado: { ...base, etapa, tentativas: (base.tentativas ?? 0) + 1 },
  };
}

function montarResumo(secao: string, dados: Dados): string {
  const linhas = [`Seção: ${secao}`];
  const ignorar = new Set(['_secao', '_resumo']);
  for (const [chave, valor] of Object.entries(dados)) {
    if (ignorar.has(chave) || valor === undefined || valor === null || valor === '') continue;
    linhas.push(`${chave}: ${String(valor)}`);
  }
  return linhas.join('\n');
}

function finalizar(
  base: EstadoBot,
  respostas: string[],
  secao: string,
  dados: Dados,
  acao: AcaoChatbot = 'TRANSFERIR',
  dadosOportunidade?: DadosOportunidade,
): SaidaMaquina {
  const resumo = montarResumo(secao, dados);
  const dadosFinais = { ...dados, _secao: secao, _resumo: resumo };
  return {
    respostas,
    acao,
    dadosOportunidade,
    novoEstado: {
      fluxo: FLUXO.FINALIZADO,
      etapa: 'concluido',
      dadosColetados: dadosFinais,
      tentativas: 0,
      resumo,
    },
  };
}

function menuInicial(config: ChatbotConfig, emHorario: boolean): string[] {
  const respostas = [saudacao(config)];
  if (!emHorario && config.mensagemForaHorario?.trim()) {
    respostas.push(config.mensagemForaHorario);
  }
  respostas.push(M.MENU_PRINCIPAL);
  return respostas;
}

function iniciarSecao(fluxo: string, etapa: string, respostas: string[], dados: Dados = {}): SaidaMaquina {
  return {
    respostas,
    acao: 'NENHUMA',
    novoEstado: {
      fluxo,
      etapa,
      dadosColetados: { ...dados, _secao: fluxo },
      tentativas: 0,
    },
  };
}

function perguntar(
  fluxo: string,
  etapa: string,
  respostas: string[],
  dados: Dados,
): SaidaMaquina {
  return {
    respostas,
    acao: 'NENHUMA',
    novoEstado: { fluxo, etapa, dadosColetados: dados, tentativas: 0 },
  };
}

function oportunidadeDeOrcamento(dados: Dados): DadosOportunidade {
  const comProjeto = dados.temProjeto === 'sim';
  const campos: Record<string, unknown> = {
    tipo_solicitacao: 'Novo orçamento',
    possui_projeto: comProjeto ? 'Sim' : 'Não',
  };
  if (dados.cpf) campos.cpf = String(dados.cpf);
  if (dados.cadastroEncontrado === 'sim') campos.cadastro = 'Localizado';
  if (dados.cadastroEncontrado === 'nao') campos.cadastro = 'Não localizado';
  if (dados.enderecoObra) campos.endereco_obra = String(dados.enderecoObra);
  if (dados.arquivoRecebido) campos.arquivo_lista = String(dados.arquivoRecebido);

  return { campos };
}

function oportunidadeDeAjuste(dados: Dados): DadosOportunidade {
  const codigo = String(dados.codigoOrcamento ?? '').trim();
  const ajuste = String(dados.descricaoAjuste ?? '').trim();
  return {
    titulo: codigo ? `Ajuste de orçamento ${codigo}` : 'Ajuste de orçamento',
    descricao: ajuste || undefined,
    codigoOrcamento: codigo || undefined,
    campos: {
      tipo_solicitacao: 'Ajuste de orçamento',
      ajuste_status: 'pendente',
      ...(codigo ? { codigo_orcamento: codigo } : {}),
    },
  };
}

// --- Vendas -----------------------------------------------------------------

function avancarVendas(entrada: EntradaMaquina, base: EstadoBot): SaidaMaquina {
  const etapa = base.etapa ?? 'tipo';
  const dados = { ...(base.dadosColetados ?? {}) } as Dados;
  const texto = entrada.texto.trim();

  if (etapa === 'tipo') {
    const o = opcao(texto, 4);
    if (o === null) return invalida(base, 'tipo', M.VENDAS.menu);
    if (o === 1) {
      dados.tipoVendas = 'Novo Orçamento';
      return perguntar(FLUXO.VENDAS, 'novo_cpf', [M.VENDAS.pedirCpf], dados);
    }
    if (o === 2) {
      dados.tipoVendas = 'Ajuste de Orçamento';
      return perguntar(FLUXO.VENDAS, 'ajuste_codigo', [M.VENDAS.ajusteCodigo], dados);
    }
    if (o === 3) {
      dados.tipoVendas = 'Negociação';
      dados.motivo = 'Negociação';
      return finalizar(base, [M.VENDAS.negociacao], 'Vendas', dados);
    }
    dados.tipoVendas = 'Dúvidas';
    return perguntar(FLUXO.VENDAS, 'duvida_texto', [M.VENDAS.duvidaPedir], dados);
  }

  if (etapa === 'novo_cpf') {
    dados.cpf = texto;
    dados.cadastroEncontrado = entrada.cadastroEncontrado ? 'sim' : 'nao';
    if (entrada.cadastroEncontrado) {
      return perguntar(
        FLUXO.VENDAS,
        'novo_projeto',
        [
          `${M.VENDAS.cadastroLocalizadoPrefixo}Para elaborarmos seu orçamento com precisão, você já possui ${textoProjeto(entrada.config)}?`,
          '1 Sim — tenho o projeto ou lista de materiais',
          '2 Não',
        ],
        dados,
      );
    }
    return perguntar(FLUXO.VENDAS, 'novo_endereco', [M.VENDAS.pedirEnderecoObra], dados);
  }

  if (etapa === 'novo_endereco') {
    dados.enderecoObra = texto;
    return perguntar(
      FLUXO.VENDAS,
      'novo_projeto',
      [M.VENDAS.perguntaProjetoSimNao(textoProjeto(entrada.config))],
      dados,
    );
  }

  if (etapa === 'novo_projeto') {
    const o = opcao(texto, 2);
    if (o === null) {
      return invalida(base, 'novo_projeto', M.VENDAS.perguntaProjetoSimNao(textoProjeto(entrada.config)));
    }
    if (o === 1) {
      dados.temProjeto = 'sim';
      return perguntar(FLUXO.VENDAS, 'novo_arquivo', [M.VENDAS.pedirArquivo], dados);
    }
    dados.temProjeto = 'nao';
    return finalizar(
      base,
      [M.VENDAS.semProjeto],
      'Vendas',
      dados,
      'CRIAR_OPORTUNIDADE',
      oportunidadeDeOrcamento(dados),
    );
  }

  if (etapa === 'novo_arquivo') {
    dados.arquivoRecebido = texto || '(mídia/arquivo recebido)';
    return finalizar(
      base,
      [], // mensagem de pedir arquivo já foi enviada; após receber, transferimos em silêncio? PDF says after send file the team analyzes — the pedirArquivo message already said that. No extra final message after file. Transfer with summary.
      'Vendas',
      dados,
      'CRIAR_OPORTUNIDADE',
      oportunidadeDeOrcamento(dados),
    );
  }

  if (etapa === 'ajuste_codigo') {
    dados.codigoOrcamento = texto;
    return perguntar(FLUXO.VENDAS, 'ajuste_descricao', [M.VENDAS.ajusteDescricao], dados);
  }

  if (etapa === 'ajuste_descricao') {
    dados.descricaoAjuste = texto;
    return finalizar(
      base,
      [M.VENDAS.ajusteFinal],
      'Vendas',
      dados,
      'CRIAR_OPORTUNIDADE',
      oportunidadeDeAjuste(dados),
    );
  }

  if (etapa === 'duvida_texto') {
    dados.descricaoDuvida = texto;
    return finalizar(base, [M.VENDAS.duvidaFinal], 'Vendas', dados);
  }

  return iniciarSecao(FLUXO.VENDAS, 'tipo', [M.VENDAS.menu], dados);
}

// --- Financeiro -------------------------------------------------------------

function avancarFinanceiro(entrada: EntradaMaquina, base: EstadoBot): SaidaMaquina {
  const etapa = base.etapa ?? 'assunto';
  const dados = { ...(base.dadosColetados ?? {}) } as Dados;
  const texto = entrada.texto.trim();

  if (etapa === 'assunto') {
    const o = opcao(texto, 2);
    if (o === null) return invalida(base, 'assunto', M.FINANCEIRO.menu);
    if (o === 1) {
      dados.assuntoFinanceiro = 'Segunda via de boleto ou nota fiscal';
      return perguntar(FLUXO.FINANCEIRO, 'boleto_pedido', [M.FINANCEIRO.boletoPedirPedido], dados);
    }
    dados.assuntoFinanceiro = 'Contestação de cobrança';
    return perguntar(
      FLUXO.FINANCEIRO,
      'contestacao_pedido',
      [M.FINANCEIRO.contestacaoPedirPedido],
      dados,
    );
  }

  if (etapa === 'boleto_pedido') {
    dados.numeroPedido = texto;
    return finalizar(base, [M.FINANCEIRO.boletoFinal], 'Financeiro', dados);
  }

  if (etapa === 'contestacao_pedido') {
    dados.numeroPedido = texto;
    return perguntar(
      FLUXO.FINANCEIRO,
      'contestacao_descricao',
      [M.FINANCEIRO.contestacaoPedirDescricao],
      dados,
    );
  }

  if (etapa === 'contestacao_descricao') {
    dados.descricaoContestacao = texto;
    return finalizar(base, [M.FINANCEIRO.contestacaoFinal], 'Financeiro', dados);
  }

  return iniciarSecao(FLUXO.FINANCEIRO, 'assunto', [M.FINANCEIRO.menu], dados);
}

// --- S.A.C ------------------------------------------------------------------

function avancarSac(entrada: EntradaMaquina, base: EstadoBot): SaidaMaquina {
  const etapa = base.etapa ?? 'assunto';
  const dados = { ...(base.dadosColetados ?? {}) } as Dados;
  const texto = entrada.texto.trim();

  if (etapa === 'assunto') {
    const o = opcao(texto, 4);
    if (o === null) return invalida(base, 'assunto', M.SAC.menu);
    if (o === 1) {
      dados.assuntoSac = 'Produto com defeito';
      return perguntar(FLUXO.SAC, 'defeito_produto', [M.SAC.defeitoIntro, M.SAC.defeitoProduto], dados);
    }
    if (o === 2) {
      dados.assuntoSac = 'Dúvida técnica';
      return perguntar(FLUXO.SAC, 'tecnica_pedido', [M.SAC.tecnicaIntro, M.SAC.tecnicaPedido], dados);
    }
    if (o === 3) {
      dados.assuntoSac = 'Reclamação';
      return perguntar(
        FLUXO.SAC,
        'reclamacao_pedido',
        [M.SAC.reclamacaoIntro, M.SAC.reclamacaoPedido],
        dados,
      );
    }
    dados.assuntoSac = 'Devolução ou troca de materiais';
    return perguntar(
      FLUXO.SAC,
      'devolucao_pedido',
      [M.SAC.devolucaoIntro, M.SAC.devolucaoPedido],
      dados,
    );
  }

  if (etapa === 'defeito_produto') {
    dados.produto = texto;
    return perguntar(FLUXO.SAC, 'defeito_descricao', [M.SAC.defeitoDescricao], dados);
  }
  if (etapa === 'defeito_descricao') {
    dados.descricaoDefeito = texto;
    return perguntar(FLUXO.SAC, 'defeito_instalacao', [M.SAC.defeitoInstalacao], dados);
  }
  if (etapa === 'defeito_instalacao') {
    dados.statusInstalacao = texto;
    return perguntar(FLUXO.SAC, 'defeito_midia', [M.SAC.defeitoMidia], dados);
  }
  if (etapa === 'defeito_midia') {
    dados.midia = texto || '(mídia recebida)';
    return finalizar(base, [M.SAC.defeitoFinal], 'S.A.C', dados);
  }

  if (etapa === 'tecnica_pedido') {
    dados.numeroPedido = texto;
    return perguntar(FLUXO.SAC, 'tecnica_produto', [M.SAC.tecnicaProduto], dados);
  }
  if (etapa === 'tecnica_produto') {
    dados.produto = texto;
    return perguntar(FLUXO.SAC, 'tecnica_descricao', [M.SAC.tecnicaDescricao], dados);
  }
  if (etapa === 'tecnica_descricao') {
    dados.descricaoDuvida = texto;
    return finalizar(base, [M.SAC.tecnicaFinal], 'S.A.C', dados);
  }

  if (etapa === 'reclamacao_pedido') {
    dados.numeroPedido = texto;
    return perguntar(FLUXO.SAC, 'reclamacao_descricao', [M.SAC.reclamacaoDescricao], dados);
  }
  if (etapa === 'reclamacao_descricao') {
    dados.descricaoReclamacao = texto;
    return finalizar(base, [M.SAC.reclamacaoFinal], 'S.A.C', dados);
  }

  if (etapa === 'devolucao_pedido') {
    dados.numeroPedido = texto;
    return perguntar(FLUXO.SAC, 'devolucao_produto', [M.SAC.devolucaoProduto], dados);
  }
  if (etapa === 'devolucao_produto') {
    dados.produto = texto;
    return perguntar(FLUXO.SAC, 'devolucao_motivo', [M.SAC.devolucaoMotivo], dados);
  }
  if (etapa === 'devolucao_motivo') {
    const o = opcao(texto, 3);
    if (o === null) return invalida(base, 'devolucao_motivo', M.SAC.devolucaoMotivo);
    dados.motivoDevolucao = M.rotuloMotivoDevolucao(o);
    const respostas: string[] = [];
    if (o === 3) respostas.push(M.SAC.devolucaoSobraObra);
    respostas.push(M.SAC.devolucaoNf);
    return perguntar(FLUXO.SAC, 'devolucao_nf', respostas, dados);
  }
  if (etapa === 'devolucao_nf') {
    const o = opcao(texto, 2);
    if (o === null) return invalida(base, 'devolucao_nf', M.SAC.devolucaoNf);
    dados.possuiNotaFiscal = o === 1 ? 'sim' : 'nao';
    return finalizar(base, [M.SAC.devolucaoFinal], 'S.A.C', dados);
  }

  return iniciarSecao(FLUXO.SAC, 'assunto', [M.SAC.menu], dados);
}

// --- Entrega ----------------------------------------------------------------

function avancarEntrega(entrada: EntradaMaquina, base: EstadoBot): SaidaMaquina {
  const etapa = base.etapa ?? 'assunto';
  const dados = { ...(base.dadosColetados ?? {}) } as Dados;
  const texto = entrada.texto.trim();

  if (etapa === 'assunto') {
    const o = opcao(texto, 4);
    if (o === null) return invalida(base, 'assunto', M.ENTREGA.menu);
    if (o === 1) {
      dados.assuntoEntrega = 'Prazo de entrega';
      return perguntar(FLUXO.ENTREGA, 'prazo_pedido', [M.ENTREGA.prazoPedirPedido], dados);
    }
    if (o === 2) {
      dados.assuntoEntrega = 'Rastreamento de pedido';
      return perguntar(FLUXO.ENTREGA, 'rastreio_pedido', [M.ENTREGA.rastreioPedirPedido], dados);
    }
    if (o === 3) {
      dados.assuntoEntrega = 'Reagendamento de entrega';
      return perguntar(FLUXO.ENTREGA, 'reag_pedido', [M.ENTREGA.reagIntro, M.ENTREGA.reagPedido], dados);
    }
    dados.assuntoEntrega = 'Problema na entrega';
    return perguntar(
      FLUXO.ENTREGA,
      'problema_pedido',
      [M.ENTREGA.problemaIntro, M.ENTREGA.problemaPedido],
      dados,
    );
  }

  if (etapa === 'prazo_pedido') {
    dados.numeroPedido = texto;
    return finalizar(base, [M.ENTREGA.prazoFinal], 'Entrega', dados);
  }
  if (etapa === 'rastreio_pedido') {
    dados.numeroPedido = texto;
    return finalizar(base, [M.ENTREGA.rastreioFinal], 'Entrega', dados);
  }

  if (etapa === 'reag_pedido') {
    dados.numeroPedido = texto;
    return perguntar(FLUXO.ENTREGA, 'reag_data_atual', [M.ENTREGA.reagDataAtual], dados);
  }
  if (etapa === 'reag_data_atual') {
    dados.dataEntregaAtual = texto;
    return perguntar(FLUXO.ENTREGA, 'reag_nova_data', [M.ENTREGA.reagNovaData], dados);
  }
  if (etapa === 'reag_nova_data') {
    dados.novaDataEntrega = texto;
    return finalizar(base, [M.ENTREGA.reagFinal], 'Entrega', dados);
  }

  if (etapa === 'problema_pedido') {
    dados.numeroPedido = texto;
    return perguntar(FLUXO.ENTREGA, 'problema_tipo', [M.ENTREGA.problemaTipo], dados);
  }
  if (etapa === 'problema_tipo') {
    const o = opcao(texto, 3);
    if (o === null) return invalida(base, 'problema_tipo', M.ENTREGA.problemaTipo);
    dados.tipoProblema = M.rotuloProblemaEntrega(o);
    return perguntar(FLUXO.ENTREGA, 'problema_midia', [M.ENTREGA.problemaMidia], dados);
  }
  if (etapa === 'problema_midia') {
    dados.midia = texto || '(mídia recebida)';
    return finalizar(base, [M.ENTREGA.problemaFinal], 'Entrega', dados);
  }

  return iniciarSecao(FLUXO.ENTREGA, 'assunto', [M.ENTREGA.menu], dados);
}

// --- Outros -----------------------------------------------------------------

function avancarOutros(entrada: EntradaMaquina, base: EstadoBot): SaidaMaquina {
  const etapa = base.etapa ?? 'descricao';
  const dados = { ...(base.dadosColetados ?? {}) } as Dados;
  const texto = entrada.texto.trim();

  if (etapa === 'descricao') {
    dados.descricaoSolicitacao = texto;
    return finalizar(base, [M.OUTROS.final], 'Outros', dados);
  }

  return iniciarSecao(FLUXO.OUTROS, 'descricao', [M.OUTROS.pedirDescricao], dados);
}

// --- Menu / roteamento ------------------------------------------------------

function entrarPorIntencao(intencao: IntencaoChatbot): SaidaMaquina | null {
  switch (intencao) {
    case IntencaoChatbot.VENDAS:
    case IntencaoChatbot.NOVO_ORCAMENTO:
    case IntencaoChatbot.NEGOCIAR_ORCAMENTO:
    case IntencaoChatbot.AJUSTAR_ORCAMENTO:
      return iniciarSecao(FLUXO.VENDAS, 'tipo', [M.VENDAS.menu]);
    case IntencaoChatbot.FINANCEIRO:
      return iniciarSecao(FLUXO.FINANCEIRO, 'assunto', [M.FINANCEIRO.menu]);
    case IntencaoChatbot.SAC:
    case IntencaoChatbot.POS_VENDA:
      return iniciarSecao(FLUXO.SAC, 'assunto', [M.SAC.menu]);
    case IntencaoChatbot.ENTREGA:
    case IntencaoChatbot.ACOMPANHAR_SOLICITACAO:
      return iniciarSecao(FLUXO.ENTREGA, 'assunto', [M.ENTREGA.menu]);
    case IntencaoChatbot.OUTRO:
    case IntencaoChatbot.DUVIDA:
    case IntencaoChatbot.FALAR_COM_PESSOA:
      return iniciarSecao(FLUXO.OUTROS, 'descricao', [M.OUTROS.pedirDescricao]);
    default:
      return null;
  }
}

function avancarMenu(entrada: EntradaMaquina, base: EstadoBot): SaidaMaquina {
  const primeiraInteracao = !base.fluxo;
  const etapa = base.etapa ?? 'direcionamento';

  if (primeiraInteracao || etapa === 'saudacao') {
    // Primeira mensagem: mostra saudação + menu. Se já veio opção 1–5, encaminha em seguida.
    const o = opcao(entrada.texto, 5);
    const intencao = entrada.opcaoMenu ?? entrada.intencao;
    const respostasBase = menuInicial(entrada.config, entrada.emHorario);

    if (o !== null || (intencao && intencao !== IntencaoChatbot.OUTRO)) {
      // Mostra menu só se for saudação pura; se já escolheu, entra na seção
      if (o === null && intencao !== IntencaoChatbot.OUTRO) {
        const entradaSecao = entrarPorIntencao(intencao);
        if (entradaSecao) {
          return {
            ...entradaSecao,
            respostas: [...respostasBase, ...entradaSecao.respostas],
          };
        }
      }
      if (o !== null) {
        const mapa: Record<number, () => SaidaMaquina> = {
          1: () => iniciarSecao(FLUXO.VENDAS, 'tipo', [M.VENDAS.menu]),
          2: () => iniciarSecao(FLUXO.FINANCEIRO, 'assunto', [M.FINANCEIRO.menu]),
          3: () => iniciarSecao(FLUXO.SAC, 'assunto', [M.SAC.menu]),
          4: () => iniciarSecao(FLUXO.ENTREGA, 'assunto', [M.ENTREGA.menu]),
          5: () => iniciarSecao(FLUXO.OUTROS, 'descricao', [M.OUTROS.pedirDescricao]),
        };
        const proxima = mapa[o]!();
        // Na primeira interação com número, ainda enviamos saudação + menu + submenu
        return {
          ...proxima,
          respostas: [...respostasBase, ...proxima.respostas],
        };
      }
    }

    return {
      respostas: respostasBase,
      acao: 'NENHUMA',
      novoEstado: {
        fluxo: FLUXO.MENU,
        etapa: 'direcionamento',
        dadosColetados: {},
        tentativas: 0,
      },
    };
  }

  // Já no direcionamento: espera 1–5 ou intenção NLP
  const o = opcao(entrada.texto, 5);
  if (o === 1) return iniciarSecao(FLUXO.VENDAS, 'tipo', [M.VENDAS.menu]);
  if (o === 2) return iniciarSecao(FLUXO.FINANCEIRO, 'assunto', [M.FINANCEIRO.menu]);
  if (o === 3) return iniciarSecao(FLUXO.SAC, 'assunto', [M.SAC.menu]);
  if (o === 4) return iniciarSecao(FLUXO.ENTREGA, 'assunto', [M.ENTREGA.menu]);
  if (o === 5) return iniciarSecao(FLUXO.OUTROS, 'descricao', [M.OUTROS.pedirDescricao]);

  const intencao = entrada.opcaoMenu ?? entrada.intencao;
  if (intencao && intencao !== IntencaoChatbot.OUTRO) {
    const entradaSecao = entrarPorIntencao(intencao);
    if (entradaSecao) return entradaSecao;
  }

  return {
    respostas: [M.OPCAO_INVALIDA, M.MENU_PRINCIPAL],
    acao: 'NENHUMA',
    novoEstado: {
      fluxo: FLUXO.MENU,
      etapa: 'direcionamento',
      dadosColetados: base.dadosColetados ?? {},
      tentativas: (base.tentativas ?? 0) + 1,
    },
  };
}

/**
 * Máquina de estados do chatbot Ecolume v8. Pura e determinística (sem I/O).
 */
export function avancarChatbot(entrada: EntradaMaquina): SaidaMaquina {
  const base = estadoBase(entrada.estado);
  const fluxoAtual = base.fluxo ?? FLUXO.MENU;

  if (fluxoAtual === FLUXO.FINALIZADO) {
    return {
      respostas: [],
      acao: 'NENHUMA',
      novoEstado: base,
    };
  }

  if (fluxoAtual === FLUXO.VENDAS) return avancarVendas(entrada, base);
  if (fluxoAtual === FLUXO.FINANCEIRO) return avancarFinanceiro(entrada, base);
  if (fluxoAtual === FLUXO.SAC) return avancarSac(entrada, base);
  if (fluxoAtual === FLUXO.ENTREGA) return avancarEntrega(entrada, base);
  if (fluxoAtual === FLUXO.OUTROS) return avancarOutros(entrada, base);

  return avancarMenu(entrada, base);
}
