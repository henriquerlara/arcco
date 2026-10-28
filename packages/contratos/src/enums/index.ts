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

/** Natureza fiscal do contato na personalização ECOLUME (aditivo; nulo no legado). */
export const NaturezaPessoa = {
  PF: 'PF',
  PJ: 'PJ',
} as const;
export type NaturezaPessoa = (typeof NaturezaPessoa)[keyof typeof NaturezaPessoa];

/** Tipo de parceria ECOLUME (ECOL-10a). Independente de TipoContato legado. */
export const TipoParceiro = {
  ARQUITETO_DESIGNER: 'ARQUITETO_DESIGNER',
  INSTALADOR_ELETRICISTA: 'INSTALADOR_ELETRICISTA',
  CONSTRUTORA: 'CONSTRUTORA',
} as const;
export type TipoParceiro = (typeof TipoParceiro)[keyof typeof TipoParceiro];

/** RT padrão de novo parceiro enquanto ECOL-02 não expõe o parâmetro editável. */
export const RT_PADRAO_PARCEIRO = 10;

/** Origem do negócio ECOLUME (ECOL-11). */
export const OrigemNegocio = {
  CLIENTE_DIRETO: 'CLIENTE_DIRETO',
  VIA_PARCEIRO: 'VIA_PARCEIRO',
} as const;
export type OrigemNegocio = (typeof OrigemNegocio)[keyof typeof OrigemNegocio];

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
  /** ECOL-19 — pré-venda Ecolume (substitui QUALIFICACAO na flag). */
  ORCAMENTO_EM_ABERTO: 'ORCAMENTO_EM_ABERTO',
  /** ECOL-17/19 — pós-venda. */
  PEDIDO_CONFIRMADO: 'PEDIDO_CONFIRMADO',
  EM_SEPARACAO: 'EM_SEPARACAO',
  PRONTO_ENTREGA: 'PRONTO_ENTREGA',
  ENTREGUE: 'ENTREGUE',
  /** Coluna Finalizado do Kanban (pedido StatusPedido.FINALIZADO). */
  PEDIDO_FINALIZADO: 'PEDIDO_FINALIZADO',
  FECHADO: 'FECHADO',
  PERDIDO: 'PERDIDO',
} as const;
export type ChaveEtapaSistema = (typeof ChaveEtapaSistema)[keyof typeof ChaveEtapaSistema];

/** Colunas pré-venda ECOLUME (§12.1). */
export const COLUNAS_PRE_VENDA_ECOLUME = [
  ChaveEtapaSistema.NOVO_CONTATO,
  ChaveEtapaSistema.ORCAMENTO_EM_ABERTO,
  ChaveEtapaSistema.PERDIDO,
] as const;

/** Colunas pós-venda ECOLUME (§12.1) — cards de Pedido. */
export const COLUNAS_POS_VENDA_ECOLUME = [
  ChaveEtapaSistema.PEDIDO_CONFIRMADO,
  ChaveEtapaSistema.EM_SEPARACAO,
  ChaveEtapaSistema.PRONTO_ENTREGA,
  ChaveEtapaSistema.ENTREGUE,
  ChaveEtapaSistema.PEDIDO_FINALIZADO,
] as const;

/**
 * ECOL-19 — fase do pedido no Kanban (independente de StatusPedido.CANCELADO).
 * FINALIZADO usa StatusPedido; CANCELADO sai do funil ativo.
 */
export const FaseKanbanPedido = {
  PEDIDO_CONFIRMADO: 'PEDIDO_CONFIRMADO',
  EM_SEPARACAO: 'EM_SEPARACAO',
  PRONTO_ENTREGA: 'PRONTO_ENTREGA',
  ENTREGUE: 'ENTREGUE',
} as const;
export type FaseKanbanPedido = (typeof FaseKanbanPedido)[keyof typeof FaseKanbanPedido];

