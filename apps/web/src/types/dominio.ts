import type {
  ConfiguracoesEmpresa,
  DirecaoMensagem,
  EntidadeCampoPersonalizado,
  ModoAtendimento,
  PerfilUsuario,
  PrioridadeOportunidade,
  ProvedorWhatsApp,
  SegmentoEmpresa,
  StatusConexaoWhatsApp,
  StatusConversa,
  StatusMensagem,
  StatusObra,
  StatusOrcamento,
  StatusNotaFiscal,
  TipoAtividade,
  TipoCampoPersonalizado,
  TipoContato,
  TipoEtapaFunil,
  TipoMensagem,
  TipoMovimentacaoEstoque,
  IntencaoChatbot,
  EnderecoFiscal,
} from '@arcco/contratos';

export type { StatusOrcamento, StatusNotaFiscal, TipoMovimentacaoEstoque };

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  empresaId?: string;
  /** Campo canônico da API. */
  deveTrocarSenha?: boolean;
  /** Alias legado usado em views/store. */
  precisaTrocarSenha?: boolean;
  ultimoAcessoEm?: string | null;
  criadoEm?: string;
}

export interface Empresa {
  id: string;
  nome: string;
  nomeFantasia?: string | null;
  segmento: SegmentoEmpresa;
  telefone?: string | null;
  cidade?: string | null;
  estado?: string | null;
  logoArquivoId?: string | null;
  cnpj?: string | null;
  inscricaoEstadual?: string | null;
  enderecoFiscal?: EnderecoFiscal | null;
  onboardingConcluido?: boolean;
  configuracoes?: ConfiguracoesEmpresa;
}

export interface Produto {
  id: string;
  sku?: string | null;
  nome: string;
  descricao?: string | null;
  unidade: string;
  ncm?: string | null;
  precoVenda: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  controlaEstoque: boolean;
  ativo: boolean;
  critico?: boolean;
  zerado?: boolean;
}

export interface MovimentacaoEstoque {
  id: string;
  produtoId: string;
  tipo: TipoMovimentacaoEstoque;
  quantidade: number;
  saldoApos: number;
  orcamentoId?: string | null;
  oportunidadeId?: string | null;
  observacao?: string | null;
  usuarioId?: string | null;
  criadoEm: string;
}

export interface ResumoEstoque {
  totalComControle: number;
  criticos: number;
  zerados: number;
}

export interface NotaFiscal {
  id: string;
  empresaId: string;
  orcamentoId: string;
  oportunidadeId: string;
  status: StatusNotaFiscal;
  chaveAcesso?: string | null;
  numero?: string | null;
  serie?: string | null;
  protocolo?: string | null;
  mensagemErro?: string | null;
  respostaFocus?: { _mock?: boolean } | null;
  idExternoFocus?: string | null;
  refFocus?: string | null;
  arquivoXmlId?: string | null;
  arquivoPdfId?: string | null;
  autorizadoEm?: string | null;
  criadoEm: string;
  atualizadoEm?: string;
}

export interface ItemOrcamento {
  id: string;
  produtoId?: string | null;
  nome: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  desconto: number;
  totalLinha: number;
  ordem: number;
  produto?: Produto | null;
}

export interface AvisoEstoque {
  produtoId: string;
  nome: string;
  solicitado: number;
  disponivel: number;
}

export interface Orcamento {
  id: string;
  oportunidadeId: string;
  numero: string;
  versao: number;
  status: StatusOrcamento;
  vigente: boolean;
  observacoes?: string | null;
  descontoValor: number;
  subtotal: number;
  total: number;
  validadeEm?: string | null;
  arquivoId?: string | null;
  enviadoEm?: string | null;
  aceitoEm?: string | null;
  convertidoEm?: string | null;
  itens: ItemOrcamento[];
  avisosEstoque?: AvisoEstoque[];
  criadoEm: string;
}

