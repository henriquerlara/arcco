/**
 * Textos oficiais do Chatbot Ecolume — Fluxo WhatsApp v8 (ARCCO).
 * A única personalização por empresa é o trecho da pergunta de projeto/materiais.
 *
 * Menus têm forma estruturada para a Cloud API (botões/lista);
 * o texto numerado continua idêntico para o simulador e para a máquina de estados.
 */

export interface OpcaoMenuInterativo {
  /** Id enviado no clique (ex.: "1") — a máquina já entende via opcao(). */
  id: string;
  titulo: string;
  descricao?: string;
}

export interface MenuInterativo {
  body: string;
  opcoes: OpcaoMenuInterativo[];
  /** Rótulo do botão da lista (Meta list message, máx. 20). */
  botaoLista?: string;
}

export function textoDoMenu(menu: MenuInterativo): string {
  return [
    menu.body,
    ...menu.opcoes.map((o) => {
      const extra = o.descricao ? ` — ${o.descricao}` : '';
      return `${o.id} ${o.titulo}${extra}`;
    }),
  ].join('\n');
}

export const SAUDACAO_PADRAO =
  'Olá! Seja muito bem-vindo à Ecolume. Sou o assistente virtual da equipe e estou aqui para tornar o seu atendimento mais ágil e preciso. Em breve, um dos nossos especialistas estará com você. Como posso direcioná-lo hoje?';

export const MENU_PRINCIPAL_DEF: MenuInterativo = {
  body: 'Selecione uma das opções a seguir:',
  botaoLista: 'Ver opções',
  opcoes: [
    {
      id: '1',
      titulo: 'Vendas',
      descricao: 'Negociação, orçamento novo, ajuste de orçamento',
    },
    {
      id: '2',
      titulo: 'Financeiro',
      descricao: 'Segunda via de boleto e NF, contestação de cobrança',
    },
    {
      id: '3',
      titulo: 'S.A.C',
      descricao: 'Serviço de pós-venda',
    },
    {
      id: '4',
      titulo: 'Entrega',
      descricao: 'Informações sobre a entrega do seu pedido',
    },
    { id: '5', titulo: 'Outros' },
  ],
};

export const MENU_PRINCIPAL = textoDoMenu(MENU_PRINCIPAL_DEF);

export const OPCAO_INVALIDA =
  'Não consegui identificar sua seleção. Por favor, escolha uma das opções disponíveis.';

const VENDAS_MENU_DEF: MenuInterativo = {
  body: 'Ótimo. Para que possamos atendê-lo com mais precisão, selecione o tipo de solicitação:',
  botaoLista: 'Ver opções',
  opcoes: [
    { id: '1', titulo: 'Novo Orçamento' },
    { id: '2', titulo: 'Ajuste de Orçamento' },
    { id: '3', titulo: 'Negociação' },
    { id: '4', titulo: 'Dúvidas' },
  ],
};

const FINANCEIRO_MENU_DEF: MenuInterativo = {
  body: 'Para melhor direcioná-lo, selecione o assunto do seu contato financeiro:',
  opcoes: [
    { id: '1', titulo: '2ª via boleto/NF', descricao: 'Segunda via de boleto ou nota fiscal' },
    { id: '2', titulo: 'Contestação', descricao: 'Contestação de cobrança' },
  ],
};

const SAC_MENU_DEF: MenuInterativo = {
  body: 'Para direcionarmos seu atendimento ao setor responsável, selecione o assunto da sua solicitação:',
  botaoLista: 'Ver opções',
  opcoes: [
    { id: '1', titulo: 'Produto com defeito' },
    { id: '2', titulo: 'Dúvida técnica' },
    { id: '3', titulo: 'Reclamação' },
    { id: '4', titulo: 'Devolução/troca', descricao: 'Devolução ou troca de materiais' },
  ],
};