/** Motivos padrão §12.2 — lista editável fica na ECOL-02. */
export const MOTIVOS_PERDA_PADRAO = [
  { codigo: 'PRECO', rotulo: 'Preço', exigeDescricao: false },
  { codigo: 'PRAZO', rotulo: 'Prazo', exigeDescricao: false },
  { codigo: 'CONCORRENTE', rotulo: 'Comprou com concorrente', exigeDescricao: false },
  { codigo: 'DESISTIU_OBRA', rotulo: 'Desistiu da obra', exigeDescricao: false },
  { codigo: 'SEM_RESPOSTA', rotulo: 'Sem resposta', exigeDescricao: false },
  { codigo: 'OUTRO', rotulo: 'Outro', exigeDescricao: true },
] as const;
export type CodigoMotivoPerda = (typeof MOTIVOS_PERDA_PADRAO)[number]['codigo'];

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
  /** ECOL-20 — Agenda Ecolume (§13.1). */
  ENTREGA: 'ENTREGA',
  VISITA: 'VISITA',
} as const;
export type TipoAtividade = (typeof TipoAtividade)[keyof typeof TipoAtividade];

/** Tipos oferecidos na Agenda com flag ECOLUME (§13.1). */
export const TIPOS_ATIVIDADE_ECOLUME = [
  TipoAtividade.ENTREGA,
  TipoAtividade.VISITA,
  TipoAtividade.REUNIAO,
  TipoAtividade.FOLLOW_UP,
  TipoAtividade.TAREFA,
] as const;

/** Período do dia para entrega sem horário exato (§13.2). */
export const PeriodoDiaEntrega = {
  MANHA: 'MANHA',
  TARDE: 'TARDE',
} as const;
export type PeriodoDiaEntrega = (typeof PeriodoDiaEntrega)[keyof typeof PeriodoDiaEntrega];

export const ConclusaoEntrega = {
  PARCIAL: 'PARCIAL',
  FINAL: 'FINAL',
} as const;
export type ConclusaoEntrega = (typeof ConclusaoEntrega)[keyof typeof ConclusaoEntrega];

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

export const RamoProduto = {
  CONSTRUCAO: 'CONSTRUCAO',
  SAUDE: 'SAUDE',
} as const;
export type RamoProduto = (typeof RamoProduto)[keyof typeof RamoProduto];

export const StatusConsulta = {
  AGENDADA: 'AGENDADA',
  CONFIRMADA: 'CONFIRMADA',
  REALIZADA: 'REALIZADA',
  CANCELADA: 'CANCELADA',
} as const;
export type StatusConsulta = (typeof StatusConsulta)[keyof typeof StatusConsulta];

export const ESPECIALIDADES_CLINICA = [
  { id: 'clinico_geral', rotulo: 'Clínico geral' },
  { id: 'cardiologia', rotulo: 'Cardiologia' },
  { id: 'dermatologia', rotulo: 'Dermatologia' },
  { id: 'pediatria', rotulo: 'Pediatria' },
  { id: 'ginecologia', rotulo: 'Ginecologia' },
  { id: 'ortopedia', rotulo: 'Ortopedia' },
  { id: 'neurologia', rotulo: 'Neurologia' },
  { id: 'psiquiatria', rotulo: 'Psiquiatria' },
] as const;

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
  /** ECOL-12 — enviado substituído por outro no mesmo negócio. */
  SUBSTITUIDO: 'SUBSTITUIDO',
  /** ECOL-12 — recusado; somente leitura. */
  RECUSADO: 'RECUSADO',
} as const;
export type StatusOrcamento = (typeof StatusOrcamento)[keyof typeof StatusOrcamento];

/** Status em que o orçamento não pode ser editado. */
export const STATUS_ORCAMENTO_TRAVADOS: readonly StatusOrcamento[] = [
  StatusOrcamento.ENVIADO,
  StatusOrcamento.ACEITO,
  StatusOrcamento.CANCELADO,
  StatusOrcamento.CONVERTIDO,
  StatusOrcamento.SUBSTITUIDO,
  StatusOrcamento.RECUSADO,
];

