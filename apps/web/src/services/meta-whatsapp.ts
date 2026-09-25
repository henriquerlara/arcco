import { desembrulhar, http } from './http';

export interface MetaWhatsAppStatus {
  configurado: boolean;
  conexao: {
    id: string;
    provedor: string;
    status: string;
    numero?: string | null;
    modoConexao?: string | null;
    wabaId?: string | null;
    phoneNumberId?: string | null;
    isTestConnection?: boolean;
  } | null;
  displayPhoneNumber: string;
  wabaId: string | null;
  phoneNumberId: string | null;
  testRecipient: string | null;
  connectionMode: string;
  isTestConnection: boolean;
  webhook: {
    status: string;
    verifyTokenConfigurado: boolean;
    graphConfigurado: boolean;
    ultimoRecebidoEm: string | null;
    ultimoErro: string | null;
  };
}

export interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
}

export const servicoMetaWhatsApp = {
  status(): Promise<MetaWhatsAppStatus> {
    return http.get('/integrations/meta-whatsapp/status').then(desembrulhar<MetaWhatsAppStatus>);
  },
  ensureConnection() {
    return http.post('/integrations/meta-whatsapp/ensure-connection').then(desembrulhar);
  },
  enviarTeste(dados?: { to?: string; templateName?: string; languageCode?: string }) {
    return http.post('/integrations/meta-whatsapp/test-message', dados ?? {}).then(desembrulhar<{
      conversaId: string;
      wamid?: string;
      to: string;
      templateName: string;
    }>);
  },
  enviarTexto(dados: { texto: string; to?: string; conversaId?: string }) {
    return http.post('/integrations/meta-whatsapp/send-text', dados).then(desembrulhar);
  },
  listarTemplates(): Promise<MetaTemplate[]> {
    return http.get('/integrations/meta-whatsapp/templates').then(desembrulhar<MetaTemplate[]>);
  },
  criarTemplate(dados: {
    name: string;
    language: string;
    category: string;
    body: string;
  }) {
    return http.post('/integrations/meta-whatsapp/templates', dados).then(desembrulhar);
  },
  webhookStatus() {
    return http.get('/integrations/meta-whatsapp/webhook-status').then(desembrulhar);
  },
};
