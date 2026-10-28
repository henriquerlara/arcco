import { z } from 'zod';
import {
  MotivoAjusteEstoque,
  NaturezaPessoa,
  OrigemNegocio,
  PrioridadeOportunidade,
  RT_PADRAO_PARCEIRO,
  StatusObra,
  TipoAtividade,
  TipoContato,
  TipoEtapaFunil,
  TipoParceiro,
  EntidadeCampoPersonalizado,
  TipoCampoPersonalizado,
} from '../enums/index.js';
import { cnpjValido } from '../cnpj.js';
import { cpfValido, digitosCpf } from '../cpf.js';

export const paginacaoQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  /** Até 500 para intervalo de calendário (ECOL-22); listas curtas seguem default 20. */
  porPagina: z.coerce.number().int().min(1).max(500).default(20),
  busca: z.string().optional(),
});

const telefoneExtraSchema = z.object({
  numero: z.string().min(8, 'Informe o telefone'),
});

const pessoaEmpresaSchema = z.object({
  nome: z.string().min(2, 'Informe o nome'),
  cargo: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
});

function validarDocumentoOpcional(valor: string | null | undefined): boolean {
  if (valor == null || String(valor).trim() === '') return true;
  const digitos = digitosCpf(String(valor));
  if (digitos.length === 11) return cpfValido(digitos);
  if (digitos.length === 14) return cnpjValido(digitos);
  return false;
}

const contatoCamposBase = {
  nome: z.string().min(2, 'Informe o nome'),
  telefone: z.string().min(8, 'Informe o telefone'),
  email: z.string().email().optional().or(z.literal('')),
  tipo: z.nativeEnum(TipoContato).default(TipoContato.OUTRO),
  empresaNome: z.string().optional(),
  documento: z.string().optional().nullable(),
  origem: z.string().optional(),
  observacoes: z.string().optional(),
  responsavelId: z.string().uuid().optional().nullable(),
  dadosPersonalizados: z.record(z.unknown()).optional().default({}),
  /** ECOLUME — ignorados sem a flag. */
  natureza: z.nativeEnum(NaturezaPessoa).optional().nullable(),
  nomeFantasia: z.string().optional().nullable(),
  inscricaoEstadual: z.string().optional().nullable(),
  ieIsento: z.boolean().optional(),
  cep: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().max(2).optional().nullable(),
  telefonesExtras: z.array(telefoneExtraSchema).optional(),
  pessoasEmpresa: z.array(pessoaEmpresaSchema).optional(),
  /** ECOL-10a — só com flag; dados bancários opcionais. */
  ehParceiro: z.boolean().optional(),
  tipoParceiro: z.nativeEnum(TipoParceiro).optional().nullable(),
  rtPadrao: z.coerce.number().min(0).max(100).optional().nullable(),
  chavePix: z.string().optional().nullable(),
  banco: z.string().optional().nullable(),
  agencia: z.string().optional().nullable(),
  conta: z.string().optional().nullable(),
  titularNome: z.string().optional().nullable(),
  titularDocumento: z.string().optional().nullable(),
  observacoesParceria: z.string().optional().nullable(),
};

function refinarParceiro(
  dados: {
    documento?: string | null;
    titularDocumento?: string | null;
    ehParceiro?: boolean;
    tipoParceiro?: TipoParceiro | null;
    rtPadrao?: number | null;
  },
  ctx: z.RefinementCtx,
  parcial: boolean,
) {
  if (dados.documento !== undefined && !validarDocumentoOpcional(dados.documento)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['documento'],
      message: 'CPF ou CNPJ invalido',
    });
  }
  if (dados.titularDocumento !== undefined && !validarDocumentoOpcional(dados.titularDocumento)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['titularDocumento'],
      message: 'CPF ou CNPJ do titular invalido',
    });
  }
  const marcando = dados.ehParceiro === true;
  if (marcando && !dados.tipoParceiro) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tipoParceiro'],
      message: 'Informe o tipo de parceiro',
    });
  }
  if (dados.rtPadrao != null && (Number.isNaN(dados.rtPadrao) || dados.rtPadrao < 0 || dados.rtPadrao > 100)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rtPadrao'],
      message: 'RT deve ser um percentual entre 0 e 100',
    });
  }
  if (!parcial && marcando && (dados.rtPadrao === undefined || dados.rtPadrao === null)) {
    // aceito: serviço aplica RT_PADRAO_PARCEIRO
    void RT_PADRAO_PARCEIRO;
  }
}