const ENTREGA_MENU_DEF: MenuInterativo = {
  body: 'Para que possamos ajudá-lo com mais agilidade, selecione o assunto relacionado à sua entrega:',
  botaoLista: 'Ver opções',
  opcoes: [
    { id: '1', titulo: 'Prazo de entrega' },
    { id: '2', titulo: 'Rastreamento' },
    { id: '3', titulo: 'Reagendamento' },
    { id: '4', titulo: 'Problema na entrega' },
  ],
};

const DEVOLUCAO_MOTIVO_DEF: MenuInterativo = {
  body: 'Qual é o motivo da devolução ou troca?',
  opcoes: [
    { id: '1', titulo: 'Produto diferente', descricao: 'Produto diferente do solicitado' },
    { id: '2', titulo: 'Desistência', descricao: 'Desistência da compra' },
    { id: '3', titulo: 'Sobra de obra' },
  ],
};

const DEVOLUCAO_NF_DEF: MenuInterativo = {
  body: 'Você possui a nota fiscal da compra?',
  opcoes: [
    { id: '1', titulo: 'Sim' },
    { id: '2', titulo: 'Não' },
  ],
};

const PROBLEMA_TIPO_DEF: MenuInterativo = {
  body: 'Qual é o problema ocorrido com a entrega?',
  opcoes: [
    { id: '1', titulo: 'Não chegou', descricao: 'Pedido não chegou na data prevista' },
    { id: '2', titulo: 'Avariado', descricao: 'Produto chegou avariado' },
    { id: '3', titulo: 'Produto diferente', descricao: 'Produto recebido diferente do pedido' },
  ],
};

/** Textos de menu idênticos ao v8 (numerados) — usados pela máquina de estados e pelo simulador. */
function textoMenuCompat(def: MenuInterativo, linhasLegacy: string[]): string {
  // Garante o mesmo texto histórico dos testes (títulos longos nas linhas).
  return [def.body, ...linhasLegacy].join('\n');
}

export const VENDAS = {
  menu: textoMenuCompat(VENDAS_MENU_DEF, [
    '1 Novo Orçamento',
    '2 Ajuste de Orçamento',
    '3 Negociação',
    '4 Dúvidas',
  ]),
  menuDef: VENDAS_MENU_DEF,
  pedirCpf: 'Perfeito! Favor informar o seu CPF.',
  cadastroLocalizadoPrefixo: 'Cadastro localizado. ',
  pedirEnderecoObra: 'Verificamos que você ainda não possui cadastro. Favor informar o endereço da obra.',
  perguntaProjetoSimNao: (textoProjeto: string) =>
    [
      `Para elaborarmos seu orçamento com precisão, você já possui ${textoProjeto}?`,
      '1 Sim — tenho o projeto ou lista de materiais',
      '2 Não',
    ].join('\n'),
  menuProjeto: (textoProjeto: string): MenuInterativo => ({
    body: `Para elaborarmos seu orçamento com precisão, você já possui ${textoProjeto}?`,
    opcoes: [
      { id: '1', titulo: 'Sim', descricao: 'Tenho o projeto ou lista de materiais' },
      { id: '2', titulo: 'Não' },
    ],
  }),
  pedirArquivo:
    'Por favor, envie o arquivo ou a lista aqui mesmo no chat. Assim que recebermos, nosso time analisará e retornará com o orçamento.',
  semProjeto:
    'Sem problema. Vou conectá-lo com um dos nossos especialistas, que poderá orientá-lo sobre os próximos passos.',
  ajusteCodigo:
    'Para localizar seu orçamento rapidamente, poderia nos informar o número ou código do orçamento?',
  ajusteDescricao: 'Obrigado. Agora descreva, por favor, qual ajuste deseja realizar.',
  ajusteFinal:
    'Perfeito. Suas informações foram registradas e encaminhadas ao nosso time comercial. Em breve retornaremos com as atualizações.',
  negociacao:
    'Entendido. Vou direcioná-lo agora ao nosso especialista comercial. Em instantes ele estará com você.',
  duvidaPedir:
    'Ficamos à disposição. Por favor, descreva sua dúvida com o máximo de detalhes para que possamos ajudá-lo da melhor forma.',
  duvidaFinal:
    'Recebemos sua mensagem. Vou encaminhá-la ao nosso time, que retornará em breve com as informações necessárias.',
} as const;

