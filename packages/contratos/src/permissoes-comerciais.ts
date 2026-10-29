import { PerfilUsuario } from './enums/index.js';
import { lerPersonalizacaoComercial } from './navegacao-comercial.js';
import { PersonalizacaoComercial } from './schemas/empresa.js';

/**
 * Catálogo da seção 16.2 (ECOL-26a + ECOL-26b).
 * Negado por padrão quando a flag ECOLUME está ligada e a chave não foi concedida.
 * PROPRIETARIO (administrador) recebe o conjunto completo.
 */
export const PermissaoComercial = {
  // Dados sensíveis (26a)
  VER_CUSTOS: 'VER_CUSTOS',
  VER_FATURAMENTO: 'VER_FATURAMENTO',
  VER_PAGAMENTOS: 'VER_PAGAMENTOS',
  VER_COMISSOES: 'VER_COMISSOES',
  // Ações já gateadas (26a)
  AJUSTAR_ESTOQUE: 'AJUSTAR_ESTOQUE',
  IMPORTAR_XML: 'IMPORTAR_XML',
  EMITIR_NF: 'EMITIR_NF',
  CANCELAR_NF: 'CANCELAR_NF',
  CARTA_CORRECAO: 'CARTA_CORRECAO',
  CANCELAR_PEDIDO: 'CANCELAR_PEDIDO',
  CONVERTER_PEDIDO: 'CONVERTER_PEDIDO',
  // Abas (26b / §6.1)
  ABA_VISAO_GERAL: 'ABA_VISAO_GERAL',
  ABA_NEGOCIOS: 'ABA_NEGOCIOS',
  ABA_AGENDA: 'ABA_AGENDA',
  ABA_CLIENTES: 'ABA_CLIENTES',
  ABA_PARCEIROS: 'ABA_PARCEIROS',
  ABA_ESTOQUE: 'ABA_ESTOQUE',
  ABA_FISCAL: 'ABA_FISCAL',
  ABA_CONFIGURACOES: 'ABA_CONFIGURACOES',
  // Preço dentro do limite ECOL-02 (sem VER_CUSTOS)
  ALTERAR_PRECO: 'ALTERAR_PRECO',
  // Escopo agenda (mutuamente preferenciais; default efetivo = PROPRIAS)
  ESCOPO_AGENDA_TODAS: 'ESCOPO_AGENDA_TODAS',
  ESCOPO_AGENDA_PROPRIAS: 'ESCOPO_AGENDA_PROPRIAS',
  ESCOPO_AGENDA_ENTREGAS: 'ESCOPO_AGENDA_ENTREGAS',
  // Negócios: sem VER_NEGOCIOS_TODOS → só os próprios
  VER_NEGOCIOS_TODOS: 'VER_NEGOCIOS_TODOS',
  // Exclusões
  EXCLUIR_CLIENTE: 'EXCLUIR_CLIENTE',
  EXCLUIR_ORCAMENTO_RASCUNHO: 'EXCLUIR_ORCAMENTO_RASCUNHO',
  EXCLUIR_PRODUTO: 'EXCLUIR_PRODUTO',
} as const;

export type PermissaoComercial = (typeof PermissaoComercial)[keyof typeof PermissaoComercial];

export const PERMISSOES_COMERCIAIS = Object.values(PermissaoComercial);

const CATALOGO = new Set<string>(PERMISSOES_COMERCIAIS);

export const PERMISSOES_FINANCEIRAS = [
  PermissaoComercial.VER_CUSTOS,
  PermissaoComercial.VER_FATURAMENTO,
  PermissaoComercial.VER_PAGAMENTOS,
  PermissaoComercial.VER_COMISSOES,
] as const;