export const criarContatoSchema = z.object(contatoCamposBase).superRefine((dados, ctx) => {
  refinarParceiro(dados, ctx, false);
});

export const atualizarContatoSchema = z
  .object(contatoCamposBase)
  .partial()
  .superRefine((dados, ctx) => {
    refinarParceiro(dados, ctx, true);
  });

export const criarObraSchema = z.object({
  nome: z.string().trim().optional(),
  identificacao: z.string().optional(),
  tipo: z.string().optional(),
  status: z.nativeEnum(StatusObra).default(StatusObra.PLANEJAMENTO),
  endereco: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  previsao: z.coerce.date().optional().nullable(),
  observacoes: z.string().optional(),
  dadosPersonalizados: z.record(z.unknown()).optional().default({}),
});

export const atualizarObraSchema = criarObraSchema.partial();

export const vincularContatoObraSchema = z.object({
  contatoId: z.string().uuid(),
  papel: z.string().min(1, 'Informe o papel'),
});

export const criarCategoriaSchema = z.object({
  nome: z.string().min(2),
  descricao: z.string().optional(),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional().default(true),
});

export const atualizarCategoriaSchema = criarCategoriaSchema.partial();

export const criarEtapaFunilSchema = z.object({
  nome: z.string().min(2),
  ordem: z.number().int(),
  tipo: z.nativeEnum(TipoEtapaFunil).default(TipoEtapaFunil.ABERTA),
  ativo: z.boolean().optional().default(true),
});

export const atualizarEtapaFunilSchema = criarEtapaFunilSchema.partial();

export const reordenarEtapasSchema = z.object({
  etapas: z.array(
    z.object({
      id: z.string().uuid(),
      ordem: z.number().int(),
    }),
  ),
});

export const excluirEtapaSchema = z.object({
  etapaDestinoId: z.string().uuid(),
});

const clienteMinimoSchema = z.object({
  nome: z.string().min(2, 'Informe o nome'),
  telefone: z.string().min(8, 'Informe o telefone'),
  natureza: z.nativeEnum(NaturezaPessoa).optional(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
});

const oportunidadeCamposBase = {
  titulo: z.string().trim().min(2).optional(),
  contatoId: z.string().uuid().optional(),
  clienteMinimo: clienteMinimoSchema.optional(),
  obraId: z.string().uuid().optional().nullable(),
  categoriaId: z.string().uuid().optional().nullable(),
  etapaId: z.string().uuid().optional(),
  responsavelId: z.string().uuid().optional().nullable(),
  descricao: z.string().optional(),
  origem: z.string().optional(),
  prioridade: z.nativeEnum(PrioridadeOportunidade).default(PrioridadeOportunidade.MEDIA),
  valorEstimado: z.number().optional().nullable(),
  previsaoFechamento: z.coerce.date().optional().nullable(),
  proximaAcao: z.string().optional().nullable(),
  dataProximaAcao: z.coerce.date().optional().nullable(),
  codigoOrcamento: z.string().optional().nullable(),
  dadosPersonalizados: z.record(z.unknown()).optional().default({}),
  /** ECOL-11 */
  origemNegocio: z.nativeEnum(OrigemNegocio).optional().nullable(),
  parceiroId: z.string().uuid().optional().nullable(),
  rtNegocio: z.coerce.number().min(0).max(100).optional().nullable(),
  obraCep: z.string().optional().nullable(),
  obraLogradouro: z.string().optional().nullable(),
  obraNumero: z.string().optional().nullable(),
  obraComplemento: z.string().optional().nullable(),
  obraBairro: z.string().optional().nullable(),
  obraCidade: z.string().optional().nullable(),
  obraUf: z.string().max(2).optional().nullable(),
  arquivoIds: z.array(z.string().uuid()).optional(),
};

export const criarOportunidadeSchema = z.object(oportunidadeCamposBase).superRefine((dados, ctx) => {
  if (!dados.contatoId && !dados.clienteMinimo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contatoId'],
      message: 'Informe o cliente',
    });
  }
});

export const atualizarOportunidadeSchema = z
  .object(oportunidadeCamposBase)
  .partial()
  .extend({
    motivoPerda: z.string().optional().nullable(),
  });

