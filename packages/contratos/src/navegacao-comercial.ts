import {
  PersonalizacaoComercial,
  personalizacaoComercialSchema,
  type PersonalizacaoComercial as TipoPersonalizacao,
} from './schemas/empresa.js';
import { ABA_POR_ITEM_NAV, type PermissaoComercial } from './permissoes-comerciais.js';

export interface ItemNavegacaoComercial {
  id: string;
  rotulo: string;
  rota: string;
}

/** Rotas do produto compartilhado que a personalização Ecolume não oferece na interface. */
export const ROTAS_OCULTAS_ECOLUME = [
  'conversas',
  'obras',
  'obra-detalhe',
  'config-whatsapp',
  'config-chatbot',
] as const;

export type RotaOcultaEcolume = (typeof ROTAS_OCULTAS_ECOLUME)[number];

const ROTAS_OCULTAS = new Set<string>(ROTAS_OCULTAS_ECOLUME);

/**
 * Lê só a chave persistida. Valor ausente ou inválido permanece PADRAO.
 * O chamador deve passar o JSON gravado da empresa autenticada, nunca um corpo de requisição do browser.
 */
export function lerPersonalizacaoComercial(configuracoes: unknown): TipoPersonalizacao {
  if (!configuracoes || typeof configuracoes !== 'object') {
    return PersonalizacaoComercial.PADRAO;
  }
  const valor = (configuracoes as { personalizacaoComercial?: unknown }).personalizacaoComercial;
  const resultado = personalizacaoComercialSchema.safeParse(valor);
  return resultado.success ? resultado.data : PersonalizacaoComercial.PADRAO;
}

export function personalizacaoEcolumeAtiva(configuracoes: unknown): boolean {
  return lerPersonalizacaoComercial(configuracoes) === PersonalizacaoComercial.ECOLUME;
}

export function rotaOcultaNaPersonalizacao(
  nomeRota: string | null | undefined,
  personalizacao: TipoPersonalizacao | null | undefined,
): boolean {
  if (personalizacao !== PersonalizacaoComercial.ECOLUME || !nomeRota) return false;
  return ROTAS_OCULTAS.has(nomeRota);
}

/**
 * Menu do shell comercial. A ordem Ecolume segue a seção 6.1 com os destinos já implementados.
 * Com `chavesComerciais` (ECOLUME), filtra por ABA_* (26b). `null` = legado / sem filtro de aba.
 */
export function itensNavegacaoComercial(opcoes: {
  personalizacao: TipoPersonalizacao | null | undefined;
  podeCatalogo: boolean;
  podeConfigurar: boolean;
  /** null = legado (sem filtro de aba). Array = chaves efetivas da sessão. */
  chavesComerciais?: readonly string[] | null;
}): ItemNavegacaoComercial[] {
  if (opcoes.personalizacao === PersonalizacaoComercial.ECOLUME) {
    const itens: ItemNavegacaoComercial[] = [
      { id: 'dashboard', rotulo: 'Visão geral', rota: '/app/dashboard' },
      { id: 'pipeline', rotulo: 'Negócios', rota: '/app/pipeline' },
      { id: 'agenda', rotulo: 'Agenda', rota: '/app/agenda' },
      { id: 'clientes', rotulo: 'Clientes', rota: '/app/clientes' },
      { id: 'parceiros', rotulo: 'Parceiros', rota: '/app/parceiros' },
    ];
    if (opcoes.podeCatalogo) {
      itens.push(
        { id: 'produtos', rotulo: 'Produtos', rota: '/app/produtos' },
        { id: 'estoque', rotulo: 'Estoque', rota: '/app/estoque' },
        { id: 'fornecedores', rotulo: 'Fornecedores', rota: '/app/fornecedores' },
        { id: 'fiscal', rotulo: 'Fiscal', rota: '/app/fiscal' },
      );
    }
    if (opcoes.podeConfigurar) {
      itens.push({
        id: 'configuracoes',
        rotulo: 'Configurações',
        rota: '/app/configuracoes/empresa',
      });
    }
    const chaves = opcoes.chavesComerciais;
    if (chaves == null) return itens;
    const set = new Set(chaves);
    return itens.filter((item) => {
      const aba = ABA_POR_ITEM_NAV[item.id] as PermissaoComercial | undefined;
      if (!aba) return true;
      return set.has(aba);
    });
  }

  const itens: ItemNavegacaoComercial[] = [
    { id: 'dashboard', rotulo: 'Visão geral', rota: '/app/dashboard' },
    { id: 'conversas', rotulo: 'Conversas', rota: '/app/conversas' },
    { id: 'pipeline', rotulo: 'Negócios', rota: '/app/pipeline' },
    { id: 'agenda', rotulo: 'Agenda', rota: '/app/agenda' },
  ];
  if (opcoes.podeCatalogo) {
    itens.push(
      { id: 'produtos', rotulo: 'Produtos', rota: '/app/produtos' },
      { id: 'estoque', rotulo: 'Estoque', rota: '/app/estoque' },
    );
  }
  itens.push(
    { id: 'contatos', rotulo: 'Pessoas', rota: '/app/contatos' },
    { id: 'obras', rotulo: 'Projetos', rota: '/app/obras' },
  );
  if (opcoes.podeConfigurar) {
    itens.push({
      id: 'configuracoes',
      rotulo: 'Configurações',
      rota: '/app/configuracoes/empresa',
    });
  }
  return itens;
}