/** Agrupamento para UI de atribuição (§16.2). */
export const GRUPOS_PERMISSAO_UI: ReadonlyArray<{
  id: string;
  rotulo: string;
  chaves: readonly PermissaoComercial[];
}> = [
  {
    id: 'abas',
    rotulo: 'Abas',
    chaves: [
      PermissaoComercial.ABA_VISAO_GERAL,
      PermissaoComercial.ABA_NEGOCIOS,
      PermissaoComercial.ABA_AGENDA,
      PermissaoComercial.ABA_CLIENTES,
      PermissaoComercial.ABA_PARCEIROS,
      PermissaoComercial.ABA_ESTOQUE,
      PermissaoComercial.ABA_FISCAL,
      PermissaoComercial.ABA_CONFIGURACOES,
    ],
  },
  {
    id: 'custos',
    rotulo: 'Custos e preço',
    chaves: [PermissaoComercial.VER_CUSTOS, PermissaoComercial.ALTERAR_PRECO],
  },
  {
    id: 'financeiro',
    rotulo: 'Financeiro',
    chaves: [
      PermissaoComercial.VER_FATURAMENTO,
      PermissaoComercial.VER_PAGAMENTOS,
      PermissaoComercial.VER_COMISSOES,
    ],
  },
  {
    id: 'negocios',
    rotulo: 'Negócios e pedidos',
    chaves: [
      PermissaoComercial.VER_NEGOCIOS_TODOS,
      PermissaoComercial.CONVERTER_PEDIDO,
      PermissaoComercial.CANCELAR_PEDIDO,
    ],
  },
  {
    id: 'estoque',
    rotulo: 'Estoque',
    chaves: [PermissaoComercial.AJUSTAR_ESTOQUE, PermissaoComercial.IMPORTAR_XML],
  },
  {
    id: 'fiscal',
    rotulo: 'Fiscal',
    chaves: [
      PermissaoComercial.EMITIR_NF,
      PermissaoComercial.CANCELAR_NF,
      PermissaoComercial.CARTA_CORRECAO,
    ],
  },
  {
    id: 'agenda',
    rotulo: 'Agenda (escopo)',
    chaves: [
      PermissaoComercial.ESCOPO_AGENDA_TODAS,
      PermissaoComercial.ESCOPO_AGENDA_PROPRIAS,
      PermissaoComercial.ESCOPO_AGENDA_ENTREGAS,
    ],
  },
  {
    id: 'exclusoes',
    rotulo: 'Exclusões',
    chaves: [
      PermissaoComercial.EXCLUIR_CLIENTE,
      PermissaoComercial.EXCLUIR_ORCAMENTO_RASCUNHO,
      PermissaoComercial.EXCLUIR_PRODUTO,
    ],
  },
];

export const ABA_POR_ITEM_NAV: Record<string, PermissaoComercial> = {
  dashboard: PermissaoComercial.ABA_VISAO_GERAL,
  pipeline: PermissaoComercial.ABA_NEGOCIOS,
  agenda: PermissaoComercial.ABA_AGENDA,
  clientes: PermissaoComercial.ABA_CLIENTES,
  parceiros: PermissaoComercial.ABA_PARCEIROS,
  produtos: PermissaoComercial.ABA_ESTOQUE,
  estoque: PermissaoComercial.ABA_ESTOQUE,
  fornecedores: PermissaoComercial.ABA_ESTOQUE,
  fiscal: PermissaoComercial.ABA_FISCAL,
  configuracoes: PermissaoComercial.ABA_CONFIGURACOES,
};

export type EscopoAgendaEfetivo = 'TODAS' | 'PROPRIAS' | 'ENTREGAS';

