import { IntencaoChatbot, type IntencaoIa } from '@arcco/contratos';

interface RegraIntencao {
  intencao: IntencaoChatbot;
  termos: RegExp[];
  peso: number;
}

const REGRAS: RegraIntencao[] = [
  {
    intencao: IntencaoChatbot.FALAR_COM_PESSOA,
    peso: 1,
    termos: [
      /\batendente\b/i,
      /\bhumano\b/i,
      /\bpessoa\b/i,
      /falar com (algu[eé]m|vendedor|voc[eê]s)/i,
      /\bvendedor\b/i,
    ],
  },
  {
    intencao: IntencaoChatbot.NOVO_ORCAMENTO,
    peso: 0.9,
    termos: [
      /or[çc]amento/i,
      /or[çc]ar/i,
      /pre[çc]o/i,
      /\bcota[çc][aã]o\b/i,
      /\bcomprar\b/i,
      /\bquanto custa\b/i,
      /\bvalor\b/i,
      /\bproposta\b/i,
    ],
  },
  {
    intencao: IntencaoChatbot.NEGOCIAR_ORCAMENTO,
    peso: 0.8,
    termos: [/\bdesconto\b/i, /\bnegociar\b/i, /\bcondi[çc][aã]o\b/i, /\bparcelar\b/i, /\bmelhorar o pre[çc]o\b/i],
  },
  {
    intencao: IntencaoChatbot.AJUSTAR_ORCAMENTO,
    peso: 0.8,
    termos: [/\bajustar\b/i, /\balterar\b/i, /\bmudar\b/i, /\brevisar\b/i, /\bcorrigir\b/i],
  },
  {
    intencao: IntencaoChatbot.ACOMPANHAR_SOLICITACAO,
    peso: 0.7,
    termos: [/\bandamento\b/i, /\bstatus\b/i, /\bacompanhar\b/i, /\bmeu pedido\b/i, /\bprotocolo\b/i],
  },
  {
    intencao: IntencaoChatbot.ENTREGA,
    peso: 0.7,
    termos: [/\bentrega\b/i, /\bfrete\b/i, /\bprazo de entrega\b/i, /\brastreio\b/i],
  },
  {
    intencao: IntencaoChatbot.FINANCEIRO,
    peso: 0.7,
    termos: [/\bboleto\b/i, /\bnota fiscal\b/i, /\bpagamento\b/i, /\bfinanceiro\b/i, /\bfatura\b/i],
  },
  {
    intencao: IntencaoChatbot.POS_VENDA,
    peso: 0.6,
    termos: [/\bgarantia\b/i, /\bdefeito\b/i, /\breclama[çc][aã]o\b/i, /\bassist[eê]ncia\b/i, /\btroca\b/i],
  },
  {
    intencao: IntencaoChatbot.DUVIDA,
    peso: 0.4,
    termos: [
      /\bd[uú]vida\b/i,
      /\binforma[çc][aã]o\b/i,
      /\bcomo funciona\b/i,
      /\bme explica\b/i,
      /\btira(r)? uma d[uú]vida\b/i,
    ],
  },
];

const SAUDACOES =
  /^(oi|ol[aá]|oie|ola|al[oô]|alou|e a[ií]|bom dia|boa tarde|boa noite|hey|hello|opa)[\s!.]*$/i;

/**
 * Classificacao de intencao baseada em regras/palavras-chave. Deterministica,
 * util para o provedor de IA offline e para testes.
 */
export function classificarIntencaoRegras(texto: string): IntencaoIa {
  const normalizado = texto.trim();
  if (!normalizado) {
    return { intencao: IntencaoChatbot.OUTRO, confianca: 0 };
  }

  // Saudações curtas não devem disparar transferência (ex.: "Alou?")
  if (SAUDACOES.test(normalizado.replace(/\?+$/g, '').trim())) {
    return { intencao: IntencaoChatbot.OUTRO, confianca: 0.9 };
  }

  let melhor: { intencao: IntencaoChatbot; peso: number } | null = null;

  for (const regra of REGRAS) {
    const casou = regra.termos.some((re) => re.test(normalizado));
    if (casou && (!melhor || regra.peso > melhor.peso)) {
      melhor = { intencao: regra.intencao, peso: regra.peso };
    }
  }

  if (!melhor) {
    return { intencao: IntencaoChatbot.OUTRO, confianca: 0.2 };
  }
  return { intencao: melhor.intencao, confianca: melhor.peso };
}

/** Interpreta uma escolha de menu numerico (1-4). */
export function intencaoPorOpcaoMenu(texto: string): IntencaoChatbot | null {
  const t = texto.trim();
  if (/^1\b/.test(t)) return IntencaoChatbot.NOVO_ORCAMENTO;
  if (/^2\b/.test(t)) return IntencaoChatbot.ACOMPANHAR_SOLICITACAO;
  if (/^3\b/.test(t)) return IntencaoChatbot.DUVIDA;
  if (/^4\b/.test(t)) return IntencaoChatbot.FALAR_COM_PESSOA;
  return null;
}
