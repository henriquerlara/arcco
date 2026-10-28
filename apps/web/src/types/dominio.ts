import type {
  ConfiguracoesEmpresa,
  PersonalizacaoComercial,
  DirecaoMensagem,
  EntidadeCampoPersonalizado,
  ModoAtendimento,
  PerfilUsuario,
  PrioridadeOportunidade,
  ProvedorWhatsApp,
  RamoProduto,
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
  /** Campo canÃ´nico da API. */
  deveTrocarSenha?: boolean;
  /** Alias legado usado em views/store. */
  precisaTrocarSenha?: boolean;
  ultimoAcessoEm?: string | null;
  criadoEm?: string;
  /** ECOL-26b: null = administrador (acesso total). */
  permissoesConcedidas?: string[] | null;
}

export interface Empresa {
  id: string;
  nome: string;
  nomeFantasia?: string | null;
  ramo?: RamoProduto;
  segmento: SegmentoEmpresa;
  telefone?: string | null;
  cidade?: string | null;
  estado?: string | null;
  logoArquivoId?: string | null;
  cnpj?: string | null;
  inscricaoEstadual?: string | null;
  enderecoFiscal?: EnderecoFiscal | null;
  onboardingConcluido?: boolean;
  /** Definido pelo backend a partir do JSON da empresa. Ausente equivale a PADRAO. */
  personalizacaoComercial?: PersonalizacaoComercial;
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
  codigoFornecedor?: string | null;
  fornecedorId?: string | null;
  /** ECOLUME (quando a flag estÃ¡ ativa) */
  descricaoComercial?: string | null;
  nomeFiscal?: string | null;
  codigoInterno?: string | null;
  ipi?: number | null;
  margem?: number | null;
  custoMedio?: number | null;
  ultimoPreco?: number | null;
  precoSugerido?: number | null;
  fornecedor?: { id: string; nome: string; aliquotaSt?: number | null } | null;
}

export interface Fornecedor {
  id: string;
  nome: string;
  nomeCurto?: string | null;
  cnpj: string;
  /** Presente sÃ³ com VER_CUSTOS. */
  aliquotaSt?: number;
  contatoNome?: string | null;
  telefone?: string | null;
  email?: string | null;
  observacoes?: string | null;
  ativo: boolean;
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
  motivo?: string | null;
  usuarioId?: string | null;
  criadoEm: string;
}

export interface ResumoEstoque {
  totalComControle: number;
  criticos: number;
  zerados: number;
  /** ECOLUME */
  produtosCadastrados?: number;
  abaixoMinimo?: number;
  aComprar?: number;
  sobEncomenda?: number;
}

export interface ProdutoEstoqueEcolume extends Produto {
  descricaoComercial?: string | null;
  nomeFiscal?: string | null;
  codigoInterno?: string | null;
  ean?: string | null;
  status: 'SOB_ENCOMENDA' | 'A_COMPRAR' | 'BAIXO' | 'OK';
  fornecedor?: {
    id: string;
    nome: string;
    nomeCurto?: string | null;
    aliquotaSt?: number | null;
  } | null;
  custoMedio?: number | null;
  ultimoPreco?: number | null;
  precoSugerido?: number | null;
  ipi?: number | null;
  margem?: number | null;
}

export interface GrupoListaCompra {
  fornecedorId: string | null;
  fornecedorNome: string;
  fornecedorCnpj: string | null;
  totalFaltante: number;
  itens: Array<{
    produtoId: string;
    descricaoComercial: string;
    codigoInterno: string | null;
    codigoFornecedor: string | null;
    unidade: string;
    saldo: number;
    quantidadeFaltante: number;
  }>;
}

export interface MovimentacaoEstoqueGlobal extends MovimentacaoEstoque {
  produto?: {
    id: string;
    nome: string;
    descricaoComercial?: string | null;
    codigoInterno?: string | null;
    unidade: string;
  };
}

