export const PerfilUsuario = {
  PROPRIETARIO: 'PROPRIETARIO',
  GESTOR: 'GESTOR',
  VENDEDOR: 'VENDEDOR',
  ATENDENTE: 'ATENDENTE',
} as const;
export type PerfilUsuario = (typeof PerfilUsuario)[keyof typeof PerfilUsuario];

export const TipoContato = {
  PROPRIETARIO_OBRA: 'PROPRIETARIO_OBRA',
  ARQUITETO: 'ARQUITETO',
  ENGENHEIRO: 'ENGENHEIRO',
  CONSTRUTORA: 'CONSTRUTORA',
  INSTALADOR: 'INSTALADOR',
  COMPRADOR: 'COMPRADOR',
  EMPRESA: 'EMPRESA',
  OUTRO: 'OUTRO',
} as const;
export type TipoContato = (typeof TipoContato)[keyof typeof TipoContato];

export const StatusObra = {
  PLANEJAMENTO: 'PLANEJAMENTO',
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  PAUSADA: 'PAUSADA',
  CONCLUIDA: 'CONCLUIDA',
  CANCELADA: 'CANCELADA',
} as const;
export type StatusObra = (typeof StatusObra)[keyof typeof StatusObra];

export const TipoEtapaFunil = {
  ABERTA: 'ABERTA',
  GANHA: 'GANHA',
  PERDIDA: 'PERDIDA',
} as const;
export type TipoEtapaFunil = (typeof TipoEtapaFunil)[keyof typeof TipoEtapaFunil];

export const OrigemHistoricoEtapa = {
  CRIACAO: 'CRIACAO',
  MANUAL: 'MANUAL',
  CHATBOT: 'CHATBOT',
  ORCAMENTO_WHATSAPP: 'ORCAMENTO_WHATSAPP',
} as const;
export type OrigemHistoricoEtapa =
  (typeof OrigemHistoricoEtapa)[keyof typeof OrigemHistoricoEtapa];

export const ChaveEtapaSistema = {
  NOVO_CONTATO: 'NOVO_CONTATO',
  QUALIFICACAO: 'QUALIFICACAO',
  ORCAMENTO_ENVIADO: 'ORCAMENTO_ENVIADO',
  NEGOCIACAO: 'NEGOCIACAO',
  FECHADO: 'FECHADO',
  PERDIDO: 'PERDIDO',
} as const;
export type ChaveEtapaSistema = (typeof ChaveEtapaSistema)[keyof typeof ChaveEtapaSistema];

export const PrioridadeOportunidade = {
  BAIXA: 'BAIXA',
  MEDIA: 'MEDIA',
  ALTA: 'ALTA',
  URGENTE: 'URGENTE',
} as const;
export type PrioridadeOportunidade =
  (typeof PrioridadeOportunidade)[keyof typeof PrioridadeOportunidade];

export const TipoAtividade = {
  LIGACAO: 'LIGACAO',
  MENSAGEM: 'MENSAGEM',
  REUNIAO: 'REUNIAO',
  ENVIAR_ORCAMENTO: 'ENVIAR_ORCAMENTO',
  REVISAR_ORCAMENTO: 'REVISAR_ORCAMENTO',
  FOLLOW_UP: 'FOLLOW_UP',
  TAREFA: 'TAREFA',
} as const;
export type TipoAtividade = (typeof TipoAtividade)[keyof typeof TipoAtividade];

export const ProvedorWhatsApp = {
  MOCK: 'MOCK',
  META: 'META',
} as const;
export type ProvedorWhatsApp = (typeof ProvedorWhatsApp)[keyof typeof ProvedorWhatsApp];

/** Modo operacional da conexão (string no banco). */
export const ModoConexaoWhatsApp = {
  CLOUD_API: 'cloud_api',
  COEXISTENCE: 'coexistence',
} as const;
export type ModoConexaoWhatsApp =
  (typeof ModoConexaoWhatsApp)[keyof typeof ModoConexaoWhatsApp];

export const StatusConexaoWhatsApp = {
  DESCONECTADO: 'DESCONECTADO',
  CONECTANDO: 'CONECTANDO',
  QR_CODE: 'QR_CODE',
  CONECTADO: 'CONECTADO',
  ERRO: 'ERRO',
} as const;
export type StatusConexaoWhatsApp =
  (typeof StatusConexaoWhatsApp)[keyof typeof StatusConexaoWhatsApp];

export const StatusConversa = {
  BOT_ATENDENDO: 'BOT_ATENDENDO',
  AGUARDANDO_HUMANO: 'AGUARDANDO_HUMANO',
  EM_ATENDIMENTO: 'EM_ATENDIMENTO',
  AGUARDANDO_CLIENTE: 'AGUARDANDO_CLIENTE',
  FINALIZADA: 'FINALIZADA',
} as const;
export type StatusConversa = (typeof StatusConversa)[keyof typeof StatusConversa];

export const ModoAtendimento = {
  BOT: 'BOT',
  HUMANO: 'HUMANO',
  PAUSADO: 'PAUSADO',
} as const;
export type ModoAtendimento = (typeof ModoAtendimento)[keyof typeof ModoAtendimento];

export const DirecaoMensagem = {
  RECEBIDA: 'RECEBIDA',
  ENVIADA: 'ENVIADA',
} as const;
export type DirecaoMensagem = (typeof DirecaoMensagem)[keyof typeof DirecaoMensagem];

