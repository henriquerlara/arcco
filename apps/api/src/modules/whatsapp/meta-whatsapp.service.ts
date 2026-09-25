import { forwardRef, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  DirecaoMensagem,
  ModoAtendimento,
  ModoConexaoWhatsApp,
  ProvedorWhatsApp,
  StatusConversa,
  StatusMensagem,
  TipoMensagem,
} from '@arcco/contratos';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { ConversasService } from '../conversas/conversas.service';
import { MensagensService } from '../mensagens/mensagens.service';
import { MetaGraphClient } from './meta.graph';
import { MetaWhatsAppProvider } from './meta.provider';
import { WhatsAppService } from './whatsapp.service';

const META_INSTANCE_PREFIX = 'meta-cloud';

@Injectable()
export class MetaWhatsAppService implements OnModuleInit {
  private readonly logger = new Logger('MetaWhatsAppService');
  private webhookRecebidoEm: Date | null = null;
  private webhookUltimoErro: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: MetaGraphClient,
    private readonly metaProvider: MetaWhatsAppProvider,
    private readonly conversas: ConversasService,
    private readonly mensagens: MensagensService,
    @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsapp: WhatsAppService,
  ) {}

  async onModuleInit() {
    if (!this.graph.configurado()) {
      this.logger.warn('Meta Cloud API não configurada (token/phone/waba ausentes)');
      return;
    }
    try {
      await this.graph.subscribeApp();
      this.logger.log('App inscrito na WABA (subscribed_apps)');
    } catch (erro) {
      this.logger.warn(`Subscribe WABA: ${(erro as Error).message}`);
    }
  }

  statusWebhook() {
    return {
      verifyTokenConfigurado: Boolean(this.graph.verifyToken()),
      graphConfigurado: this.graph.configurado(),
      ultimoRecebidoEm: this.webhookRecebidoEm?.toISOString() ?? null,
      ultimoErro: this.webhookUltimoErro,
      status: !this.graph.verifyToken()
        ? 'nao_configurado'
        : this.webhookUltimoErro
          ? 'erro'
          : this.webhookRecebidoEm
            ? 'configurado'
            : 'aguardando',
    };
  }

  marcarWebhookOk() {
    this.webhookRecebidoEm = new Date();
    this.webhookUltimoErro = null;
  }

  marcarWebhookErro(msg: string) {
    this.webhookUltimoErro = msg;
  }

  /**
   * Garante conexão Meta Cloud API de teste para a empresa.
   */
  async garantirConexaoTeste(empresaId: string) {
    if (!this.graph.configurado()) {
      throw Erros.invalido(
        'META_NAO_CONFIGURADA',
        'Configure META_WHATSAPP_ACCESS_TOKEN, PHONE_NUMBER_ID e WABA_ID',
      );
    }

    const phoneNumberId = this.graph.phoneNumberId();
    const nomeInstancia = `${META_INSTANCE_PREFIX}-${phoneNumberId}`;

    const existente = await this.prisma.conexaoWhatsApp.findFirst({
      where: {
        empresaId,
        OR: [{ nomeInstancia }, { phoneNumberId }, { provedor: ProvedorWhatsApp.META }],
      },
    });

    const data = {
      provedor: ProvedorWhatsApp.META,
      modoConexao: ModoConexaoWhatsApp.CLOUD_API,
      wabaId: this.graph.wabaId(),
      phoneNumberId,
      isTestConnection: true,
      numero: this.graph.displayPhone(),
      status: 'CONECTADO' as const,
      qrCode: null,
      conectadoEm: new Date(),
      ultimoErro: null,
    };

    if (existente) {
      return this.prisma.conexaoWhatsApp.update({
        where: { id: existente.id },
        data,
      });
    }

    return this.prisma.conexaoWhatsApp.create({
      data: {
        empresaId,
        nomeInstancia,
        ...data,
      },
    });
  }

  async obterStatus(empresaId: string) {
    const conexao = await this.prisma.conexaoWhatsApp.findFirst({
      where: { empresaId, provedor: ProvedorWhatsApp.META },
      orderBy: { criadoEm: 'desc' },
    });
    return {
      configurado: this.graph.configurado(),
      conexao,
      displayPhoneNumber: this.graph.displayPhone(),
      wabaId: this.graph.wabaId() || null,
      phoneNumberId: this.graph.phoneNumberId() || null,
      testRecipient: this.graph.testRecipient() || null,
      connectionMode: ModoConexaoWhatsApp.CLOUD_API,
      isTestConnection: true,
      webhook: this.statusWebhook(),
    };
  }

  private assertDestinatarioPermitido(to: string) {
    const destino = to.replace(/\D/g, '');
    const permitido = this.graph.testRecipient();
    if (permitido && destino !== permitido) {
      throw Erros.invalido(
        'META_DESTINATARIO_NAO_AUTORIZADO',
        `Em teste, só é permitido enviar para ${permitido}`,
      );
    }
    if (!destino || destino.length < 10) {
      throw Erros.invalido('TELEFONE_INVALIDO', 'Telefone do destinatário inválido');
    }
    return destino;
  }

  /**
   * Primeira mensagem via template hello_world (abre a conversa de teste).
   */
  async enviarMensagemTeste(
    empresaId: string,
    entrada: { to?: string; templateName?: string; languageCode?: string } = {},
  ) {
    const conexao = await this.garantirConexaoTeste(empresaId);
    const to = this.assertDestinatarioPermitido(entrada.to || this.graph.testRecipient());
    const templateName = entrada.templateName || 'hello_world';
    const languageCode = entrada.languageCode || 'en_US';

    const conversa = await this.conversas.resolverOuCriar(empresaId, {
      telefone: to,
      nome: 'Destinatário teste Meta',
      conexaoId: conexao.id,
    });

    // Mensagem local pending
    const pendente = await this.mensagens.registrar(empresaId, conversa.id, {
      direcao: DirecaoMensagem.ENVIADA,
      tipo: TipoMensagem.TEXTO,
      conteudo: `[template:${templateName}] Mensagem de teste Meta Cloud API`,
      status: StatusMensagem.PROCESSANDO,
      remetente: 'atendente',
      metadados: { provider: 'meta', template: templateName, pending: true },
    });

    const envio = await this.metaProvider.enviarTemplate(to, templateName, languageCode);

    if (envio.status === 'ERRO') {
      await this.prisma.mensagem.update({
        where: { id: pendente.id },
        data: {
          status: StatusMensagem.ERRO,
          metadados: { provider: 'meta', template: templateName, erro: envio.erro },
        },
      });
      throw Erros.invalido('META_ENVIO_FALHOU', envio.erro || 'Falha ao enviar template');
    }

    const atualizada = await this.prisma.mensagem.update({
      where: { id: pendente.id },
      data: {
        status: StatusMensagem.ENVIADA,
        idExterno: envio.idExterno ?? null,
        metadados: { provider: 'meta', template: templateName },
      },
    });

    await this.prisma.conversa.update({
      where: { id: conversa.id },
      data: {
        conexaoId: conexao.id,
        // Teste Cloud API deve deixar o bot responder às réplicas inbound.
        modo: ModoAtendimento.BOT,
        status: StatusConversa.BOT_ATENDENDO,
      },
    });

    return {
      conversaId: conversa.id,
      mensagem: atualizada,
      wamid: envio.idExterno,
      to,
      templateName,
    };
  }

  async enviarTexto(
    empresaId: string,
    entrada: { to?: string; texto: string; conversaId?: string },
  ) {
    const conexao = await this.garantirConexaoTeste(empresaId);
    const to = this.assertDestinatarioPermitido(
      entrada.to ||
        (entrada.conversaId
          ? (
              await this.prisma.conversa.findFirst({
                where: { id: entrada.conversaId, empresaId },
              })
            )?.telefone
          : undefined) ||
        this.graph.testRecipient(),
    );

    if (!(await this.janela24hAberta(empresaId, to))) {
      throw Erros.invalido(
        'META_JANELA_24H',
        'Fora da janela de 24h. Envie o template hello_world primeiro ou aguarde resposta do cliente.',
      );
    }

    let conversaId = entrada.conversaId;
    if (!conversaId) {
      const conversa = await this.conversas.resolverOuCriar(empresaId, {
        telefone: to,
        nome: 'Destinatário teste Meta',
        conexaoId: conexao.id,
      });
      conversaId = conversa.id;
    }

    const pendente = await this.mensagens.registrar(empresaId, conversaId, {
      direcao: DirecaoMensagem.ENVIADA,
      tipo: TipoMensagem.TEXTO,
      conteudo: entrada.texto,
      status: StatusMensagem.PROCESSANDO,
      remetente: 'atendente',
      metadados: { provider: 'meta', pending: true },
    });

    const envio = await this.metaProvider.enviarTexto(conexao.nomeInstancia, to, entrada.texto);
    if (envio.status === 'ERRO') {
      await this.prisma.mensagem.update({
        where: { id: pendente.id },
        data: {
          status: StatusMensagem.ERRO,
          metadados: { provider: 'meta', erro: envio.erro },
        },
      });
      throw Erros.invalido('META_ENVIO_FALHOU', envio.erro || 'Falha ao enviar texto');
    }

    return this.prisma.mensagem.update({
      where: { id: pendente.id },
      data: {
        status: StatusMensagem.ENVIADA,
        idExterno: envio.idExterno ?? null,
        metadados: { provider: 'meta' },
      },
    });
  }

  async janela24hAberta(empresaId: string, telefone: string): Promise<boolean> {
    const normalizado = telefone.replace(/\D/g, '');
    const conversa = await this.prisma.conversa.findFirst({
      where: {
        empresaId,
        OR: [{ telefone: telefone }, { telefoneNormalizado: normalizado }],
      },
      orderBy: { atualizadoEm: 'desc' },
    });
    if (!conversa) return false;

    const ultimaRecebida = await this.prisma.mensagem.findFirst({
      where: { conversaId: conversa.id, direcao: DirecaoMensagem.RECEBIDA },
      orderBy: { criadoEm: 'desc' },
    });
    if (!ultimaRecebida) return false;
    const diff = Date.now() - ultimaRecebida.criadoEm.getTime();
    return diff < 24 * 60 * 60 * 1000;
  }

  listarTemplates() {
    return this.graph.listarTemplates();
  }

  criarTemplate(entrada: { name: string; language: string; category: string; body: string }) {
    const nome = entrada.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (nome.length < 3) {
      throw Erros.invalido('TEMPLATE_NOME_INVALIDO', 'Nome do template inválido');
    }
    return this.graph.criarTemplate({
      name: nome,
      language: entrada.language || 'pt_BR',
      category: entrada.category || 'UTILITY',
      body: entrada.body.trim(),
    });
  }

  /**
   * Processa POST do webhook Meta (messages + statuses).
   */
  async processarWebhook(payload: Record<string, unknown>) {
    this.marcarWebhookOk();
    this.logger.log('Webhook Meta recebido');

    const entry = (payload.entry as Array<Record<string, unknown>>) ?? [];
    for (const ent of entry) {
      const changes = (ent.changes as Array<Record<string, unknown>>) ?? [];
      for (const change of changes) {
        const value = (change.value ?? {}) as Record<string, unknown>;
        const metadata = (value.metadata ?? {}) as {
          phone_number_id?: string;
          display_phone_number?: string;
        };

        await this.processarStatuses((value.statuses as Array<Record<string, unknown>>) ?? []);
        await this.processarMensagensInbound(
          (value.messages as Array<Record<string, unknown>>) ?? [],
          (value.contacts as Array<Record<string, unknown>>) ?? [],
          metadata,
        );
      }
    }

    return { ok: true };
  }

  private async processarStatuses(statuses: Array<Record<string, unknown>>) {
    for (const st of statuses) {
      const wamid = String(st.id ?? '');
      const status = String(st.status ?? '').toLowerCase();
      if (!wamid) continue;

      const mapa: Record<string, StatusMensagem> = {
        sent: StatusMensagem.ENVIADA,
        delivered: StatusMensagem.ENTREGUE,
        read: StatusMensagem.LIDA,
        failed: StatusMensagem.ERRO,
      };
      const novo = mapa[status];
      if (!novo) continue;

      const msgs = await this.prisma.mensagem.findMany({
        where: { idExterno: wamid },
        take: 5,
      });
      for (const msg of msgs) {
        await this.prisma.mensagem.update({
          where: { id: msg.id },
          data: {
            status: novo,
            metadados: {
              ...((msg.metadados as object) ?? {}),
              metaStatus: status,
              provider: 'meta',
            },
          },
        });
        this.logger.log(`Status Meta wamid=${wamid} → ${status}`);
      }
    }
  }

  private async processarMensagensInbound(
    messages: Array<Record<string, unknown>>,
    contacts: Array<Record<string, unknown>>,
    metadata: { phone_number_id?: string; display_phone_number?: string },
  ) {
    for (const msg of messages) {
      const idExterno = String(msg.id ?? '');
      const from = String(msg.from ?? '').replace(/\D/g, '');
      const type = String(msg.type ?? 'text');
      if (!idExterno || !from) continue;

      const contact = contacts.find((c) => String((c as { wa_id?: string }).wa_id ?? '') === from);
      const profile = (contact?.profile ?? {}) as { name?: string };
      const nome = profile.name ?? null;

      let texto = '';
      let textoExibicao: string | undefined;
      if (type === 'text') {
        texto = String((msg.text as { body?: string } | undefined)?.body ?? '');
      } else if (type === 'button') {
        const button = msg.button as { payload?: string; text?: string } | undefined;
        const payload = String(button?.payload ?? '').trim();
        const titulo = limparTituloOpcao(String(button?.text ?? ''));
        // Máquina usa id numérico; CRM mostra só o título curto.
        texto = /^\d+$/.test(payload) ? payload : titulo || payload || '[botão]';
        textoExibicao = titulo || texto;
      } else if (type === 'interactive') {
        const interactive = msg.interactive as
          | {
              button_reply?: { id?: string; title?: string; description?: string };
              list_reply?: { id?: string; title?: string; description?: string };
            }
          | undefined;
        const reply = interactive?.button_reply ?? interactive?.list_reply;
        const id = String(reply?.id ?? '').trim();
        const titulo = limparTituloOpcao(String(reply?.title ?? ''));
        // Nunca concatenar description na mensagem do usuário.
        texto = /^\d+$/.test(id) ? id : titulo || id || '[interativo]';
        textoExibicao = titulo || texto;
      } else {
        // Arquitetura preparada para mídia — registra placeholder
        texto = `[${type}]`;
      }

      const conexao = await this.prisma.conexaoWhatsApp.findFirst({
        where: {
          provedor: ProvedorWhatsApp.META,
          ...(metadata.phone_number_id
            ? { phoneNumberId: metadata.phone_number_id }
            : {}),
        },
        orderBy: { criadoEm: 'asc' },
      });

      if (!conexao) {
        this.logger.warn(`Webhook Meta sem conexão local phone_number_id=${metadata.phone_number_id}`);
        continue;
      }

      // Reutiliza o pipeline de inbound existente (contato/conversa/chatbot)
      await this.whatsapp.processarMensagemRecebida({
        nomeInstancia: conexao.nomeInstancia,
        telefone: from,
        nome,
        texto: texto || `[${type}]`,
        textoExibicao,
        idExterno,
      });
    }
  }
}

/** Título limpo da opção (sem descrição após " — "). */
function limparTituloOpcao(titulo: string): string {
  const t = titulo.trim();
  if (!t) return '';
  const sep = t.indexOf(' — ');
  return (sep > 0 ? t.slice(0, sep) : t).trim();
}
