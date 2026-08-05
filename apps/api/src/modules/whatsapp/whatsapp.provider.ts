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

export interface WhatsAppProvider {
  readonly nome: string;
  enviarTexto(
    nomeInstancia: string,
    telefone: string,
    texto: string,
    opcoes?: OpcoesEnvioTexto,
  ): Promise<EnvioResultado>;
  conectar(nomeInstancia: string): Promise<ResultadoConexao>;
  desconectar(nomeInstancia: string): Promise<void>;
  statusConexao(nomeInstancia: string): Promise<ResultadoConexao>;
}
