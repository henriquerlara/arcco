import {
  DirecaoMensagem,
  ModoAtendimento,
  PrioridadeOportunidade,
  StatusConexaoWhatsApp,
  StatusConversa,
  StatusObra,
  TipoAtividade,
  TipoCampoPersonalizado,
  TipoContato,
  TipoEtapaFunil,
  IntencaoChatbot,
  EntidadeCampoPersonalizado,
} from '@arcco/contratos';

export const ROTULO_TIPO_CONTATO: Record<TipoContato, string> = {
  PROPRIETARIO_OBRA: 'Proprietário da obra',
  ARQUITETO: 'Arquiteto',
  ENGENHEIRO: 'Engenheiro',
  CONSTRUTORA: 'Construtora',
  INSTALADOR: 'Instalador',
  COMPRADOR: 'Comprador',
  EMPRESA: 'Empresa',
  OUTRO: 'Outro',
};

export const ROTULO_STATUS_OBRA: Record<StatusObra, string> = {
  PLANEJAMENTO: 'Planejamento',
  EM_ANDAMENTO: 'Em andamento',
  PAUSADA: 'Pausada',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

export const ROTULO_PRIORIDADE: Record<PrioridadeOportunidade, string> = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
};

export const ROTULO_TIPO_ATIVIDADE: Record<TipoAtividade, string> = {
  LIGACAO: 'Ligação',
  MENSAGEM: 'Mensagem',
  REUNIAO: 'Reunião',
  ENVIAR_ORCAMENTO: 'Enviar orçamento',
  REVISAR_ORCAMENTO: 'Revisar orçamento',
  FOLLOW_UP: 'Follow-up',
  TAREFA: 'Tarefa',
};

export const ROTULO_STATUS_CONVERSA: Record<StatusConversa, string> = {
  BOT_ATENDENDO: 'Bot atendendo',
  AGUARDANDO_HUMANO: 'Aguardando humano',
  EM_ATENDIMENTO: 'Em atendimento',
  AGUARDANDO_CLIENTE: 'Aguardando cliente',
  FINALIZADA: 'Finalizada',
};

export const ROTULO_MODO_ATENDIMENTO: Record<ModoAtendimento, string> = {
  BOT: 'Bot',
  HUMANO: 'Humano',
  PAUSADO: 'Pausado',
};

export const ROTULO_TIPO_ETAPA: Record<TipoEtapaFunil, string> = {
  ABERTA: 'Aberta',
  GANHA: 'Ganha',
  PERDIDA: 'Perdida',
};

export const ROTULO_TIPO_CAMPO: Record<TipoCampoPersonalizado, string> = {
  TEXTO: 'Texto',
  TEXTO_LONGO: 'Texto longo',
  NUMERO: 'Número',
  MOEDA: 'Moeda',
  DATA: 'Data',
  BOOLEANO: 'Sim/Não',
  SELECAO: 'Seleção',
  MULTISSELECAO: 'Multisseleção',
};

export const ROTULO_ENTIDADE_CAMPO: Record<EntidadeCampoPersonalizado, string> = {
  CONTATO: 'Contato',
  OBRA: 'Obra',
  OPORTUNIDADE: 'Oportunidade',
};

export const ROTULO_STATUS_WHATSAPP: Record<StatusConexaoWhatsApp, string> = {
  DESCONECTADO: 'Desconectado',
  CONECTANDO: 'Conectando',
  QR_CODE: 'Aguardando QR Code',
  CONECTADO: 'Conectado',
  ERRO: 'Erro',
};

export const ROTULO_DIRECAO: Record<DirecaoMensagem, string> = {
  RECEBIDA: 'Recebida',
  ENVIADA: 'Enviada',
};

export const ROTULO_INTENCAO: Record<IntencaoChatbot, string> = {
  NOVO_ORCAMENTO: 'Novo orçamento',
  NEGOCIAR_ORCAMENTO: 'Negociar orçamento',
  AJUSTAR_ORCAMENTO: 'Ajustar orçamento',
  DUVIDA: 'Dúvida',
  ACOMPANHAR_SOLICITACAO: 'Acompanhar solicitação',
  FINANCEIRO: 'Financeiro',
  ENTREGA: 'Entrega',
  POS_VENDA: 'Pós-venda',
  FALAR_COM_PESSOA: 'Falar com pessoa',
  OUTRO: 'Outro',
};

export function opcoesDe<T extends Record<string, string>>(
  mapa: T,
): { valor: string; rotulo: string }[] {
  return Object.entries(mapa).map(([valor, rotulo]) => ({ valor, rotulo }));
}
