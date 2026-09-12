import {
  EntidadeCampoPersonalizado,
  SegmentoEmpresa,
  TipoCampoPersonalizado,
  TipoEtapaFunil,
  ChaveEtapaSistema,
} from '@arcco/contratos';

export interface CategoriaTemplate {
  nome: string;
  descricao?: string;
  ordem: number;
}

export interface EtapaTemplate {
  nome: string;
  ordem: number;
  tipo: TipoEtapaFunil;
  chaveSistema: string;
}

export interface CampoTemplate {
  entidade: EntidadeCampoPersonalizado;
  chave: string;
  rotulo: string;
  tipo: TipoCampoPersonalizado;
  obrigatorio?: boolean;
  opcoes?: string[];
  ordem?: number;
  usarNoChatbot?: boolean;
  textoPergunta?: string;
  mostrarNoResumo?: boolean;
}

export interface TemplateSegmento {
  categorias: CategoriaTemplate[];
  etapas: EtapaTemplate[];
  campos: CampoTemplate[];
}

/** Funil padrao usado por todos os segmentos. */
function funilPadrao(): EtapaTemplate[] {
  return [
    {
      nome: 'Novo contato',
      ordem: 1,
      tipo: TipoEtapaFunil.ABERTA,
      chaveSistema: ChaveEtapaSistema.NOVO_CONTATO,
    },
    {
      nome: 'Orçamento',
      ordem: 2,
      tipo: TipoEtapaFunil.ABERTA,
      chaveSistema: ChaveEtapaSistema.QUALIFICACAO,
    },
    {
      nome: 'Negociação',
      ordem: 3,
      tipo: TipoEtapaFunil.ABERTA,
      chaveSistema: ChaveEtapaSistema.NEGOCIACAO,
    },
    {
      nome: 'Fechado',
      ordem: 4,
      tipo: TipoEtapaFunil.GANHA,
      chaveSistema: ChaveEtapaSistema.FECHADO,
    },
    {
      nome: 'Perdido',
      ordem: 5,
      tipo: TipoEtapaFunil.PERDIDA,
      chaveSistema: ChaveEtapaSistema.PERDIDO,
    },
  ];
}

const CAMPOS_BASE: CampoTemplate[] = [
  {
    entidade: EntidadeCampoPersonalizado.OPORTUNIDADE,
    chave: 'prazo_desejado',
    rotulo: 'Prazo desejado',
    tipo: TipoCampoPersonalizado.TEXTO,
    ordem: 1,
    usarNoChatbot: true,
    textoPergunta: 'Para quando voce precisa? (prazo desejado)',
    mostrarNoResumo: true,
  },
];

const TEMPLATE_ILUMINACAO: TemplateSegmento = {
  categorias: [
    { nome: 'Luminarias', ordem: 1 },
    { nome: 'Fitas e perfis LED', ordem: 2 },
    { nome: 'Automacao e dimerizacao', ordem: 3 },
    { nome: 'Projeto luminotecnico', ordem: 4 },
    { nome: 'Area externa', ordem: 5 },
  ],
  etapas: funilPadrao(),
  campos: [
    ...CAMPOS_BASE,
    {
      entidade: EntidadeCampoPersonalizado.OPORTUNIDADE,
      chave: 'ambientes',
      rotulo: 'Ambientes',
      tipo: TipoCampoPersonalizado.TEXTO_LONGO,
      ordem: 2,
      usarNoChatbot: true,
      textoPergunta: 'Quais ambientes serao iluminados? (ex.: sala, cozinha, area externa)',
    },
    {
      entidade: EntidadeCampoPersonalizado.OPORTUNIDADE,
      chave: 'possui_projeto',
      rotulo: 'Possui projeto luminotecnico?',
      tipo: TipoCampoPersonalizado.BOOLEANO,
      ordem: 3,
      usarNoChatbot: true,
      textoPergunta: 'Voce ja possui um projeto luminotecnico?',
    },
    {
      entidade: EntidadeCampoPersonalizado.OBRA,
      chave: 'metragem',
      rotulo: 'Metragem (m2)',
      tipo: TipoCampoPersonalizado.NUMERO,
      ordem: 1,
    },
  ],
};

const TEMPLATE_CONCRETO: TemplateSegmento = {
  categorias: [
    { nome: 'Concreto usinado', ordem: 1 },
    { nome: 'Bombeamento', ordem: 2 },
    { nome: 'Concreto especial', ordem: 3 },
    { nome: 'Piso industrial', ordem: 4 },
    { nome: 'Locacao de equipamentos', ordem: 5 },
  ],
  etapas: funilPadrao(),
  campos: [
    ...CAMPOS_BASE,
    {
      entidade: EntidadeCampoPersonalizado.OPORTUNIDADE,
      chave: 'volume_m3',
      rotulo: 'Volume (m3)',
      tipo: TipoCampoPersonalizado.NUMERO,
      ordem: 2,
      obrigatorio: false,
      usarNoChatbot: true,
      textoPergunta: 'Qual o volume aproximado de concreto em m3?',
    },
    {
      entidade: EntidadeCampoPersonalizado.OPORTUNIDADE,
      chave: 'fck',
      rotulo: 'FCK (MPa)',
      tipo: TipoCampoPersonalizado.SELECAO,
      opcoes: ['20', '25', '30', '35', '40'],
      ordem: 3,
      usarNoChatbot: true,
      textoPergunta: 'Qual o FCK necessario? (20, 25, 30, 35 ou 40 MPa)',
    },
    {
      entidade: EntidadeCampoPersonalizado.OPORTUNIDADE,
      chave: 'precisa_bomba',
      rotulo: 'Precisa de bomba?',
      tipo: TipoCampoPersonalizado.BOOLEANO,
      ordem: 4,
      usarNoChatbot: true,
      textoPergunta: 'Vai precisar de bombeamento?',
    },
    {
      entidade: EntidadeCampoPersonalizado.OBRA,
      chave: 'tipo_estrutura',
      rotulo: 'Tipo de estrutura',
      tipo: TipoCampoPersonalizado.TEXTO,
      ordem: 1,
    },
  ],
};

const TEMPLATE_GENERICO: TemplateSegmento = {
  categorias: [
    { nome: 'Produtos', ordem: 1 },
    { nome: 'Servicos', ordem: 2 },
    { nome: 'Projetos', ordem: 3 },
  ],
  etapas: funilPadrao(),
  campos: [...CAMPOS_BASE],
};

const TEMPLATES: Partial<Record<SegmentoEmpresa, TemplateSegmento>> = {
  [SegmentoEmpresa.ILUMINACAO]: TEMPLATE_ILUMINACAO,
  [SegmentoEmpresa.CONCRETO]: TEMPLATE_CONCRETO,
};

/** Retorna o template de bootstrap (categorias, funil e campos) para o segmento. */
export function templatePorSegmento(segmento: SegmentoEmpresa): TemplateSegmento {
  return TEMPLATES[segmento] ?? TEMPLATE_GENERICO;
}
