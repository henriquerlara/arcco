import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DirecaoMensagem,
  ModoAtendimento,
  OrigemHistoricoEtapa,
  ChaveEtapaSistema,
  ProvedorWhatsApp,
  StatusConversa,
  StatusMensagem,
  TipoMensagem,
} from '@arcco/contratos';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { ConversasService } from '../conversas/conversas.service';
import { MensagensService } from '../mensagens/mensagens.service';
import { ChatbotService } from '../chatbot/chatbot.service';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import {
  WHATSAPP_PROVIDER,
  type OpcoesEnvioTexto,
  type WhatsAppProvider,
} from './whatsapp.provider';
import { FilaMensagensPorTelefone } from './mensagem.fila';

export interface MensagemRecebidaEntrada {
  nomeInstancia: string;
  /** Número em dígitos para CRM (PN via remoteJidAlt) */
  telefone: string;
  /** JID do chat onde o cliente escreveu (@lid) — respostas DEVEM ir aqui */
  destinoEnvio?: string;
  nome?: string | null;
  texto: string;
  idExterno?: string | null;
  quoted?: OpcoesEnvioTexto['quoted'];
  /** Epoch ms da mensagem no WhatsApp (para ordenar a fila) */
  recebidoEm?: number;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger('WhatsApp');
  private readonly fila = new FilaMensagensPorTelefone();

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversas: ConversasService,
    private readonly mensagens: MensagensService,
    private readonly chatbot: ChatbotService,
    private readonly oportunidades: OportunidadesService,
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsAppProvider,
  ) {}

  // ---------- Conexoes ----------

  listarConexoes(empresaId: string) {
    return this.prisma.conexaoWhatsApp.findMany({ where: { empresaId }, orderBy: { criadoEm: 'asc' } });
  }

  /** Instâncias Evolution usadas pelo poller de mensagens. */
  async listarConexoesAtivasEvolution(): Promise<string[]> {
    const conexoes = await this.prisma.conexaoWhatsApp.findMany({
      where: { provedor: ProvedorWhatsApp.EVOLUTION },
      select: { nomeInstancia: true },
    });
    return conexoes.map((c) => c.nomeInstancia);
  }

  async criarConexao(empresaId: string, nomeInstancia: string, numero?: string) {
    const existente = await this.prisma.conexaoWhatsApp.findUnique({ where: { nomeInstancia } });
    if (existente && existente.empresaId !== empresaId) {
      throw Erros.conflito('INSTANCIA_EM_USO', 'Nome de instancia ja utilizado');
    }
    if (existente) return existente;

    if (this.provider.nome === 'evolution' && 'garantirInstancia' in this.provider) {
      await (
        this.provider as WhatsAppProvider & {
          garantirInstancia: (nome: string, numero?: string) => Promise<void>;
        }
      ).garantirInstancia(nomeInstancia, numero);
    }

    return this.prisma.conexaoWhatsApp.create({
      data: {
        empresaId,
        nomeInstancia,
        numero: numero ?? null,
        provedor: this.provider.nome === 'evolution' ? ProvedorWhatsApp.EVOLUTION : ProvedorWhatsApp.MOCK,
      },
    });
  }

  async conectar(empresaId: string, id: string) {
    const conexao = await this.obterConexao(empresaId, id);
    const resultado = await this.provider.conectar(conexao.nomeInstancia);
    return this.prisma.conexaoWhatsApp.update({
      where: { id },
      data: {
        status: resultado.status as never,
        qrCode: resultado.qrCode ?? null,
        numero: resultado.numero ?? conexao.numero,
        conectadoEm: resultado.status === 'CONECTADO' ? new Date() : conexao.conectadoEm,
      },
    });
  }

  async statusConexao(empresaId: string, id: string) {
    const conexao = await this.obterConexao(empresaId, id);
    const resultado = await this.provider.statusConexao(conexao.nomeInstancia);

    let status = resultado.status;
    // Enquanto o QR ainda é necessário, mantém QR_CODE para a UI exibir o código
    if (
      status === 'CONECTANDO' &&
      (conexao.qrCode || resultado.status === 'CONECTANDO') &&
      conexao.qrCode
    ) {
      status = 'QR_CODE';
    }

    return this.prisma.conexaoWhatsApp.update({
      where: { id },
      data: {
        status: status as never,
        numero: resultado.numero ?? conexao.numero,
        conectadoEm:
          resultado.status === 'CONECTADO' && !conexao.conectadoEm
            ? new Date()
            : conexao.conectadoEm,
        qrCode: resultado.status === 'CONECTADO' ? null : conexao.qrCode,
      },
    });
  }

  async desconectar(empresaId: string, id: string) {
    const conexao = await this.obterConexao(empresaId, id);
    await this.provider.desconectar(conexao.nomeInstancia);
    return this.prisma.conexaoWhatsApp.update({
      where: { id },
      data: { status: 'DESCONECTADO' as never, qrCode: null },
    });
  }

  /** Garante que exista uma instancia (mock) para simulacoes de chatbot. */
  async garantirInstanciaSimulada(empresaId: string, nomeInstancia?: string): Promise<string> {
    if (nomeInstancia) {
      const informada = await this.prisma.conexaoWhatsApp.findFirst({
        where: { empresaId, nomeInstancia },
      });
      if (informada) return informada.nomeInstancia;
    }

    const existente = await this.prisma.conexaoWhatsApp.findFirst({
      where: { empresaId, provedor: ProvedorWhatsApp.MOCK },
      orderBy: { criadoEm: 'asc' },
    });
    if (existente) return existente.nomeInstancia;

    const nome = nomeInstancia ?? `mock-${empresaId.slice(0, 8)}`;
    const criada = await this.prisma.conexaoWhatsApp.create({
      data: {
        empresaId,
        nomeInstancia: nome,
        provedor: ProvedorWhatsApp.MOCK,
        status: 'CONECTADO' as never,
      },
    });
    return criada.nomeInstancia;
  }

  private async obterConexao(empresaId: string, id: string) {
    const conexao = await this.prisma.conexaoWhatsApp.findFirst({ where: { id, empresaId } });
    if (!conexao) throw Erros.naoEncontrado('CONEXAO_NAO_ENCONTRADA', 'Conexao nao encontrada');
    return conexao;
  }

  // ---------- Mensageria ----------

  /**
   * Ponto central de entrada de mensagens do WhatsApp (webhook ou simulador).
   * Persiste a mensagem recebida e, quando em modo BOT, aciona o chatbot.
   * Serializa por telefone para não inverter a ordem do fluxo.
   */
  async processarMensagemRecebida(entrada: MensagemRecebidaEntrada) {
    const chaveFila = `${entrada.nomeInstancia}:${entrada.telefone}`;
    return this.fila.enfileirar(chaveFila, () => this.processarMensagemRecebidaInterno(entrada));
  }

  private async processarMensagemRecebidaInterno(entrada: MensagemRecebidaEntrada) {
    const conexao = await this.prisma.conexaoWhatsApp.findUnique({
      where: { nomeInstancia: entrada.nomeInstancia },
    });
    if (!conexao) {
      this.logger.warn(`Mensagem para instancia desconhecida: ${entrada.nomeInstancia}`);
      throw Erros.naoEncontrado('CONEXAO_NAO_ENCONTRADA', 'Instancia nao encontrada');
    }

    const conversa = await this.conversas.resolverOuCriar(conexao.empresaId, {
      telefone: entrada.telefone,
      nome: entrada.nome,
      conexaoId: conexao.id,
    });

    // Idempotência: webhook + poller podem ver a mesma mensagem
    if (entrada.idExterno) {
      const jaExiste = await this.prisma.mensagem.findFirst({
        where: { conversaId: conversa.id, idExterno: entrada.idExterno },
        select: { id: true },
      });
      if (jaExiste) {
        return { conversaId: conversa.id, respostasBot: 0, transferido: false, duplicada: true };
      }
    }
    await this.mensagens.registrar(conexao.empresaId, conversa.id, {
      direcao: DirecaoMensagem.RECEBIDA,
      tipo: TipoMensagem.TEXTO,
      conteudo: entrada.texto,
      status: StatusMensagem.RECEBIDA,
      remetente: entrada.telefone,
      idExterno: entrada.idExterno,
    });

    if (entrada.destinoEnvio) {
      await this.persistirJidEnvio(conversa.id, conversa.estadoBot, entrada.destinoEnvio);
    }

    if (conversa.modo !== ModoAtendimento.BOT) {
      return { conversaId: conversa.id, respostasBot: 0, transferido: false };
    }

    // Recarrega estado após possível update de jidEnvio
    const conversaAtual = await this.prisma.conversa.findUnique({ where: { id: conversa.id } });
    const estadoBot = conversaAtual?.estadoBot ?? conversa.estadoBot;

    const resultado = await this.chatbot.processar(
      {
        id: conversa.id,
        empresaId: conversa.empresaId,
        contatoId: conversa.contatoId,
        telefone: conversa.telefone,
        nomeContato: conversa.nomeContato,
        modo: conversa.modo,
        estadoBot,
      },
      entrada.texto,
    );

    if (entrada.destinoEnvio) {
      const atual = await this.prisma.conversa.findUnique({
        where: { id: conversa.id },
        select: { estadoBot: true },
      });
      await this.persistirJidEnvio(conversa.id, atual?.estadoBot, entrada.destinoEnvio);
    }

    const destino =
      entrada.destinoEnvio ?? extrairJidEnvio(estadoBot) ?? conversa.telefone;

    // Uma bolha só. Envio adiado 1 tick para a Evolution terminar o batch
    // (senão o sendText entra na fila concatMap/mergeMap e atrasa a próxima msg).
    if (resultado.respostas.length > 0) {
      const texto = resultado.respostas.join('\n\n');
      const empresaId = conexao.empresaId;
      const conversaId = conversa.id;
      const nomeInstancia = conexao.nomeInstancia;
      const quoted = entrada.quoted;
      setTimeout(() => {
        void this.enviarERegistrar(empresaId, conversaId, {
          nomeInstancia,
          telefone: destino,
          texto,
          remetente: 'bot',
          quoted,
        }).catch((erro) =>
          this.logger.error(`Falha envio diferido: ${(erro as Error).message}`),
        );
      }, 50);
    }

    return {
      conversaId: conversa.id,
      respostasBot: resultado.respostas.length > 0 ? 1 : 0,
      transferido: resultado.transferido,
      oportunidadeId: resultado.oportunidadeId,
    };
  }

  /** Envio manual por um atendente humano. */
  async enviarMensagemAtendente(
    empresaId: string,
    conversaId: string,
    texto: string,
    usuarioId: string,
  ) {
    const conversa = await this.conversas.obter(empresaId, conversaId);
    const conexao = conversa.conexaoId
      ? await this.prisma.conexaoWhatsApp.findUnique({ where: { id: conversa.conexaoId } })
      : null;

    const destino = extrairJidEnvio(conversa.estadoBot) ?? conversa.telefone;
    const mensagem = await this.enviarERegistrar(empresaId, conversaId, {
      nomeInstancia: conexao?.nomeInstancia ?? 'mock',
      telefone: destino,
      texto,
      remetente: 'atendente',
      autorUsuarioId: usuarioId,
    });

    await this.prisma.conversa.update({
      where: { id: conversaId },
      data: {
        modo: ModoAtendimento.HUMANO,
        status: StatusConversa.EM_ATENDIMENTO,
        atendenteId: usuarioId,
      },
    });

    if (conversa.oportunidadeId) {
      try {
        await this.oportunidades.moverPorChave(
          empresaId,
          conversa.oportunidadeId,
          ChaveEtapaSistema.ORCAMENTO_ENVIADO,
          OrigemHistoricoEtapa.ORCAMENTO_WHATSAPP,
          usuarioId,
        );
      } catch (erro) {
        this.logger.warn(
          `Falha ao avançar funil após envio: ${(erro as Error).message}`,
        );
      }
    }

    return mensagem;
  }

  private async enviarERegistrar(
    empresaId: string,
    conversaId: string,
    dados: {
      nomeInstancia: string;
      telefone: string;
      texto: string;
      remetente: string;
      autorUsuarioId?: string;
      quoted?: OpcoesEnvioTexto['quoted'];
    },
  ) {
    const envio = await this.provider.enviarTexto(
      dados.nomeInstancia,
      dados.telefone,
      dados.texto,
      dados.quoted ? { quoted: dados.quoted } : undefined,
    );
    return this.mensagens.registrar(empresaId, conversaId, {
      direcao: DirecaoMensagem.ENVIADA,
      tipo: TipoMensagem.TEXTO,
      conteudo: dados.texto,
      status: envio.status === 'ENVIADA' ? StatusMensagem.ENVIADA : StatusMensagem.ERRO,
      remetente: dados.remetente,
      autorUsuarioId: dados.autorUsuarioId ?? null,
      idExterno: envio.idExterno ?? null,
      metadados: envio.erro ? { erro: envio.erro } : null,
    });
  }

  private async persistirJidEnvio(
    conversaId: string,
    estadoBot: unknown,
    jidEnvio: string,
  ): Promise<void> {
    const base =
      estadoBot && typeof estadoBot === 'object' && !Array.isArray(estadoBot)
        ? { ...(estadoBot as Record<string, unknown>) }
        : {};
    if (base.jidEnvio === jidEnvio) return;
    await this.prisma.conversa.update({
      where: { id: conversaId },
      data: { estadoBot: { ...base, jidEnvio } },
    });
  }
}

function extrairJidEnvio(estadoBot: unknown): string | null {
  if (!estadoBot || typeof estadoBot !== 'object' || Array.isArray(estadoBot)) return null;
  const jid = (estadoBot as { jidEnvio?: unknown }).jidEnvio;
  return typeof jid === 'string' && jid.length > 0 ? jid : null;
}