export const FINANCEIRO = {
  menu: textoMenuCompat(FINANCEIRO_MENU_DEF, [
    '1 Segunda via de boleto ou nota fiscal',
    '2 Contestação de cobrança',
  ]),
  menuDef: FINANCEIRO_MENU_DEF,
  boletoPedirPedido:
    'Certo. Para que possamos localizar seu documento com agilidade, por favor informe o número do seu pedido.',
  boletoFinal:
    'Obrigado. Sua solicitação foi registrada e será encaminhada ao setor financeiro. Em breve você receberá o documento pelo WhatsApp ou por e-mail, conforme sua preferência.',
  contestacaoPedirPedido:
    'Entendido. Para registrarmos sua solicitação, por favor informe o número do pedido.',
  contestacaoPedirDescricao:
    'Obrigado. Agora descreva sua contestação com o máximo de detalhes possível para que possamos analisá-la com atenção.',
  contestacaoFinal:
    'Sua contestação foi registrada e será encaminhada ao setor financeiro com prioridade. Em breve entraremos em contato.',
} as const;

export const SAC = {
  menu: textoMenuCompat(SAC_MENU_DEF, [
    '1 Produto com defeito',
    '2 Dúvida técnica',
    '3 Reclamação',
    '4 Devolução ou troca de materiais',
  ]),
  menuDef: SAC_MENU_DEF,
  defeitoIntro:
    'Lamentamos pelo ocorrido e faremos o possível para resolver com agilidade. Para registrarmos sua solicitação, precisamos de algumas informações:',
  defeitoProduto: 'Qual é o nome ou código do produto com defeito?',
  defeitoDescricao: 'Poderia descrever o defeito apresentado?',
  defeitoInstalacao: 'O produto já foi instalado ou o defeito foi identificado antes da instalação?',
  defeitoMidia: 'Seria possível enviar uma foto ou vídeo do problema aqui mesmo no chat?',
  defeitoFinal:
    'Obrigado pelas informações. Sua solicitação foi registrada e encaminhada ao nosso time de S.A.C com prioridade. Em breve entraremos em contato para apresentar a melhor solução.',
  tecnicaIntro:
    'Estamos à disposição para ajudá-lo. Para que nosso time possa orientá-lo com precisão, precisamos entender melhor sua necessidade:',
  tecnicaPedido: 'Qual é o número do pedido?',
  tecnicaProduto: 'Qual é o produto ou sistema sobre o qual você tem dúvidas?',
  tecnicaDescricao: 'Por favor, descreva sua dúvida com o máximo de detalhes possível.',
  tecnicaFinal:
    'Perfeito. Sua dúvida foi registrada e encaminhada ao nosso time técnico. Em breve um especialista retornará com as orientações necessárias.',
  reclamacaoIntro:
    'Pedimos desculpas pela experiência e agradecemos por nos comunicar. Seu retorno é fundamental para que possamos melhorar continuamente. Para registrarmos sua reclamação:',
  reclamacaoPedido: 'Qual é o número do pedido?',
  reclamacaoDescricao: 'Por favor, descreva o ocorrido com o máximo de detalhes.',
  reclamacaoFinal:
    'Sua reclamação foi registrada e encaminhada com prioridade à nossa equipe. Tomaremos as medidas necessárias e retornaremos em breve.',
  devolucaoIntro:
    'Entendido. Para que possamos analisar sua solicitação com atenção, precisamos de algumas informações:',
  devolucaoPedido: 'Qual é o número do pedido?',
  devolucaoProduto: 'Qual é o produto que deseja devolver ou trocar?',
  devolucaoMotivo: textoMenuCompat(DEVOLUCAO_MOTIVO_DEF, [
    '1 Produto diferente do solicitado',
    '2 Desistência da compra',
    '3 Sobra de obra',
  ]),
  devolucaoMotivoDef: DEVOLUCAO_MOTIVO_DEF,
  devolucaoSobraObra:
    'Para solicitações de troca por sobra de obra, o produto deve estar devidamente embalado e sem sinais de uso. Vou encaminhar sua solicitação ao nosso time, que orientará sobre os próximos passos.',
  devolucaoNf: textoMenuCompat(DEVOLUCAO_NF_DEF, ['1 Sim', '2 Não']),
  devolucaoNfDef: DEVOLUCAO_NF_DEF,
  devolucaoFinal:
    'Obrigado. Sua solicitação de devolução ou troca foi registrada e encaminhada ao nosso time responsável. Em breve entraremos em contato para orientá-lo sobre os próximos passos.',
} as const;

