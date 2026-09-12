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
import { EventosService, TipoEvento } from '../eventos/eventos.service';
import { ArquivosService } from '../arquivos/arquivos.service';
import {
  WHATSAPP_PROVIDER,
  type OpcoesEnvioTexto,
  type WhatsAppProvider,
} from './whatsapp.provider';
import { FilaMensagensPorTelefone } from './mensagem.fila';

const TAMANHO_MAX_MIDIA_BYTES = 20 * 1024 * 1024;

export interface MidiaRecebidaEntrada {
  tipo: TipoMensagem;
  nome: string;
  mime: string;
  caption?: string;
  itemEvo: Record<string, unknown>;
}

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
  midia?: MidiaRecebidaEntrada;
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
    private readonly eventos: EventosService,
    private readonly arquivos: ArquivosService,
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsAppProvider,
  ) {}

  // ---------- Conexoes ----------

  listarConexoes(empresaId: string) {
    return this.prisma.conexaoWhatsApp.findMany({ where: { empresaId }, orderBy: { criadoEm: 'asc' } });
  }

  /** Instâncias Evolution usadas pelo poller de mensagens. */
  async listarConexoesAtivasEvolution(): Promise<string[]> {
    const conexoes = await this.prisma.conexaoWhatsApp.findMany({
      where: {
        OR: [
          { provedor: ProvedorWhatsApp.EVOLUTION },
          { status: 'CONECTADO' },
        ],
      },
      select: { nomeInstancia: true },
    });
    return [...new Set(conexoes.map((c) => c.nomeInstancia))];
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
      return { conversaId: null, respostasBot: 0, transferido: false, ignorada: true };
    }

    let conversa = await this.conversas.resolverOuCriar(conexao.empresaId, {
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
    const midiaSalva = await this.salvarMidiaRecebida(
      conexao.empresaId,
      conversa.id,
      entrada,
    );

    await this.mensagens.registrar(conexao.empresaId, conversa.id, {
      direcao: DirecaoMensagem.RECEBIDA,
      tipo: midiaSalva?.tipo ?? TipoMensagem.TEXTO,
      conteudo: midiaSalva?.conteudo ?? entrada.texto,
      status: StatusMensagem.RECEBIDA,
      remetente: entrada.telefone,
      idExterno: entrada.idExterno,
      arquivoId: midiaSalva?.arquivoId ?? null,
    });

    if (entrada.destinoEnvio) {
      await this.persistirJidEnvio(conversa.id, conversa.estadoBot, entrada.destinoEnvio);
    }

    // Atendimento humano/pausado não reabre o bot — mesmo se o fluxo anterior
    // tiver ficado FINALIZADO (ex.: orçamento criado e transferido).
    if (conversa.modo === ModoAtendimento.HUMANO || conversa.modo === ModoAtendimento.PAUSADO) {
      await this.vincularArquivoOportunidade(
        conexao.empresaId,
        midiaSalva?.arquivoId,
        conversa.oportunidadeId,
        midiaSalva?.nomeArquivo,
      );
      return { conversaId: conversa.id, respostasBot: 0, transferido: false };
    }

    if (fluxoDoEstado(conversa.estadoBot) === 'FINALIZADO') {
      const jidEnvio = entrada.destinoEnvio ?? extrairJidEnvio(conversa.estadoBot);
      conversa = await this.prisma.conversa.update({
        where: { id: conversa.id },
        data: {
          modo: ModoAtendimento.BOT,
          status: StatusConversa.BOT_ATENDENDO,
          estadoBot: {
            dadosColetados: {},
            tentativas: 0,
            ...(jidEnvio ? { jidEnvio } : {}),
          },
        },
      });
      this.logger.log(`Sessao do bot reaberta conversa=${conversa.id}`);
    }

    if (conversa.modo !== ModoAtendimento.BOT) {
      await this.vincularArquivoOportunidade(
        conexao.empresaId,
        midiaSalva?.arquivoId,
        conversa.oportunidadeId,
        midiaSalva?.nomeArquivo,
      );
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

    const oportunidadeId = resultado.oportunidadeId ?? conversa.oportunidadeId ?? null;
    await this.vincularArquivoOportunidade(
      conexao.empresaId,
      midiaSalva?.arquivoId,
      oportunidadeId,
      midiaSalva?.nomeArquivo,
    );

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

    return mensagem;
  }

  /**
   * Envia orçamento pela conversa da oportunidade e avança o funil para Negociação.
   * Grava o valor no card e, se houver PDF, envia o arquivo no WhatsApp.
   */
  async enviarOrcamento(
    empresaId: string,
    oportunidadeId: string,
    entrada: { texto: string; valorEstimado: number; arquivoId?: string | null },
    usuarioId: string,
  ) {
    const oportunidade = await this.prisma.oportunidade.findFirst({
      where: { id: oportunidadeId, empresaId },
      select: { id: true, dadosPersonalizados: true },
    });
    if (!oportunidade) {
      throw Erros.naoEncontrado('OPORTUNIDADE_NAO_ENCONTRADA', 'Oportunidade nao encontrada');
    }

    const conversa = await this.conversas.porOportunidade(empresaId, oportunidadeId);
    const conexao = conversa.conexaoId
      ? await this.prisma.conexaoWhatsApp.findUnique({ where: { id: conversa.conexaoId } })
      : null;
    const destino = extrairJidEnvio(conversa.estadoBot) ?? conversa.telefone;
    const nomeInstancia = conexao?.nomeInstancia ?? 'mock';

    let arquivoId = entrada.arquivoId ?? null;
    let mensagem;

    if (arquivoId) {
      const { arquivo, buffer } = await this.arquivos.conteudo(empresaId, arquivoId);
      await this.prisma.arquivo.update({
        where: { id: arquivo.id },
        data: { entidade: 'ORCAMENTO', entidadeId: oportunidadeId },
      });
      const envio = await this.provider.enviarMidia(nomeInstancia, destino, {
        buffer,
        mime: arquivo.tipoMime,
        nome: arquivo.nome,
        caption: entrada.texto.slice(0, 1024),
      });
      if (envio.status === 'ERRO') {
        throw Erros.invalido(
          'FALHA_ENVIO_ARQUIVO',
          envio.erro || 'Nao foi possivel enviar o arquivo pelo WhatsApp',
        );
      }
      mensagem = await this.mensagens.registrar(empresaId, conversa.id, {
        direcao: DirecaoMensagem.ENVIADA,
        tipo: TipoMensagem.DOCUMENTO,
        conteudo: entrada.texto,
        status: StatusMensagem.ENVIADA,
        remetente: 'atendente',
        autorUsuarioId: usuarioId,
        idExterno: envio.idExterno ?? null,
        arquivoId: arquivo.id,
      });
      if (entrada.texto.length > 1024) {
        await this.enviarERegistrar(empresaId, conversa.id, {
          nomeInstancia,
          telefone: destino,
          texto: entrada.texto.slice(1024),
          remetente: 'atendente',
          autorUsuarioId: usuarioId,
        });
      }
    } else {
      mensagem = await this.enviarERegistrar(empresaId, conversa.id, {
        nomeInstancia,
        telefone: destino,
        texto: entrada.texto,
        remetente: 'atendente',
        autorUsuarioId: usuarioId,
      });
    }

    await this.prisma.conversa.update({
      where: { id: conversa.id },
      data: {
        modo: ModoAtendimento.HUMANO,
        status: StatusConversa.EM_ATENDIMENTO,
        atendenteId: usuarioId,
      },
    });

    const atuais = (oportunidade.dadosPersonalizados ?? {}) as Record<string, unknown>;
    await this.prisma.oportunidade.update({
      where: { id: oportunidadeId },
      data: {
        valorEstimado: entrada.valorEstimado,
        ...(arquivoId
          ? {
              dadosPersonalizados: {
                ...atuais,
                orcamento_arquivo_id: arquivoId,
              } as object,
            }
          : {}),
      },
    });

    await this.eventos.registrar(this.prisma, {
      empresaId,
      oportunidadeId,
      tipo: TipoEvento.ORCAMENTO_ENVIADO,
      titulo: 'Orçamento enviado pelo WhatsApp',
      descricao: `Proposta de ${entrada.valorEstimado.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })} enviada ao cliente.`,
      origem: OrigemHistoricoEtapa.ORCAMENTO_WHATSAPP,
      usuarioId,
    });

    try {
      await this.oportunidades.moverPorChave(
        empresaId,
        oportunidadeId,
        ChaveEtapaSistema.NEGOCIACAO,
        OrigemHistoricoEtapa.ORCAMENTO_WHATSAPP,
        usuarioId,
      );
    } catch (erro) {
      this.logger.warn(
        `Falha ao avançar funil após orçamento: ${(erro as Error).message}`,
      );
    }

    return {
      mensagem,
      oportunidadeId,
      conversaId: conversa.id,
      valorEstimado: entrada.valorEstimado,
      arquivoId,
    };
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

  private async salvarMidiaRecebida(
    empresaId: string,
    conversaId: string,
    entrada: MensagemRecebidaEntrada,
  ): Promise<{
    tipo: TipoMensagem;
    conteudo: string;
    arquivoId: string | null;
    nomeArquivo: string;
  } | null> {
    const midia = entrada.midia;
    if (!midia) return null;

    const nomeArquivo = midia.nome || 'arquivo';
    const conteudo = midia.caption?.trim() || entrada.texto.trim() || nomeArquivo;

    if (!this.provider.baixarMidia) {
      return { tipo: midia.tipo, conteudo, arquivoId: null, nomeArquivo };
    }

    try {
      const baixada = await this.provider.baixarMidia(entrada.nomeInstancia, midia.itemEvo);
      if (!baixada) {
        this.logger.warn(`Mídia sem bytes id=${entrada.idExterno ?? '?'} nome=${nomeArquivo}`);
        return { tipo: midia.tipo, conteudo, arquivoId: null, nomeArquivo };
      }
      if (baixada.buffer.length > TAMANHO_MAX_MIDIA_BYTES) {
        this.logger.warn(
          `Mídia acima de 20MB ignorada id=${entrada.idExterno ?? '?'} bytes=${baixada.buffer.length}`,
        );
        return { tipo: midia.tipo, conteudo, arquivoId: null, nomeArquivo };
      }

      const arquivo = await this.arquivos.enviar(empresaId, null, {
        nome: nomeArquivo || baixada.nome,
        tipoMime: baixada.mime || midia.mime,
        conteudo: baixada.buffer,
        entidade: 'CONVERSA',
        entidadeId: conversaId,
      });
      this.logger.log(`Arquivo WhatsApp salvo id=${arquivo.id} nome=${arquivo.nome}`);
      return {
        tipo: midia.tipo,
        conteudo: midia.caption?.trim() || arquivo.nome,
        arquivoId: arquivo.id,
        nomeArquivo: arquivo.nome,
      };
    } catch (erro) {
      this.logger.error(`Falha ao salvar mídia WhatsApp: ${(erro as Error).message}`);
      return { tipo: midia.tipo, conteudo, arquivoId: null, nomeArquivo };
    }
  }

  private async vincularArquivoOportunidade(
    empresaId: string,
    arquivoId: string | null | undefined,
    oportunidadeId: string | null | undefined,
    nomeArquivo?: string,
  ): Promise<void> {
    if (!arquivoId || !oportunidadeId) return;
    try {
      await this.prisma.arquivo.update({
        where: { id: arquivoId },
        data: { entidade: 'LISTA_MATERIAIS', entidadeId: oportunidadeId },
      });
      const oportunidade = await this.prisma.oportunidade.findFirst({
        where: { id: oportunidadeId, empresaId },
        select: { dadosPersonalizados: true },
      });
      if (!oportunidade) return;
      const atuais = (oportunidade.dadosPersonalizados ?? {}) as Record<string, unknown>;
      await this.prisma.oportunidade.update({
        where: { id: oportunidadeId },
        data: {
          dadosPersonalizados: {
            ...atuais,
            ...(nomeArquivo ? { arquivo_lista: nomeArquivo } : {}),
            arquivo_id: arquivoId,
          } as object,
        },
      });
    } catch (erro) {
      this.logger.warn(
        `Não foi possível vincular arquivo ${arquivoId} à oportunidade: ${(erro as Error).message}`,
      );
    }
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

function fluxoDoEstado(estadoBot: unknown): string | undefined {
  if (!estadoBot || typeof estadoBot !== 'object' || Array.isArray(estadoBot)) return undefined;
  const fluxo = (estadoBot as { fluxo?: unknown }).fluxo;
  return typeof fluxo === 'string' ? fluxo : undefined;
}
