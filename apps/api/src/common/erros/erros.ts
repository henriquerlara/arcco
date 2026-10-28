/**
 * Erro de aplicacao com codigo semantico em portugues. Nunca expoe detalhes
 * internos (stack, Prisma) ao cliente — apenas o que for seguro.
 */
export class AppError extends Error {
  readonly codigo: string;
  readonly status: number;
  readonly detalhes?: unknown;

  constructor(codigo: string, mensagem: string, status = 400, detalhes?: unknown) {
    super(mensagem);
    this.name = 'AppError';
    this.codigo = codigo;
    this.status = status;
    this.detalhes = detalhes;
  }
}

export const Erros = {
  naoAutenticado: (mensagem = 'Sessao invalida ou expirada') =>
    new AppError('NAO_AUTENTICADO', mensagem, 401),
  semPermissao: (mensagem = 'Voce nao tem permissao para esta acao') =>
    new AppError('SEM_PERMISSAO', mensagem, 403),
  naoEncontrado: (codigo: string, mensagem: string) => new AppError(codigo, mensagem, 404),
  invalido: (codigo: string, mensagem: string, detalhes?: unknown) =>
    new AppError(codigo, mensagem, 422, detalhes),
  conflito: (codigo: string, mensagem: string, detalhes?: unknown) =>
    new AppError(codigo, mensagem, 409, detalhes),
  credenciaisInvalidas: () =>
    new AppError('CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos', 401),
  limiteTaxa: (mensagem = 'Muitas tentativas. Tente novamente em instantes') =>
    new AppError('LIMITE_TAXA', mensagem, 429),
};