export const ENTREGA = {
  menu: textoMenuCompat(ENTREGA_MENU_DEF, [
    '1 Prazo de entrega',
    '2 Rastreamento de pedido',
    '3 Reagendamento de entrega',
    '4 Problema na entrega',
  ]),
  menuDef: ENTREGA_MENU_DEF,
  prazoPedirPedido: 'Para consultarmos o prazo da sua entrega, poderia nos informar o número do pedido?',
  prazoFinal:
    'Obrigado. Sua solicitação foi encaminhada ao responsável de entregas, que retornará em breve com as informações sobre o prazo.',
  rastreioPedirPedido:
    'Para verificarmos o status da sua entrega, poderia nos informar o número do pedido?',
  rastreioFinal:
    'Perfeito. Encaminhei sua solicitação ao responsável de entregas, que retornará em breve com a atualização do seu pedido.',
  reagIntro: 'Sem problema. Para realizarmos o reagendamento, precisamos de algumas informações:',
  reagPedido: 'Qual é o número do pedido?',
  reagDataAtual: 'Qual é a data de entrega atualmente prevista?',
  reagNovaData: 'Qual seria a nova data de sua preferência?',
  reagFinal:
    'Obrigado. Sua solicitação de reagendamento foi registrada e encaminhada ao responsável de entregas. Em breve entraremos em contato para confirmar a nova data.',
  problemaIntro:
    'Lamentamos pelo ocorrido. Para que possamos resolver com agilidade, precisamos registrar alguns detalhes:',
  problemaPedido: 'Qual é o número do pedido?',
  problemaTipo: textoMenuCompat(PROBLEMA_TIPO_DEF, [
    '1 Pedido não chegou na data prevista',
    '2 Produto chegou avariado',
    '3 Produto recebido diferente do pedido',
  ]),
  problemaTipoDef: PROBLEMA_TIPO_DEF,
  problemaMidia: 'Seria possível enviar uma foto aqui no chat para que possamos registrar a ocorrência?',
  problemaFinal:
    'Obrigado pelas informações. Sua ocorrência foi registrada com prioridade e encaminhada ao responsável de entregas. Em breve entraremos em contato para apresentar a solução.',
} as const;

export const OUTROS = {
  pedirDescricao:
    'Por favor, descreva sua solicitação com o máximo de detalhes para que possamos direcioná-la corretamente.',
  final:
    'Obrigado. Sua mensagem foi registrada e encaminhada ao nosso time de atendimento. Em breve um de nossos especialistas estará com você.',
} as const;

const ROTULOS_MOTIVO_DEVOLUCAO: Record<number, string> = {
  1: 'Produto diferente do solicitado',
  2: 'Desistência da compra',
  3: 'Sobra de obra',
};

const ROTULOS_PROBLEMA_ENTREGA: Record<number, string> = {
  1: 'Pedido não chegou na data prevista',
  2: 'Produto chegou avariado',
  3: 'Produto recebido diferente do pedido',
};

export function rotuloMotivoDevolucao(opcao: number): string {
  return ROTULOS_MOTIVO_DEVOLUCAO[opcao] ?? String(opcao);
}

export function rotuloProblemaEntrega(opcao: number): string {
  return ROTULOS_PROBLEMA_ENTREGA[opcao] ?? String(opcao);
}