export const TipoMensagem = {
  TEXTO: 'TEXTO',
  IMAGEM: 'IMAGEM',
  AUDIO: 'AUDIO',
  DOCUMENTO: 'DOCUMENTO',
  LOCALIZACAO: 'LOCALIZACAO',
  SISTEMA: 'SISTEMA',
} as const;
export type TipoMensagem = (typeof TipoMensagem)[keyof typeof TipoMensagem];

export const StatusMensagem = {
  RECEBIDA: 'RECEBIDA',
  PROCESSANDO: 'PROCESSANDO',
  ENVIADA: 'ENVIADA',
  ENTREGUE: 'ENTREGUE',
  LIDA: 'LIDA',
  ERRO: 'ERRO',
} as const;
export type StatusMensagem = (typeof StatusMensagem)[keyof typeof StatusMensagem];

export const EntidadeCampoPersonalizado = {
  CONTATO: 'CONTATO',
  OBRA: 'OBRA',
  OPORTUNIDADE: 'OPORTUNIDADE',
} as const;
export type EntidadeCampoPersonalizado =
  (typeof EntidadeCampoPersonalizado)[keyof typeof EntidadeCampoPersonalizado];

export const TipoCampoPersonalizado = {
  TEXTO: 'TEXTO',
  TEXTO_LONGO: 'TEXTO_LONGO',
  NUMERO: 'NUMERO',
  MOEDA: 'MOEDA',
  DATA: 'DATA',
  BOOLEANO: 'BOOLEANO',
  SELECAO: 'SELECAO',
  MULTISSELECAO: 'MULTISSELECAO',
} as const;
export type TipoCampoPersonalizado =
  (typeof TipoCampoPersonalizado)[keyof typeof TipoCampoPersonalizado];

export const SegmentoEmpresa = {
  ILUMINACAO: 'ILUMINACAO',
  PISOS_REVESTIMENTOS: 'PISOS_REVESTIMENTOS',
  ESQUADRIAS: 'ESQUADRIAS',
  CONCRETO: 'CONCRETO',
  MATERIAIS_CONSTRUCAO: 'MATERIAIS_CONSTRUCAO',
  SERVICOS_OBRAS: 'SERVICOS_OBRAS',
  OUTRO: 'OUTRO',
} as const;
export type SegmentoEmpresa = (typeof SegmentoEmpresa)[keyof typeof SegmentoEmpresa];

export const IntencaoChatbot = {
  VENDAS: 'VENDAS',
  NOVO_ORCAMENTO: 'NOVO_ORCAMENTO',
  NEGOCIAR_ORCAMENTO: 'NEGOCIAR_ORCAMENTO',
  AJUSTAR_ORCAMENTO: 'AJUSTAR_ORCAMENTO',
  DUVIDA: 'DUVIDA',
  ACOMPANHAR_SOLICITACAO: 'ACOMPANHAR_SOLICITACAO',
  FINANCEIRO: 'FINANCEIRO',
  ENTREGA: 'ENTREGA',
  SAC: 'SAC',
  POS_VENDA: 'POS_VENDA',
  FALAR_COM_PESSOA: 'FALAR_COM_PESSOA',
  OUTRO: 'OUTRO',
} as const;
export type IntencaoChatbot = (typeof IntencaoChatbot)[keyof typeof IntencaoChatbot];

export const StatusOrcamento = {
  RASCUNHO: 'RASCUNHO',
  ENVIADO: 'ENVIADO',
  ACEITO: 'ACEITO',
  CANCELADO: 'CANCELADO',
  CONVERTIDO: 'CONVERTIDO',
} as const;
export type StatusOrcamento = (typeof StatusOrcamento)[keyof typeof StatusOrcamento];

export const StatusNotaFiscal = {
  RASCUNHO: 'RASCUNHO',
  PROCESSANDO: 'PROCESSANDO',
  AUTORIZADA: 'AUTORIZADA',
  REJEITADA: 'REJEITADA',
  CANCELADA: 'CANCELADA',
} as const;
export type StatusNotaFiscal = (typeof StatusNotaFiscal)[keyof typeof StatusNotaFiscal];

export const TipoMovimentacaoEstoque = {
  ENTRADA: 'ENTRADA',
  BAIXA: 'BAIXA',
  AJUSTE: 'AJUSTE',
} as const;
export type TipoMovimentacaoEstoque =
  (typeof TipoMovimentacaoEstoque)[keyof typeof TipoMovimentacaoEstoque];

export const SEGMENTO_ROTULOS: Record<SegmentoEmpresa, string> = {
  ILUMINACAO: 'Iluminação',
  PISOS_REVESTIMENTOS: 'Pisos e revestimentos',
  ESQUADRIAS: 'Esquadrias',
  CONCRETO: 'Concreto',
  MATERIAIS_CONSTRUCAO: 'Materiais de construção',
  SERVICOS_OBRAS: 'Serviços para obras',
  OUTRO: 'Outro',
};

export const PERFIL_ROTULOS: Record<PerfilUsuario, string> = {
  PROPRIETARIO: 'Proprietário',
  GESTOR: 'Gestor',
  VENDEDOR: 'Vendedor',
  ATENDENTE: 'Atendente',
};