export const StatusNotaFiscal = {
  RASCUNHO: 'RASCUNHO',
  PROCESSANDO: 'PROCESSANDO',
  AUTORIZADA: 'AUTORIZADA',
  REJEITADA: 'REJEITADA',
  CANCELADA: 'CANCELADA',
} as const;
export type StatusNotaFiscal = (typeof StatusNotaFiscal)[keyof typeof StatusNotaFiscal];

/**
 * ECOL-16 — status do pedido.
 * CONFIRMADO: estrutura criada (ECOL-17 completa pagamentos/checklist/baixa).
 * FINALIZADO / CANCELADO: reservados às ECOL-17/18.
 */
export const StatusPedido = {
  CONFIRMADO: 'CONFIRMADO',
  FINALIZADO: 'FINALIZADO',
  CANCELADO: 'CANCELADO',
} as const;
export type StatusPedido = (typeof StatusPedido)[keyof typeof StatusPedido];

/** ECOL-17 — §11.4 modelos de pagamento. */
export const ModeloPagamentoPedido = {
  PIX_AVISTA: 'PIX_AVISTA',
  CARTAO_CREDITO: 'CARTAO_CREDITO',
  CARTAO_DEBITO: 'CARTAO_DEBITO',
  SINAL_RESTANTE_ENTREGA: 'SINAL_RESTANTE_ENTREGA',
  SINAL_BOLETOS: 'SINAL_BOLETOS',
  PERSONALIZADO: 'PERSONALIZADO',
} as const;
export type ModeloPagamentoPedido =
  (typeof ModeloPagamentoPedido)[keyof typeof ModeloPagamentoPedido];

export const StatusPagamentoPedido = {
  PREVISTO: 'PREVISTO',
  RECEBIDO: 'RECEBIDO',
} as const;
export type StatusPagamentoPedido =
  (typeof StatusPagamentoPedido)[keyof typeof StatusPagamentoPedido];

export const StatusComissaoPedido = {
  A_PAGAR: 'A_PAGAR',
  PAGA: 'PAGA',
  CANCELADA: 'CANCELADA',
} as const;
export type StatusComissaoPedido =
  (typeof StatusComissaoPedido)[keyof typeof StatusComissaoPedido];

export const TipoChecklistPedido = {
  PAGAMENTO_RECEBIDO: 'PAGAMENTO_RECEBIDO',
  ITENS_COMPRADOS: 'ITENS_COMPRADOS',
  MATERIAL_SEPARADO: 'MATERIAL_SEPARADO',
  NF_EMITIDA: 'NF_EMITIDA',
  ENTREGUE: 'ENTREGUE',
  COMISSAO_PAGA: 'COMISSAO_PAGA',
} as const;
export type TipoChecklistPedido =
  (typeof TipoChecklistPedido)[keyof typeof TipoChecklistPedido];

export const TipoMovimentacaoEstoque = {
  ENTRADA: 'ENTRADA',
  BAIXA: 'BAIXA',
  AJUSTE: 'AJUSTE',
} as const;
export type TipoMovimentacaoEstoque =
  (typeof TipoMovimentacaoEstoque)[keyof typeof TipoMovimentacaoEstoque];

/** Motivos da seção 7.9 — usados só com a flag ECOLUME (ECOL-06). */
export const MotivoAjusteEstoque = {
  ESTOQUE_INICIAL: 'ESTOQUE_INICIAL',
  INVENTARIO: 'INVENTARIO',
  AVARIA: 'AVARIA',
  PERDA: 'PERDA',
  DEVOLUCAO: 'DEVOLUCAO',
  OUTRO: 'OUTRO',
} as const;
export type MotivoAjusteEstoque = (typeof MotivoAjusteEstoque)[keyof typeof MotivoAjusteEstoque];

export const MOTIVO_AJUSTE_ESTOQUE_ROTULOS: Record<MotivoAjusteEstoque, string> = {
  ESTOQUE_INICIAL: 'Estoque inicial',
  INVENTARIO: 'Inventário',
  AVARIA: 'Avaria',
  PERDA: 'Perda',
  DEVOLUCAO: 'Devolução',
  OUTRO: 'Outro',
};

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