export interface NotaFiscal {
  id: string;
  empresaId: string;
  orcamentoId: string;
  oportunidadeId: string;
  /** ECOL-24 */
  pedidoId?: string | null;
  status: StatusNotaFiscal;
  chaveAcesso?: string | null;
  numero?: string | null;
  serie?: string | null;
  protocolo?: string | null;
  mensagemErro?: string | null;
  respostaFocus?: { _mock?: boolean } | null;
  /** ECOL-28b — CC-e / e-mail (só nas rotas que incluem eventos). */
  eventos?: Array<{
    id: string;
    tipo: string;
    status: string;
    numeroSequencia: number | null;
    texto: string | null;
    emails: string[];
    mock: boolean;
    criadoEm: string;
  }>;
  idExternoFocus?: string | null;
  refFocus?: string | null;
  arquivoXmlId?: string | null;
  arquivoPdfId?: string | null;
  autorizadoEm?: string | null;
  criadoEm: string;
  atualizadoEm?: string;
}

export type BaseCustoItemOrcamento = 'ULTIMO_PRECO' | 'CUSTO_MEDIO' | 'INFORMADO';
export type TipoDescontoOrcamento = 'VALOR' | 'PERCENTUAL';

export interface ItemOrcamento {
  id: string;
  produtoId?: string | null;
  nome: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  desconto: number;
  totalLinha: number;
  ordem?: number;
  produto?: Produto | null;
  /** ECOL-13 */
  codigoInterno?: string | null;
  baseCusto?: BaseCustoItemOrcamento | null;
  custoBase?: number | null;
  ipiPercentual?: number | null;
  stPercentual?: number | null;
  margem?: number | null;
  precoManual?: boolean;
  margemEfetiva?: number | null;
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
  descontoTipo?: TipoDescontoOrcamento;
  descontoPercentual?: number | null;
  subtotal: number;
  total: number;
  validadeEm?: string | null;
  arquivoId?: string | null;
  enviadoEm?: string | null;
  aceitoEm?: string | null;
  convertidoEm?: string | null;
  /** ECOL-12 */
  orcamentoOrigemId?: string | null;
  orcamentoOrigem?: { id: string; numero: string } | null;
  itens: ItemOrcamento[];
  avisosEstoque?: AvisoEstoque[];
  criadoEm: string;
}

export interface Sessao {
  usuario: Usuario;
  empresa: Empresa;
  /** Lista resolvida no servidor. null significa empresa sem a personalizaÃ§Ã£o Ecolume. */
  permissoesComerciais?: string[] | null;
}

export type NaturezaPessoa = 'PF' | 'PJ';

export type TipoParceiro =
  | 'ARQUITETO_DESIGNER'
  | 'INSTALADOR_ELETRICISTA'
  | 'CONSTRUTORA';

export interface TelefoneExtraContato {
  numero: string;
  normalizado?: string | null;
}

