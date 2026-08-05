import { TipoCampoPersonalizado } from '@arcco/contratos';

export interface DefinicaoCampo {
  chave: string;
  rotulo: string;
  tipo: TipoCampoPersonalizado;
  obrigatorio: boolean;
  opcoes?: string[] | null;
  ativo: boolean;
}

export interface ResultadoValidacao {
  valido: boolean;
  erros: Record<string, string>;
  dados: Record<string, unknown>;
}

function ehVazio(valor: unknown): boolean {
  return (
    valor === undefined ||
    valor === null ||
    valor === '' ||
    (Array.isArray(valor) && valor.length === 0)
  );
}

/**
 * Valida e normaliza os dados personalizados enviados pelo cliente contra as
 * definicoes de campos personalizados da empresa. Campos desconhecidos sao ignorados
 * (nunca confiamos cegamente no payload do frontend).
 */
export function validarDadosPersonalizados(
  definicoes: DefinicaoCampo[],
  dadosBrutos: Record<string, unknown> | null | undefined,
): ResultadoValidacao {
  const dados = dadosBrutos ?? {};
  const erros: Record<string, string> = {};
  const saida: Record<string, unknown> = {};

  for (const def of definicoes) {
    if (!def.ativo) continue;
    const valor = dados[def.chave];

    if (ehVazio(valor)) {
      if (def.obrigatorio) {
        erros[def.chave] = `O campo "${def.rotulo}" e obrigatorio`;
      }
      continue;
    }

    switch (def.tipo) {
      case TipoCampoPersonalizado.TEXTO:
      case TipoCampoPersonalizado.TEXTO_LONGO: {
        if (typeof valor !== 'string') {
          erros[def.chave] = `O campo "${def.rotulo}" deve ser texto`;
        } else {
          saida[def.chave] = valor;
        }
        break;
      }
      case TipoCampoPersonalizado.NUMERO:
      case TipoCampoPersonalizado.MOEDA: {
        const num = typeof valor === 'string' ? Number(valor.replace(',', '.')) : Number(valor);
        if (Number.isNaN(num)) {
          erros[def.chave] = `O campo "${def.rotulo}" deve ser numerico`;
        } else {
          saida[def.chave] = num;
        }
        break;
      }
      case TipoCampoPersonalizado.BOOLEANO: {
        if (typeof valor === 'boolean') {
          saida[def.chave] = valor;
        } else if (valor === 'true' || valor === 'false') {
          saida[def.chave] = valor === 'true';
        } else {
          erros[def.chave] = `O campo "${def.rotulo}" deve ser verdadeiro ou falso`;
        }
        break;
      }
      case TipoCampoPersonalizado.DATA: {
        const data = new Date(valor as string);
        if (Number.isNaN(data.getTime())) {
          erros[def.chave] = `O campo "${def.rotulo}" deve ser uma data valida`;
        } else {
          saida[def.chave] = data.toISOString();
        }
        break;
      }
      case TipoCampoPersonalizado.SELECAO: {
        const opcoes = def.opcoes ?? [];
        if (typeof valor !== 'string' || !opcoes.includes(valor)) {
          erros[def.chave] = `O campo "${def.rotulo}" tem valor invalido`;
        } else {
          saida[def.chave] = valor;
        }
        break;
      }
      case TipoCampoPersonalizado.MULTISSELECAO: {
        const opcoes = def.opcoes ?? [];
        if (!Array.isArray(valor) || valor.some((v) => !opcoes.includes(String(v)))) {
          erros[def.chave] = `O campo "${def.rotulo}" tem valores invalidos`;
        } else {
          saida[def.chave] = valor;
        }
        break;
      }
      default: {
        saida[def.chave] = valor;
      }
    }
  }

  return {
    valido: Object.keys(erros).length === 0,
    erros,
    dados: saida,
  };
}