export const moverOportunidadeSchema = z.object({
  etapaId: z.string().uuid(),
  motivoPerda: z.string().optional(),
  /** ECOL-19 — código da lista padrão; OUTRO exige motivoPerda descritivo. */
  codigoMotivoPerda: z
    .enum(['PRECO', 'PRAZO', 'CONCORRENTE', 'DESISTIU_OBRA', 'SEM_RESPOSTA', 'OUTRO'])
    .optional(),
});

/** ECOL-19 — mover card de pedido entre colunas pós-venda. */
export const moverPedidoKanbanSchema = z.object({
  faseKanban: z.enum([
    'PEDIDO_CONFIRMADO',
    'EM_SEPARACAO',
    'PRONTO_ENTREGA',
    'ENTREGUE',
  ]),
});

export const buscarKanbanSchema = z.object({
  q: z.string().trim().min(1).max(200),
});

export const enviarOrcamentoSchema = z.object({
  texto: z.string().min(1, 'Informe o texto do orçamento'),
  orcamentoId: z.string().uuid().optional(),
  valorEstimado: z.number().nonnegative().optional(),
  arquivoId: z.string().uuid().optional().nullable(),
});

export const itemOrcamentoInputSchema = z.object({
  produtoId: z.string().uuid().optional().nullable(),
  nome: z.string().min(1),
  unidade: z.string().min(1).default('un'),
  quantidade: z.number().positive(),
  precoUnitario: z.number().nonnegative().optional(),
  desconto: z.number().nonnegative().default(0),
  /** ECOL-13 — snapshot / linha. */
  codigoInterno: z.string().optional().nullable(),
  baseCusto: z.enum(['ULTIMO_PRECO', 'CUSTO_MEDIO', 'INFORMADO']).optional().nullable(),
  custoBase: z.number().nonnegative().optional().nullable(),
  ipiPercentual: z.number().nonnegative().optional().nullable(),
  stPercentual: z.number().nonnegative().optional().nullable(),
  margem: z.number().positive().optional().nullable(),
  precoManual: z.boolean().optional(),
  /**
   * ECOL-15 — se true e sem produtoId, cria Produto (saldo 0, último preço = custo)
   * na mesma transação do orçamento. Sem movimento de estoque.
   */
  salvarNoCadastro: z.boolean().optional(),
  /** Obrigatório quando salvarNoCadastro=true. */
  fornecedorId: z.string().uuid().optional().nullable(),
});

export const criarProdutoSchema = z.object({
  sku: z.string().optional().nullable(),
  nome: z.string().min(2),
  descricao: z.string().optional().nullable(),
  unidade: z.string().min(1).default('un'),
  ncm: z
    .string()
    .regex(/^\d{8}$/, 'NCM deve ter 8 dígitos')
    .optional()
    .nullable(),
  precoVenda: z.number().nonnegative().default(0),
  nomeFiscal: z.string().optional().nullable(),
  descricaoComercial: z.string().optional().nullable(),
  codigoFornecedor: z.string().optional().nullable(),
  ean: z.string().optional().nullable(),
  cest: z.string().optional().nullable(),
  origemFiscal: z.string().optional().nullable(),
  /** Só na criação — vira a primeira movimentação ENTRADA. */
  saldoInicial: z.number().nonnegative().default(0),
  estoqueMinimo: z.number().nonnegative().default(0),
  controlaEstoque: z.boolean().default(true),
  ativo: z.boolean().default(true),
});