/** Nomes de campo que revelam o dado da chave. Preço de venda não entra aqui. */
export const CAMPOS_POR_PERMISSAO: Record<(typeof PERMISSOES_FINANCEIRAS)[number], readonly string[]> = {
  VER_CUSTOS: [
    'custo',
    'custoAquisicao',
    'ultimoPreco',
    'ultimoPrecoCompra',
    'custoMedio',
    'precoCusto',
    'precoUnitarioCusto',
    'custoReferenciaSaldo',
    'ipi',
    'aliquotaIpi',
    'percentualIpi',
    'st',
    'aliquotaSt',
    'percentualSt',
    'mva',
    'margem',
    'margemEfetiva',
    'margemPercentual',
    'custoBase',
    'baseCusto',
    'ipiPercentual',
    'stPercentual',
    'lucro',
    'lucroEstimado',
    'rentabilidade',
  ],
  VER_FATURAMENTO: [
    'faturamento',
    'faturamentoPeriodo',
    'faturamentoAnterior',
    'variacaoFaturamentoPercentual',
    'ticketMedio',
    'ticketMedioGanho',
    'valorGanhoNoPeriodo',
    'valorPipeline',
    'indicadores',
    'vendasConcluidas',
    'orcamentosAbertos',
    'valorVendido',
    'quantidadePedidos',
    'parceiros',
    // ECOL-09b — ficha do cliente
    'totalComprado',
    'ultimaCompraEm',
    'resumoCliente',
  ],
  VER_PAGAMENTOS: [
    'pagamento',
    'pagamentos',
    'valorPago',
    'valorRecebido',
    'valorAReceber',
    'aPagar',
    'aReceber',
    'chavePix',
    'banco',
    'agencia',
    'conta',
    'titularNome',
    'titularDocumento',
    'modeloPagamento',
  ],
  VER_COMISSOES: [
    'comissao',
    'comissoes',
    'valorComissao',
    'comissaoPaga',
    'comissaoGerada',
    'rtPadrao',
    'rtNegocio',
    'rtPercentual',
    'baseCalculo',
    // ECOL-10b — comissões do parceiro
    'comissaoAPagar',
    'vendasIndicadas',
    'extratoComissoes',
    'negociosAbertos',
    'totalComissaoAPagar',
  ],
};

const CHAVES_DE_ORDEM = new Set(['orderBy', 'ordenar', 'sort', 'ordem']);

export type ContextoPermissao =
  | { modo: 'legado' }
  | { modo: 'ecolume'; chaves: ReadonlySet<string> };

export function permissaoConhecida(chave: string): chave is PermissaoComercial {
  return CATALOGO.has(chave);
}

/**
 * Flag desligada: a camada não restringe (modo legado).
 * Com a flag, só o proprietário (administrador) recebe o catálogo inteiro.
 * GESTOR e demais: apenas chaves gravadas. Lista vazia não libera nada.
 */
export function resolverPermissoes(entrada: {
  configuracoes: unknown;
  perfil: string;
  concedidas: readonly string[];
}): ContextoPermissao {
  if (lerPersonalizacaoComercial(entrada.configuracoes) !== PersonalizacaoComercial.ECOLUME) {
    return { modo: 'legado' };
  }
  if (entrada.perfil === PerfilUsuario.PROPRIETARIO) {
    return { modo: 'ecolume', chaves: new Set(PERMISSOES_COMERCIAIS) };
  }
  const chaves = entrada.concedidas.filter((chave) => CATALOGO.has(chave));
  return { modo: 'ecolume', chaves: new Set(chaves) };
}

export function possuiPermissao(ctx: ContextoPermissao, chave: PermissaoComercial): boolean {
  if (ctx.modo === 'legado') return true;
  return ctx.chaves.has(chave);
}

export function chavesVisiveis(ctx: ContextoPermissao): string[] | null {
  if (ctx.modo === 'legado') return null;
  return [...ctx.chaves];
}

/** Escopo efetivo da agenda. Sem chave TODAS/ENTREGAS → só próprias. */
export function escopoAgendaEfetivo(ctx: ContextoPermissao): EscopoAgendaEfetivo {
  if (ctx.modo === 'legado') return 'TODAS';
  if (possuiPermissao(ctx, PermissaoComercial.ESCOPO_AGENDA_TODAS)) return 'TODAS';
  if (possuiPermissao(ctx, PermissaoComercial.ESCOPO_AGENDA_ENTREGAS)) return 'ENTREGAS';
  return 'PROPRIAS';
}

export function veTodosNegocios(ctx: ContextoPermissao): boolean {
  if (ctx.modo === 'legado') return true;
  return possuiPermissao(ctx, PermissaoComercial.VER_NEGOCIOS_TODOS);
}