export interface Sessao {
  usuario: Usuario;
  empresa: Empresa;
}

export interface Contato {
  id: string;
  nome: string;
  telefone: string;
  email?: string | null;
  tipo: TipoContato;
  empresaNome?: string | null;
  documento?: string | null;
  origem?: string | null;
  observacoes?: string | null;
  responsavelId?: string | null;
  responsavel?: Usuario | null;
  dadosPersonalizados?: Record<string, unknown>;
  totalOportunidades?: number;
  totalObras?: number;
  oportunidades?: Array<{
    id: string;
    codigo: string;
    titulo: string;
    etapaId: string;
    valorEstimado?: number | string | null;
  }>;
  obras?: Array<{
    id: string;
    papel: string;
    obra: Obra;
  }>;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface Obra {
  id: string;
  nome: string;
  identificacao?: string | null;
  tipo?: string | null;
  status: StatusObra;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  previsao?: string | null;
  observacoes?: string | null;
  dadosPersonalizados?: Record<string, unknown>;
  contatos?: ContatoVinculadoObra[];
  totalOportunidades?: number;
  criadoEm?: string;
}

export interface ContatoVinculadoObra {
  id: string;
  papel: string;
  contato: Contato;
}

export interface Categoria {
  id: string;
  nome: string;
  descricao?: string | null;
  ordem: number;
  ativo: boolean;
}

export interface EtapaFunil {
  id: string;
  nome: string;
  ordem: number;
  tipo: TipoEtapaFunil;
  ativo: boolean;
  chaveSistema?: string | null;
  totalOportunidades?: number;
  valorTotal?: number;
}

export interface Oportunidade {
  id: string;
  codigo: string;
  titulo: string;
  contatoId: string;
  contato?: Contato | null;
  obraId?: string | null;
  obra?: Obra | null;
  categoriaId?: string | null;
  categoria?: Categoria | null;
  etapaId: string;
  etapa?: EtapaFunil | null;
  responsavelId?: string | null;
  responsavel?: Usuario | null;
  descricao?: string | null;
  origem?: string | null;
  prioridade: PrioridadeOportunidade;
  valorEstimado?: number | null;
  previsaoFechamento?: string | null;
  proximaAcao?: string | null;
  dataProximaAcao?: string | null;
  codigoOrcamento?: string | null;
  motivoPerda?: string | null;
  dadosPersonalizados?: Record<string, unknown>;
  atividades?: Atividade[];
  historicoEtapas?: HistoricoEtapaOportunidade[];
  eventos?: EventoOportunidade[];
  orcamentos?: Orcamento[];
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface EventoOportunidade {
  id: string;
  tipo: string;
  titulo: string;
  descricao?: string | null;
  origem: string;
  dados?: Record<string, unknown>;
  usuarioId?: string | null;
  criadoEm: string;
}

export type OrigemHistoricoEtapa =
  | 'CRIACAO'
  | 'MANUAL'
  | 'CHATBOT'
  | 'ORCAMENTO_WHATSAPP';

export interface HistoricoEtapaOportunidade {
  id: string;
  etapaId: string;
  etapaNome: string;
  etapaAnteriorId?: string | null;
  etapaAnteriorNome?: string | null;
  origem: OrigemHistoricoEtapa;
  usuarioId?: string | null;
  criadoEm: string;
}

export interface Atividade {
  id: string;
  tipo: TipoAtividade;
  titulo: string;
  descricao?: string | null;
  vencimento: string;
  concluida: boolean;
  concluidaEm?: string | null;
  responsavelId?: string | null;
  responsavel?: Usuario | null;
  oportunidadeId?: string | null;
  oportunidade?: Oportunidade | null;
  contatoId?: string | null;
  contato?: Contato | null;
  obraId?: string | null;
  obra?: Obra | null;
  criadoEm?: string;
}

export interface CampoPersonalizado {
  id: string;
  entidade: EntidadeCampoPersonalizado;
  chave: string;
  rotulo: string;
  descricao?: string | null;
  tipo: TipoCampoPersonalizado;
  obrigatorio: boolean;
  opcoes?: string[] | null;
  ordem: number;
  ativo: boolean;
  usarNoChatbot: boolean;
  textoPergunta?: string | null;
  mostrarNoResumo: boolean;
  permitirFiltro: boolean;
}

export interface Conversa {
  id: string;
  contatoId?: string | null;
  contato?: Contato | null;
  telefone: string;
  nomeExibicao?: string | null;
  status: StatusConversa;
  modo: ModoAtendimento;
  intencaoAtual?: string | null;
  ultimaMensagem?: string | null;
  ultimaMensagemEm?: string | null;
  naoLidas?: number;
  responsavelId?: string | null;
  responsavel?: Usuario | null;
  intencao?: IntencaoChatbot | null;
  oportunidadeId?: string | null;
  oportunidade?: Oportunidade | null;
  estadoBot?: { resumo?: string; dadosColetados?: Record<string, unknown> } | null;
  ultimaMensagemPreview?: string | null;
  conexao?: {
    id: string;
    provedor: string;
    modoConexao?: string | null;
    numero?: string | null;
    isTestConnection?: boolean;
  } | null;
  criadoEm?: string;
}

export interface Mensagem {
  id: string;
  conversaId: string;
  direcao: DirecaoMensagem;
  tipo: TipoMensagem;
  conteudo: string;
  status: StatusMensagem;
  arquivoId?: string | null;
  remetente?: string | null;
  autorUsuarioId?: string | null;
  autorNome?: string | null;
  /** @deprecated Preferir remetente === 'bot' */
  deBot?: boolean;
  criadoEm: string;
}

export interface ContextoComercial {
  contato?: Contato | null;
  obra?: Obra | null;
  oportunidade?: Oportunidade | null;
  resumo?: string | null;
  pontosChave?: string[];
  dadosColetados?: Record<string, unknown>;
}

export interface MetricasFunilPonto {
  etapaId: string;
  nome: string;
  tipo: TipoEtapaFunil;
  quantidade: number;
  valor: number;
}

export interface MetricasDashboard {
  periodo: { de: string; ate: string };
  oportunidades: {
    abertas: number;
    valorPipeline: number;
    novasNoPeriodo: number;
    ganhasNoPeriodo: number;
    valorGanhoNoPeriodo: number;
    perdidasNoPeriodo: number;
    taxaConversao: number;
    ticketMedioGanho?: number;
    paradas?: number;
  };
  contatos: { novosNoPeriodo: number };
  atividades: { pendentes: number; atrasadas: number };
  conversas: { aguardandoHumano: number; emAtendimento: number; botAtendendo: number };
  estoque?: { comControle: number; criticos: number; zerados: number };
  funil: MetricasFunilPonto[];
}

export interface PontoFunil {
  etapa: string;
  total: number;
  valor: number;
  tipo?: TipoEtapaFunil;
}

export interface AlertaDashboard {
  id: string;
  tipo: 'atividade_atrasada' | 'conversa_aguardando' | 'oportunidade_parada' | 'estoque_critico' | 'info';
  titulo: string;
  descricao: string;
  link?: string | null;
  gravidade: 'info' | 'alerta' | 'erro';
}

export interface StatusWhatsApp {
  provedor: string;
  status: StatusConexaoWhatsApp;
  numero?: string | null;
  qrCode?: string | null;
  atualizadoEm?: string | null;
}

export interface ConexaoWhatsApp {
  id: string;
  empresaId?: string;
  nomeInstancia: string;
  provedor: ProvedorWhatsApp;
  status: StatusConexaoWhatsApp;
  numero?: string | null;
  qrCode?: string | null;
  conectadoEm?: string | null;
  criadoEm?: string;
  atualizadoEm?: string;
}