const MENUS_POR_TEXTO = new Map<string, MenuInterativo>([
  [MENU_PRINCIPAL, MENU_PRINCIPAL_DEF],
  [VENDAS.menu, VENDAS_MENU_DEF],
  [FINANCEIRO.menu, FINANCEIRO_MENU_DEF],
  [SAC.menu, SAC_MENU_DEF],
  [ENTREGA.menu, ENTREGA_MENU_DEF],
  [SAC.devolucaoMotivo, DEVOLUCAO_MOTIVO_DEF],
  [SAC.devolucaoNf, DEVOLUCAO_NF_DEF],
  [ENTREGA.problemaTipo, PROBLEMA_TIPO_DEF],
]);

/**
 * Resolve um texto de resposta do bot para um menu interativo Meta.
 * Cobre menus estáticos e a pergunta dinâmica Sim/Não de projeto.
 */
export function resolverMenuInterativo(texto: string): MenuInterativo | null {
  const direto = MENUS_POR_TEXTO.get(texto);
  if (direto) return direto;

  const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  if (linhas.length < 3) return null;

  const opcaoRe = /^(\d+)\s+(.+)$/;
  const ultima = linhas[linhas.length - 1] ?? '';
  const penultima = linhas[linhas.length - 2] ?? '';
  if (!opcaoRe.test(penultima) || !opcaoRe.test(ultima)) return null;

  // Quantas linhas finais são opções numeradas consecutivas a partir de 1?
  let inicioOpcoes = linhas.length;
  for (let i = linhas.length - 1; i >= 0; i -= 1) {
    if (!opcaoRe.test(linhas[i]!)) break;
    inicioOpcoes = i;
  }
  if (inicioOpcoes >= linhas.length - 1) return null;

  const body = linhas.slice(0, inicioOpcoes).join('\n');
  if (!body) return null;

  const opcoes: OpcaoMenuInterativo[] = [];
  for (let i = inicioOpcoes; i < linhas.length; i += 1) {
    const m = linhas[i]!.match(opcaoRe);
    if (!m) return null;
    const id = m[1]!;
    const resto = m[2]!;
    const sep = resto.indexOf(' — ');
    if (sep > 0) {
      opcoes.push({
        id,
        titulo: resto.slice(0, sep).trim().slice(0, 24),
        descricao: resto.slice(sep + 3).trim().slice(0, 72),
      });
    } else {
      opcoes.push({ id, titulo: resto.slice(0, 24) });
    }
  }

  if (opcoes.length < 2) return null;
  return {
    body,
    opcoes,
    botaoLista: opcoes.length > 3 ? 'Ver opções' : undefined,
  };
}

/**
 * Agrupa respostas do bot em partes texto vs menu (para envio Meta).
 * Também une "pergunta" + linhas "1 …" / "2 …" enviadas em respostas separadas.
 */
export function particionarRespostasBot(
  respostas: string[],
): Array<{ tipo: 'texto'; texto: string } | { tipo: 'menu'; menu: MenuInterativo }> {
  const partes: Array<{ tipo: 'texto'; texto: string } | { tipo: 'menu'; menu: MenuInterativo }> =
    [];
  let i = 0;
  while (i < respostas.length) {
    const atual = respostas[i]!;
    const menuDireto = resolverMenuInterativo(atual);
    if (menuDireto) {
      partes.push({ tipo: 'menu', menu: menuDireto });
      i += 1;
      continue;
    }

    const opcaoRe = /^(\d+)\s+\S/;
    if (i + 1 < respostas.length && opcaoRe.test(respostas[i + 1]!.trim())) {
      const linhas = [atual];
      let j = i + 1;
      while (j < respostas.length && opcaoRe.test(respostas[j]!.trim())) {
        linhas.push(respostas[j]!);
        j += 1;
      }
      const menuAgrupado = resolverMenuInterativo(linhas.join('\n'));
      if (menuAgrupado) {
        partes.push({ tipo: 'menu', menu: menuAgrupado });
        i = j;
        continue;
      }
    }

    partes.push({ tipo: 'texto', texto: atual });
    i += 1;
  }
  return partes;
}
