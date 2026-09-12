/**
 * Textos oficiais do Chatbot Ecolume — Fluxo WhatsApp v8 (ARCCO).
 * A única personalização por empresa é o trecho da pergunta de projeto/materiais.
 */

export const SAUDACAO_PADRAO =
  'Olá! Seja muito bem-vindo à Ecolume. Sou o assistente virtual da equipe e estou aqui para tornar o seu atendimento mais ágil e preciso. Em breve, um dos nossos especialistas estará com você. Como posso direcioná-lo hoje?';

export const MENU_PRINCIPAL = [
  'Selecione uma das opções a seguir:',
  '1 Vendas — Negociação, orçamento novo, ajuste de orçamento',
  '2 Financeiro — Segunda via de boleto e NF, contestação de cobrança',
  '3 S.A.C — Serviço de pós-venda',
  '4 Entrega — Informações sobre a entrega do seu pedido',
  '5 Outros',
].join('\n');

export const OPCAO_INVALIDA =
  'Não consegui identificar sua seleção. Por favor, escolha uma das opções disponíveis.';

export const VENDAS = {
  menu: [
    'Ótimo. Para que possamos atendê-lo com mais precisão, selecione o tipo de solicitação:',
    '1 Novo Orçamento',
    '2 Ajuste de Orçamento',
    '3 Negociação',
    '4 Dúvidas',
  ].join('\n'),
  pedirCpf: 'Perfeito! Favor informar o seu CPF.',
  cadastroLocalizadoPrefixo: 'Cadastro localizado. ',
  pedirEnderecoObra: 'Verificamos que você ainda não possui cadastro. Favor informar o endereço da obra.',
  perguntaProjetoSimNao: (textoProjeto: string) =>
    [
      `Para elaborarmos seu orçamento com precisão, você já possui ${textoProjeto}?`,
      '1 Sim — tenho o projeto ou lista de materiais',
      '2 Não',
    ].join('\n'),
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
  menu: [
    'Para melhor direcioná-lo, selecione o assunto do seu contato financeiro:',
    '1 Segunda via de boleto ou nota fiscal',
    '2 Contestação de cobrança',
  ].join('\n'),
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
  menu: [
    'Para direcionarmos seu atendimento ao setor responsável, selecione o assunto da sua solicitação:',
    '1 Produto com defeito',
    '2 Dúvida técnica',
    '3 Reclamação',
    '4 Devolução ou troca de materiais',
  ].join('\n'),
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
  devolucaoMotivo: [
    'Qual é o motivo da devolução ou troca?',
    '1 Produto diferente do solicitado',
    '2 Desistência da compra',
    '3 Sobra de obra',
  ].join('\n'),
  devolucaoSobraObra:
    'Para solicitações de troca por sobra de obra, o produto deve estar devidamente embalado e sem sinais de uso. Vou encaminhar sua solicitação ao nosso time, que orientará sobre os próximos passos.',
  devolucaoNf: ['Você possui a nota fiscal da compra?', '1 Sim', '2 Não'].join('\n'),
  devolucaoFinal:
    'Obrigado. Sua solicitação de devolução ou troca foi registrada e encaminhada ao nosso time responsável. Em breve entraremos em contato para orientá-lo sobre os próximos passos.',
} as const;

export const ENTREGA = {
  menu: [
    'Para que possamos ajudá-lo com mais agilidade, selecione o assunto relacionado à sua entrega:',
    '1 Prazo de entrega',
    '2 Rastreamento de pedido',
    '3 Reagendamento de entrega',
    '4 Problema na entrega',
  ].join('\n'),
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
  problemaTipo: [
    'Qual é o problema ocorrido com a entrega?',
    '1 Pedido não chegou na data prevista',
    '2 Produto chegou avariado',
    '3 Produto recebido diferente do pedido',
  ].join('\n'),
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