/** Normaliza escopos de agenda: no máximo um dos três. */
export function normalizarChavesPermissao(chaves: readonly string[]): PermissaoComercial[] {
  const validas = chaves.filter(permissaoConhecida);
  const set = new Set(validas);
  const escopos = [
    PermissaoComercial.ESCOPO_AGENDA_TODAS,
    PermissaoComercial.ESCOPO_AGENDA_PROPRIAS,
    PermissaoComercial.ESCOPO_AGENDA_ENTREGAS,
  ] as const;
  const presentes = escopos.filter((e) => set.has(e));
  if (presentes.length > 1) {
    for (const e of escopos) set.delete(e);
    // Preferência: TODAS > ENTREGAS > PROPRIAS
    if (presentes.includes(PermissaoComercial.ESCOPO_AGENDA_TODAS)) {
      set.add(PermissaoComercial.ESCOPO_AGENDA_TODAS);
    } else if (presentes.includes(PermissaoComercial.ESCOPO_AGENDA_ENTREGAS)) {
      set.add(PermissaoComercial.ESCOPO_AGENDA_ENTREGAS);
    } else {
      set.add(PermissaoComercial.ESCOPO_AGENDA_PROPRIAS);
    }
  }
  return [...set] as PermissaoComercial[];
}

function permissaoDoCampo(campo: string): PermissaoComercial | null {
  for (const chave of PERMISSOES_FINANCEIRAS) {
    if (CAMPOS_POR_PERMISSAO[chave].includes(campo)) return chave;
  }
  return null;
}

function campoBloqueado(ctx: ContextoPermissao, campo: string): boolean {
  const chave = permissaoDoCampo(campo);
  if (!chave) return false;
  return !possuiPermissao(ctx, chave);
}

function limparFunil(itens: unknown[], ctx: ContextoPermissao): unknown[] {
  if (possuiPermissao(ctx, PermissaoComercial.VER_FATURAMENTO)) {
    return itens.map((item) => publicarResposta(ctx, item));
  }
  return itens.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return publicarResposta(ctx, item);
    if (!('etapaId' in item)) return publicarResposta(ctx, item);
    const copia = { ...(item as Record<string, unknown>) };
    delete copia.valor;
    return publicarResposta(ctx, copia);
  });
}

/** Remove campos financeiros não autorizados. Preço comercial, totais e estoque permanecem. */
export function publicarResposta<T>(ctx: ContextoPermissao, valor: T): T {
  if (ctx.modo === 'legado' || valor === null || valor === undefined) return valor;
  if (Array.isArray(valor)) return valor.map((item) => publicarResposta(ctx, item)) as T;
  if (typeof valor !== 'object') return valor;
  if (valor instanceof Date || valor instanceof Uint8Array) return valor;
  const nomeCtor = (valor as { constructor?: { name?: string } }).constructor?.name;
  if (nomeCtor === 'Buffer') return valor;
  const proto = Object.getPrototypeOf(valor);
  if (proto !== Object.prototype && proto !== null) return valor;

  const saida: Record<string, unknown> = {};
  for (const [campo, conteudo] of Object.entries(valor as Record<string, unknown>)) {
    if (campoBloqueado(ctx, campo)) continue;
    if (campo === 'funil' && Array.isArray(conteudo)) {
      saida[campo] = limparFunil(conteudo, ctx);
      continue;
    }
    saida[campo] = publicarResposta(ctx, conteudo);
  }
  return saida as T;
}

function coletarCampos(valor: unknown, destino: string[], ctx: ContextoPermissao): void {
  if (!valor || typeof valor !== 'object') return;
  if (Array.isArray(valor)) {
    for (const item of valor) coletarCampos(item, destino, ctx);
    return;
  }
  for (const [campo, conteudo] of Object.entries(valor as Record<string, unknown>)) {
    if (campoBloqueado(ctx, campo)) destino.push(campo);
    if (CHAVES_DE_ORDEM.has(campo)) {
      const candidatos = Array.isArray(conteudo) ? conteudo : [conteudo];
      for (const candidato of candidatos) {
        if (typeof candidato === 'string' && campoBloqueado(ctx, candidato)) destino.push(candidato);
      }
    }
    coletarCampos(conteudo, destino, ctx);
  }
}

/** Campos de corpo ou consulta que revelariam dado financeiro sem a chave. */
export function camposFinanceirosProibidos(ctx: ContextoPermissao, valor: unknown): string[] {
  if (ctx.modo === 'legado' || valor === null || valor === undefined) return [];
  const destino: string[] = [];
  coletarCampos(valor, destino, ctx);
  return destino;
}
