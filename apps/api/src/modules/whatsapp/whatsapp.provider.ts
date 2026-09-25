export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');

export interface EnvioResultado {
  idExterno?: string;
  status: 'ENVIADA' | 'ERRO';
  erro?: string;
}

export interface ResultadoConexao {
  status: string;
  qrCode?: string | null;
  numero?: string | null;
}

/** Citação da mensagem recebida — ajuda o WhatsApp a tratar como resposta (tcToken/LID). */
export interface OpcoesEnvioTexto {
  quoted?: {
    remoteJid: string;
    id: string;
    fromMe?: boolean;
    texto?: string;
  };
}

export interface MidiaBaixada {
  buffer: Buffer;
  mime: string;
  nome: string;
}

export interface MidiaParaEnvio {
  buffer: Buffer;
  mime: string;
  nome: string;
  caption?: string;
}

/** Menu interativo Cloud API (reply buttons ≤3 ou lista). */
export interface MenuInterativoEnvio {
  body: string;
  opcoes: Array<{ id: string; titulo: string; descricao?: string }>;
  botaoLista?: string;
}

export interface WhatsAppProvider {
  readonly nome: string;
  enviarTexto(
    nomeInstancia: string,
    telefone: string,
    texto: string,
    opcoes?: OpcoesEnvioTexto,
  ): Promise<EnvioResultado>;
  enviarMidia(
    nomeInstancia: string,
    telefone: string,
    midia: MidiaParaEnvio,
  ): Promise<EnvioResultado>;
  /** Opcional — menus interativos da Meta Cloud API. */
  enviarInterativo?(
    nomeInstancia: string,
    telefone: string,
    menu: MenuInterativoEnvio,
  ): Promise<EnvioResultado>;
  conectar(nomeInstancia: string): Promise<ResultadoConexao>;
  desconectar(nomeInstancia: string): Promise<void>;
  statusConexao(nomeInstancia: string): Promise<ResultadoConexao>;
  /** Baixa mídia recebida, quando o provedor expõe os bytes. */
  baixarMidia?(
    nomeInstancia: string,
    itemEvo: Record<string, unknown>,
  ): Promise<MidiaBaixada | null>;
}