export const atualizarProdutoSchema = z.object({
  sku: z.string().optional().nullable(),
  nome: z.string().min(2).optional(),
  descricao: z.string().optional().nullable(),
  unidade: z.string().min(1).optional(),
  ncm: z
    .string()
    .regex(/^\d{8}$/, 'NCM deve ter 8 dígitos')
    .optional()
    .nullable(),
  precoVenda: z.number().nonnegative().optional(),
  nomeFiscal: z.string().optional().nullable(),
  descricaoComercial: z.string().optional().nullable(),
  codigoFornecedor: z.string().optional().nullable(),
  ean: z.string().optional().nullable(),
  cest: z.string().optional().nullable(),
  origemFiscal: z.string().optional().nullable(),
  estoqueMinimo: z.number().nonnegative().optional(),
  controlaEstoque: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

export const entradaEstoqueSchema = z.object({
  quantidade: z.number().positive(),
  observacao: z.string().optional(),
  /** Custo unitário da entrada. Só a empresa com a flag aplica na média (ECOL-05). */
  precoUnitarioCusto: z.number().nonnegative().optional(),
  /**
   * Custo de referência do saldo já existente quando a média ainda é nula e o saldo é positivo.
   * Obrigatório nesse caso na empresa ECOLUME; não inventa o custo das unidades antigas.
   */
  custoReferenciaSaldo: z.number().nonnegative().optional(),
});

/** Ajuste: saldo final e/ou diferença. Com a flag, motivo tipado é obrigatório no serviço. */
export const ajusteEstoqueSchema = z
  .object({
    saldoContado: z.number().optional(),
    diferenca: z.number().optional(),
    /** Saldo lido na tela. Obrigatório com saldoContado na empresa ECOLUME. */
    saldoAnteriorEsperado: z.number().optional(),
    motivo: z
      .enum([
        MotivoAjusteEstoque.ESTOQUE_INICIAL,
        MotivoAjusteEstoque.INVENTARIO,
        MotivoAjusteEstoque.AVARIA,
        MotivoAjusteEstoque.PERDA,
        MotivoAjusteEstoque.DEVOLUCAO,
        MotivoAjusteEstoque.OUTRO,
      ])
      .optional(),
    observacao: z.string().optional(),
    precoUnitarioCusto: z.number().nonnegative().optional(),
    custoReferenciaSaldo: z.number().nonnegative().optional(),
  })
  .superRefine((valor, ctx) => {
    if (valor.saldoContado === undefined && valor.diferenca === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o saldo final ou a diferenca',
        path: ['saldoContado'],
      });
    }
  });

export const criarOrcamentoSchema = z.object({
  oportunidadeId: z.string().uuid(),
  observacoes: z.string().optional().nullable(),
  descontoValor: z.number().nonnegative().default(0),
  descontoTipo: z.enum(['VALOR', 'PERCENTUAL']).default('VALOR'),
  descontoPercentual: z.number().nonnegative().max(100).optional().nullable(),
  validadeEm: z.coerce.date().optional().nullable(),
  /** Vazio permitido (rascunho em branco / ECOL-12). */
  itens: z.array(itemOrcamentoInputSchema).default([]),
});

export const atualizarOrcamentoSchema = z.object({
  observacoes: z.string().optional().nullable(),
  descontoValor: z.number().nonnegative().optional(),
  descontoTipo: z.enum(['VALOR', 'PERCENTUAL']).optional(),
  descontoPercentual: z.number().nonnegative().max(100).optional().nullable(),
  validadeEm: z.coerce.date().optional().nullable(),
  itens: z.array(itemOrcamentoInputSchema).optional(),
});

export const enviarOrcamentoEstruturadoSchema = z.object({
  texto: z.string().min(1, 'Informe o texto do orçamento'),
});

const camposEntregaAtividade = {
  pedidoId: z.string().uuid().optional().nullable(),
  diaInteiro: z.boolean().optional(),
  periodoDia: z.enum(['MANHA', 'TARDE']).optional().nullable(),
  local: z.string().max(500).optional().nullable(),
  entregaCep: z.string().max(16).optional().nullable(),
  entregaLogradouro: z.string().max(200).optional().nullable(),
  entregaNumero: z.string().max(40).optional().nullable(),
  entregaComplemento: z.string().max(120).optional().nullable(),
  entregaBairro: z.string().max(120).optional().nullable(),
  entregaCidade: z.string().max(120).optional().nullable(),
  entregaUf: z.string().max(2).optional().nullable(),
  contatoLocalNome: z.string().max(120).optional().nullable(),
  contatoLocalTelefone: z.string().max(40).optional().nullable(),
};

export const criarAtividadeSchema = z
  .object({
    oportunidadeId: z.string().uuid().optional().nullable(),
    contatoId: z.string().uuid().optional().nullable(),
    obraId: z.string().uuid().optional().nullable(),
    responsavelId: z.string().uuid().optional(),
    tipo: z.nativeEnum(TipoAtividade),
    titulo: z.string().min(2),
    descricao: z.string().optional(),
    vencimento: z.coerce.date(),
    ...camposEntregaAtividade,
  })
  .superRefine((d, ctx) => {
    if (d.tipo === 'ENTREGA') {
      if (!d.pedidoId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Entrega exige pedido',
          path: ['pedidoId'],
        });
      }
      return;
    }
    if (!d.oportunidadeId && !d.contatoId && !d.obraId && !d.pedidoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Relacione a atividade a uma oportunidade, contato, obra ou pedido',
      });
    }
  });

