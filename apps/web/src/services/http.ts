import type { ErroApi } from '@/types';

const API_ORIGIN = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const BASE_URL = `${API_ORIGIN.replace(/\/$/, '')}/api`;

export class ErroRequisicao extends Error {
  readonly codigo: string;
  readonly status: number;
  readonly detalhes?: ErroApi['detalhes'];

  constructor(status: number, erro: ErroApi) {
    super(erro.mensagem);
    this.name = 'ErroRequisicao';
    this.codigo = erro.codigo;
    this.status = status;
    this.detalhes = erro.detalhes;
  }
}

type MetodoHttp = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface OpcoesRequisicao {
  metodo?: MetodoHttp;
  corpo?: unknown;
  query?: Record<string, unknown> | undefined;
  sinal?: AbortSignal;
  headers?: Record<string, string>;
}

function montarQuery(query?: Record<string, unknown>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(query)) {
    if (valor === undefined || valor === null || valor === '') continue;
    if (Array.isArray(valor)) {
      valor.forEach((v) => params.append(chave, String(v)));
    } else {
      params.append(chave, String(valor));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export async function requisitar<T>(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const { metodo = 'GET', corpo, query, sinal, headers } = opcoes;
  const url = `${BASE_URL}${caminho}${montarQuery(query)}`;

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: metodo,
      credentials: 'include',
      signal: sinal,
      headers: {
        Accept: 'application/json',
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch (causa) {
    throw new ErroRequisicao(0, {
      codigo: 'REDE_INDISPONIVEL',
      mensagem: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
      detalhes: causa instanceof Error ? { erro: causa.message } : null,
    });
  }

  if (resposta.status === 204) {
    return undefined as T;
  }

  const texto = await resposta.text();
  const json = texto ? seguroParse(texto) : undefined;

  if (!resposta.ok) {
    const erro = normalizarErro(resposta.status, json);
    throw new ErroRequisicao(resposta.status, erro);
  }

  return json as T;
}

function seguroParse(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return { mensagemBruta: texto };
  }
}

function normalizarErro(status: number, json: unknown): ErroApi {
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    // A API envelopa erros como `{ erro: { codigo, mensagem, detalhes } }`.
    const envelope =
      obj.erro && typeof obj.erro === 'object' ? (obj.erro as Record<string, unknown>) : obj;
    if (typeof envelope.codigo === 'string' && typeof envelope.mensagem === 'string') {
      return {
        codigo: envelope.codigo,
        mensagem: envelope.mensagem,
        detalhes: (envelope.detalhes as ErroApi['detalhes']) ?? null,
      };
    }
    if (typeof obj.message === 'string') {
      return { codigo: 'ERRO', mensagem: obj.message };
    }
  }
  const mensagens: Record<number, string> = {
    400: 'Requisição inválida.',
    401: 'Sessão expirada. Entre novamente.',
    403: 'Você não tem permissão para esta ação.',
    404: 'Recurso não encontrado.',
    409: 'Conflito com o estado atual.',
    422: 'Dados inválidos.',
    500: 'Erro interno no servidor.',
  };
  return {
    codigo: `HTTP_${status}`,
    mensagem: mensagens[status] ?? 'Ocorreu um erro inesperado.',
  };
}

export const http = {
  get: <T>(caminho: string, query?: Record<string, unknown>, sinal?: AbortSignal) =>
    requisitar<T>(caminho, { metodo: 'GET', query, sinal }),
  post: <T>(caminho: string, corpo?: unknown) => requisitar<T>(caminho, { metodo: 'POST', corpo }),
  patch: <T>(caminho: string, corpo?: unknown) =>
    requisitar<T>(caminho, { metodo: 'PATCH', corpo }),
  put: <T>(caminho: string, corpo?: unknown) => requisitar<T>(caminho, { metodo: 'PUT', corpo }),
  delete: <T>(caminho: string, corpo?: unknown) =>
    requisitar<T>(caminho, { metodo: 'DELETE', corpo }),
};

/** Retorna `.dados` quando o backend envelopa a resposta, senão o próprio valor. */
export function desembrulhar<T>(resposta: unknown): T {
  if (resposta && typeof resposta === 'object' && 'dados' in resposta) {
    return (resposta as { dados: T }).dados;
  }
  return resposta as T;
}