export interface PessoaEmpresaContato {
  nome: string;
  cargo?: string | null;
  telefone?: string | null;
  email?: string | null;
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
  /** ECOLUME */
  natureza?: NaturezaPessoa | null;
  nomeFantasia?: string | null;
  inscricaoEstadual?: string | null;
  ieIsento?: boolean;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  telefonesExtras?: TelefoneExtraContato[];
  pessoasEmpresa?: PessoaEmpresaContato[];
  ehParceiro?: boolean;
  tipoParceiro?: TipoParceiro | null;
  rtPadrao?: number | null;
  chavePix?: string | null;
  banco?: string | null;
  agencia?: string | null;
  conta?: string | null;
  titularNome?: string | null;
  titularDocumento?: string | null;
  observacoesParceria?: string | null;
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
  /** ECOL-09b — ficha do cliente (ECOLUME). Campos financeiros podem vir ausentes sem permissão. */
  fichaCliente?: FichaCliente;
  /** ECOL-10b — parceiro (ECOLUME + VER_COMISSOES). */
  extratoComissoes?: ExtratoComissaoLinha[];
  negociosAbertos?: NegocioAbertoParceiro[];
  /** ECOL-10b — métricas na listagem de parceiros. */
  vendasIndicadas?: number;
  quantidadePedidos?: number;
  valorVendido?: number;
  comissaoAPagar?: number;
  comissaoPaga?: number;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface FichaCliente {
  resumo: {
    totalComprado?: number;
    quantidadePedidos?: number;
    ultimaCompraEm?: string | null;
    parceiroOrigem: { id: string; nome: string } | null;
  };
  historico: FichaNegocio[];
  anexos: FichaAnexo[];
}

export interface FichaNegocio {
  id: string;
  codigo: string;
  titulo: string;
  criadoEm: string;
  atualizadoEm: string;
  valorEstimado: number | null;
  etapa: { nome: string; chaveSistema: string | null };
  parceiro: { id: string; nome: string; ehParceiro: boolean } | null;
  orcamentos: Array<{
    id: string;
    numero: string;
    status: string;
    total: number;
    criadoEm: string;
  }>;
  pedidos: Array<{
    id: string;
    numero: string;
    status: string;
    total: number;
    criadoEm: string;
    finalizadoEm: string | null;
    checklist: Array<{ tipo: string; concluido: boolean; aplicavel: boolean }>;
  }>;
}

export interface FichaAnexo {
  id: string;
  nome: string;
  criadoEm: string;
  oportunidadeId: string;
  negocioCodigo: string | null;
  negocioTitulo: string | null;
}

export interface ExtratoComissaoLinha {
  pedidoId: string;
  pedidoNumero: string;
  clienteNome: string;
  data: string;
  valorVenda: number;
  rtPercentual: number;
  valorComissao: number;
  status: 'A_PAGAR' | 'PAGA' | 'CANCELADA';
}

export interface NegocioAbertoParceiro {
  id: string;
  codigo: string;
  titulo: string;
  clienteNome: string;
  etapa: string;
  criadoEm: string;
}

export interface ComissaoParceiroLinha {
  id: string;
  pedidoId: string;
  pedidoNumero: string;
  oportunidadeId: string;
  negocioCodigo: string;
  negocioTitulo: string;
  parceiroId: string;
  parceiroNome: string | null;
  clienteNome: string;
  data: string;
  valorVenda: number;
  rtPercentual?: number;
  valorComissao?: number;
  status: 'A_PAGAR' | 'PAGA' | 'CANCELADA';
  pagoEm: string | null;
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

export type OrigemNegocio = 'CLIENTE_DIRETO' | 'VIA_PARCEIRO';

export interface AnexoOportunidade {
  id: string;
  nome: string;
  tipoMime: string;
  tamanho: number;
  criadoEm: string;
  enviadoPorId?: string | null;
  autor?: { id: string; nome: string } | null;
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
  /** ECOL-11 */
  origemNegocio?: OrigemNegocio | null;
  parceiroId?: string | null;
  parceiro?: Contato | null;
  rtNegocio?: number | null;
  obraCep?: string | null;
  obraLogradouro?: string | null;
  obraNumero?: string | null;
  obraComplemento?: string | null;
  obraBairro?: string | null;
  obraCidade?: string | null;
  obraUf?: string | null;
  anexos?: AnexoOportunidade[];
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
  concluidaPorId?: string | null;
  resultadoConclusao?: string | null;
  responsavelId?: string | null;
  responsavel?: Usuario | null;
  oportunidadeId?: string | null;
  oportunidade?: Oportunidade | null;
  contatoId?: string | null;
  contato?: Contato | null;
  obraId?: string | null;
  obra?: Obra | null;
  pedidoId?: string | null;
  pedido?: { id: string; numero: string; status: string; oportunidadeId: string } | null;
  diaInteiro?: boolean;
  periodoDia?: string | null;
  local?: string | null;
  entregaCep?: string | null;
  entregaLogradouro?: string | null;
  entregaNumero?: string | null;
  entregaComplemento?: string | null;
  entregaBairro?: string | null;
  entregaCidade?: string | null;
  entregaUf?: string | null;
  contatoLocalNome?: string | null;
  contatoLocalTelefone?: string | null;
  conclusaoEntrega?: string | null;
  itensConferencia?: Array<{
    id: string;
    descricaoComercial: string;
    nomeFiscal: string;
    quantidade: number;
    unidade: string;
  }>;
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
  valor?: number;
  tipo?: TipoEtapaFunil;
  /** ECOL-23 â€” NEGOCIO (prÃ©) ou PEDIDO (pÃ³s). */
  tipoCard?: 'NEGOCIO' | 'PEDIDO';
  chave?: string;
  link?: string;
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
