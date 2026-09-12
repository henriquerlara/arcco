import {
  configuracoesEmpresaPadrao,
  StatusConexaoWhatsApp,
  type ChatbotConfig,
  type ConfiguracoesEmpresa,
} from '@arcco/contratos';
import type {
  Categoria,
  CampoPersonalizado,
  ConexaoWhatsApp,
  Empresa,
  EtapaFunil,
  StatusWhatsApp,
  Usuario,
} from '@/types';
import { desembrulhar, http } from './http';

/** Extrai as configurações da empresa, preenchendo defaults ausentes. */
function extrairConfiguracoes(empresa: Empresa): ConfiguracoesEmpresa {
  const padrao = configuracoesEmpresaPadrao();
  const atual = empresa.configuracoes;
  if (!atual) return padrao;
  return {
    horarioAtendimento: atual.horarioAtendimento ?? padrao.horarioAtendimento,
    chatbot: { ...padrao.chatbot, ...atual.chatbot },
    onboardingConcluido: atual.onboardingConcluido ?? padrao.onboardingConcluido,
  };
}

export const servicoEmpresa = {
  async obter(): Promise<Empresa> {
    return desembrulhar<Empresa>(await http.get('/empresa'));
  },
  async atualizar(dados: Partial<Empresa>): Promise<Empresa> {
    return desembrulhar<Empresa>(await http.patch('/empresa', dados));
  },
  async configuracoes(): Promise<ConfiguracoesEmpresa> {
    return extrairConfiguracoes(await this.obter());
  },
  async salvarConfiguracoes(
    dados: Partial<ConfiguracoesEmpresa>,
  ): Promise<ConfiguracoesEmpresa> {
    const empresa = desembrulhar<Empresa>(await http.patch('/empresa/onboarding', dados));
    return extrairConfiguracoes(empresa);
  },
  async concluirOnboarding(): Promise<void> {
    await http.patch('/empresa/onboarding', { onboardingConcluido: true });
  },
};

export const servicoEquipe = {
  async listar(): Promise<Usuario[]> {
    return desembrulhar<Usuario[]>(await http.get('/usuarios'));
  },
  async criar(dados: {
    nome: string;
    email: string;
    senhaTemporaria: string;
    perfil: string;
  }): Promise<Usuario> {
    return desembrulhar<Usuario>(await http.post('/usuarios', dados));
  },
  async atualizar(id: string, dados: Partial<Usuario>): Promise<Usuario> {
    return desembrulhar<Usuario>(await http.patch(`/usuarios/${id}`, dados));
  },
  redefinirSenha(id: string, senhaTemporaria: string): Promise<void> {
    return http.post(`/usuarios/${id}/redefinir-senha`, { senhaTemporaria });
  },
  desativar(id: string): Promise<void> {
    return http.delete(`/usuarios/${id}`);
  },
};

export const servicoCategorias = {
  async listar(): Promise<Categoria[]> {
    return desembrulhar<Categoria[]>(await http.get('/categorias'));
  },
  async criar(dados: Partial<Categoria>): Promise<Categoria> {
    return desembrulhar<Categoria>(await http.post('/categorias', dados));
  },
  async atualizar(id: string, dados: Partial<Categoria>): Promise<Categoria> {
    return desembrulhar<Categoria>(await http.patch(`/categorias/${id}`, dados));
  },
  excluir(id: string): Promise<void> {
    return http.delete(`/categorias/${id}`);
  },
};

export const servicoFunil = {
  async listar(): Promise<EtapaFunil[]> {
    return desembrulhar<EtapaFunil[]>(await http.get('/funil/etapas'));
  },
  async criar(dados: Partial<EtapaFunil>): Promise<EtapaFunil> {
    return desembrulhar<EtapaFunil>(await http.post('/funil/etapas', dados));
  },
  async atualizar(id: string, dados: Partial<EtapaFunil>): Promise<EtapaFunil> {
    return desembrulhar<EtapaFunil>(await http.patch(`/funil/etapas/${id}`, dados));
  },
  reordenar(etapas: { id: string; ordem: number }[]): Promise<void> {
    return http.post('/funil/etapas/reordenar', { etapas });
  },
  excluir(id: string, etapaDestinoId: string): Promise<void> {
    return http.delete(`/funil/etapas/${id}`, { etapaDestinoId });
  },
};