export const atualizarAtividadeSchema = z.object({
  tipo: z.nativeEnum(TipoAtividade).optional(),
  titulo: z.string().min(2).optional(),
  descricao: z.string().optional().nullable(),
  vencimento: z.coerce.date().optional(),
  responsavelId: z.string().uuid().optional(),
  oportunidadeId: z.string().uuid().optional().nullable(),
  contatoId: z.string().uuid().optional().nullable(),
  obraId: z.string().uuid().optional().nullable(),
  concluida: z.boolean().optional(),
  ...camposEntregaAtividade,
});

/** ECOL-20 — concluir entrega parcial ou final. */
export const concluirEntregaSchema = z.object({
  final: z.boolean(),
});

/** ECOL-21 — concluir follow-up com resultado textual. */
export const concluirFollowUpSchema = z.object({
  resultado: z.string().trim().min(2).max(2000),
});

/** ECOL-24 — emitir NF-e a partir do pedido (parcial/total). */
export const emitirNfPedidoItemSchema = z.object({
  itemPedidoId: z.string().uuid(),
  quantidade: z.number().positive(),
  /** Descrição só nesta NF; não altera produto/pedido. */
  descricao: z.string().trim().min(1).max(120).optional(),
  /** Itens avulsos: dados fiscais só nesta NF (não cria produto). */
  ncm: z.string().trim().min(8).max(10).optional(),
  cest: z.string().trim().max(10).optional().nullable(),
  origemFiscal: z.string().trim().max(1).optional(),
});

export const emitirNfPedidoSchema = z.object({
  itens: z.array(emitirNfPedidoItemSchema).min(1),
  /** Idempotência do cliente (opcional). */
  idempotencyKey: z.string().trim().min(8).max(80).optional(),
});

export const cancelarNfSchema = z.object({
  justificativa: z.string().trim().min(15).max(255),
  confirmar: z.literal(true),
});

/** ECOL-28b — CC-e Focus: texto 15–1000 caracteres. */
export const cartaCorrecaoNfSchema = z.object({
  correcao: z.string().trim().min(15).max(1000),
});

/** ECOL-28b — envio DANFE/XML por e-mail via Focus (até 10 destinatários). */
export const enviarEmailNfSchema = z.object({
  emails: z.array(z.string().trim().toLowerCase().email()).min(1).max(10),
});

export const criarCampoPersonalizadoSchema = z.object({
  entidade: z.nativeEnum(EntidadeCampoPersonalizado),
  chave: z
    .string()
    .min(2)
    .regex(/^[a-z0-9_]+$/, 'Use apenas letras minúsculas, números e _'),
  rotulo: z.string().min(2),
  descricao: z.string().optional(),
  tipo: z.nativeEnum(TipoCampoPersonalizado),
  obrigatorio: z.boolean().default(false),
  opcoes: z.array(z.string()).optional().nullable(),
  ordem: z.number().int().default(0),
  ativo: z.boolean().default(true),
  usarNoChatbot: z.boolean().default(false),
  textoPergunta: z.string().optional().nullable(),
  mostrarNoResumo: z.boolean().default(true),
  permitirFiltro: z.boolean().default(false),
});

export const atualizarCampoPersonalizadoSchema = criarCampoPersonalizadoSchema.partial();

export const estadoBotSchema = z.object({
  fluxo: z.string().optional(),
  etapa: z.string().optional(),
  dadosColetados: z.record(z.unknown()).optional().default({}),
  ultimaPergunta: z.string().optional(),
  tentativas: z.number().int().default(0),
  /** Resumo textual da triagem para o atendente humano */
  resumo: z.string().optional(),
  /** JID WhatsApp para envio (@lid preferencial) — não faz parte do fluxo do bot */
  jidEnvio: z.string().optional(),
});

export type EstadoBot = z.infer<typeof estadoBotSchema>;

export function criarRespostaPaginada<T>(
  dados: T[],
  total: number,
  pagina: number,
  porPagina: number,
) {
  return {
    dados,
    paginacao: {
      pagina,
      porPagina,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
    },
  };
}

export const enderecoFiscalSchema = z.object({
  logradouro: z.string().min(1).optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  municipio: z.string().optional(),
  uf: z.string().length(2).optional(),
  cep: z.string().optional(),
});

export type EnderecoFiscal = z.infer<typeof enderecoFiscalSchema>;