export const servicoCamposPersonalizados = {
  async listar(entidade?: string): Promise<CampoPersonalizado[]> {
    return desembrulhar<CampoPersonalizado[]>(
      await http.get('/campos-personalizados', entidade ? { entidade } : undefined),
    );
  },
  async criar(dados: Partial<CampoPersonalizado>): Promise<CampoPersonalizado> {
    return desembrulhar<CampoPersonalizado>(await http.post('/campos-personalizados', dados));
  },
  async atualizar(id: string, dados: Partial<CampoPersonalizado>): Promise<CampoPersonalizado> {
    return desembrulhar<CampoPersonalizado>(
      await http.patch(`/campos-personalizados/${id}`, dados),
    );
  },
  excluir(id: string): Promise<void> {
    return http.delete(`/campos-personalizados/${id}`);
  },
};

export const servicoChatbot = {
  async obter(): Promise<ChatbotConfig> {
    return extrairConfiguracoes(await servicoEmpresa.obter()).chatbot;
  },
  async salvar(dados: Partial<ChatbotConfig>): Promise<ChatbotConfig> {
    const config = await servicoEmpresa.salvarConfiguracoes({ chatbot: dados as ChatbotConfig });
    return config.chatbot;
  },
};

/** Converte uma conexão do WhatsApp em um resumo de status para a UI. */
function mapearStatus(conexao: ConexaoWhatsApp): StatusWhatsApp {
  return {
    provedor: conexao.provedor,
    status: conexao.status,
    numero: conexao.numero ?? null,
    qrCode: conexao.qrCode ?? null,
    atualizadoEm: conexao.atualizadoEm ?? conexao.conectadoEm ?? null,
  };
}

const STATUS_DESCONECTADO: StatusWhatsApp = {
  provedor: 'MOCK',
  status: StatusConexaoWhatsApp.DESCONECTADO,
  numero: null,
  qrCode: null,
  atualizadoEm: null,
};

export const servicoWhatsApp = {
  async listarConexoes(): Promise<ConexaoWhatsApp[]> {
    return desembrulhar<ConexaoWhatsApp[]>(await http.get('/whatsapp/conexoes'));
  },
  preferida(conexoes: ConexaoWhatsApp[]): ConexaoWhatsApp | undefined {
    return (
      conexoes.find((c) => c.status === StatusConexaoWhatsApp.CONECTADO) ??
      conexoes.find((c) => c.provedor === 'EVOLUTION') ??
      conexoes[0]
    );
  },
  async status(): Promise<StatusWhatsApp> {
    const conexoes = await servicoWhatsApp.listarConexoes();
    const conexao = servicoWhatsApp.preferida(conexoes);
    if (!conexao) return STATUS_DESCONECTADO;
    try {
      const atualizada = desembrulhar<ConexaoWhatsApp>(
        await http.get(`/whatsapp/conexoes/${conexao.id}/status`),
      );
      return mapearStatus(atualizada);
    } catch {
      return mapearStatus(conexao);
    }
  },
  async conectar(): Promise<StatusWhatsApp> {
    const conexoes = await servicoWhatsApp.listarConexoes();
    const conexao = servicoWhatsApp.preferida(conexoes);
    if (!conexao) {
      throw new Error('Nenhuma conexão WhatsApp cadastrada. Crie uma conexão nas configurações.');
    }
    const atualizada = desembrulhar<ConexaoWhatsApp>(
      await http.post(`/whatsapp/conexoes/${conexao.id}/conectar`),
    );
    return mapearStatus(atualizada);
  },
  async criarConexao(nomeInstancia: string, numero?: string): Promise<ConexaoWhatsApp> {
    return desembrulhar<ConexaoWhatsApp>(
      await http.post('/whatsapp/conexoes', { nomeInstancia, numero }),
    );
  },
  async desconectar(): Promise<StatusWhatsApp> {
    const conexoes = await servicoWhatsApp.listarConexoes();
    const conexao = servicoWhatsApp.preferida(conexoes);
    if (!conexao) return STATUS_DESCONECTADO;
    await http.delete(`/whatsapp/conexoes/${conexao.id}`);
    return { ...mapearStatus(conexao), status: StatusConexaoWhatsApp.DESCONECTADO, qrCode: null };
  },
  async simularMensagem(dados: {
    telefone: string;
    nome?: string;
    texto: string;
  }): Promise<{ conversaId: string; respostasBot: number; transferido: boolean }> {
    return desembrulhar<{ conversaId: string; respostasBot: number; transferido: boolean }>(
      await http.post('/whatsapp/simulador/mensagem', dados),
    );
  },
};
