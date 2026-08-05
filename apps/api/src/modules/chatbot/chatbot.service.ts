import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  EntidadeCampoPersonalizado,
  ModoAtendimento,
  OrigemHistoricoEtapa,
  ChaveEtapaSistema,
  configuracoesEmpresaSchema,
  estadoBotSchema,
  type EstadoBot,
} from '@arcco/contratos';
import { PrismaService } from '../../database/prisma.service';
import { AI_PROVIDER, type AIProvider } from '../ia/ia.provider';
import { ConversasService } from '../conversas/conversas.service';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { estaEmHorarioAtendimento } from '../../common/utils/horario';
import { normalizarTelefone } from '../../common/utils/telefone';
import { intencaoPorOpcaoMenu } from '../ia/regras-intencao';
import { avancarChatbot, type PerguntaCampo } from './maquina-estados';

export interface ResultadoChatbot {
  respostas: string[];
  transferido: boolean;
  oportunidadeId?: string;
}

interface Conversa {
  id: string;
  empresaId: string;
  contatoId: string | null;
  telefone: string;
  nomeContato: string | null;
  modo: string;
  estadoBot: unknown;
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger('Chatbot');

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversas: ConversasService,
    private readonly oportunidades: OportunidadesService,
    @Inject(AI_PROVIDER) private readonly ia: AIProvider,
  ) {}

  /**
   * Processa uma mensagem recebida em uma conversa e retorna as respostas do bot.
   * Nao responde quando a conversa esta em modo HUMANO ou PAUSADO.
   */
  async processar(conversa: Conversa, texto: string): Promise<ResultadoChatbot> {
    if (conversa.modo === ModoAtendimento.HUMANO || conversa.modo === ModoAtendimento.PAUSADO) {
      return { respostas: [], transferido: false };
    }

    const empresa = await this.prisma.empresa.findUnique({ where: { id: conversa.empresaId } });
    const config = configuracoesEmpresaSchema.parse(empresa?.configuracoes ?? {});

    if (!config.chatbot.ativo) {
      await this.conversas.transferirParaHumano(conversa.empresaId, conversa.id);
      return { respostas: [], transferido: true };
    }

    const estado: EstadoBot = estadoBotSchema.parse(conversa.estadoBot ?? {});
    const emHorario = estaEmHorarioAtendimento(config.horarioAtendimento);

    const camposChatbot = await this.prisma.campoPersonalizado.findMany({
      where: {
        empresaId: conversa.empresaId,
        entidade: EntidadeCampoPersonalizado.OPORTUNIDADE,
        ativo: true,
        usarNoChatbot: true,
      },
      orderBy: { ordem: 'asc' },
    });

    const perguntasCampos: PerguntaCampo[] = camposChatbot.map((c) => ({
      chave: c.chave,
      texto: c.textoPergunta?.trim() || `Informe ${c.rotulo}`,
    }));

    const intencaoIa = await this.ia.classificarIntencao(texto, {
      segmento: empresa?.segmento,
    });

    const saida = avancarChatbot({
      texto,
      estado,
      intencao: intencaoIa.intencao,
      opcaoMenu: intencaoPorOpcaoMenu(texto),
      contatoConhecido: Boolean(conversa.contatoId),
      nomeContato: conversa.nomeContato,
      perguntasCampos,
      config: config.chatbot,
      emHorario,
    });

    let transferido = false;
    let oportunidadeId: string | undefined;

    if (saida.acao === 'TRANSFERIR') {
      await this.conversas.transferirParaHumano(conversa.empresaId, conversa.id);
      transferido = true;
    } else if (saida.acao === 'CRIAR_OPORTUNIDADE' && saida.dadosOportunidade) {
      try {
        const oportunidade = await this.criarOportunidade(conversa, saida.dadosOportunidade);
        oportunidadeId = oportunidade.id;
        await this.conversas.vincularOportunidade(conversa.id, oportunidade.id);
      } catch (erro) {
        this.logger.error(`Falha ao criar oportunidade via chatbot: ${(erro as Error).message}`);
      }
      // Apos registrar o orcamento, encaminha para atendimento humano.
      await this.conversas.transferirParaHumano(conversa.empresaId, conversa.id);
      transferido = true;
    }

    const jidEnvio =
      typeof (conversa.estadoBot as { jidEnvio?: unknown } | null)?.jidEnvio === 'string'
        ? (conversa.estadoBot as { jidEnvio: string }).jidEnvio
        : undefined;

    await this.conversas.atualizarEstadoBot(
      conversa.id,
      { ...saida.novoEstado, ...(jidEnvio ? { jidEnvio } : {}) },
      intencaoIa.intencao,
    );

    return { respostas: saida.respostas, transferido, oportunidadeId };
  }

  private async criarOportunidade(
    conversa: Conversa,
    dados: { nome?: string; necessidade?: string; campos: Record<string, unknown> },
  ) {
    const contatoId = await this.garantirContato(conversa, dados.nome);
    const titulo = dados.necessidade?.slice(0, 120) || 'Orcamento via WhatsApp';

    const opcoesCriacao = {
      origemHistorico: OrigemHistoricoEtapa.CHATBOT,
      chaveSistemaEtapa: ChaveEtapaSistema.QUALIFICACAO,
    } as const;

    try {
      return await this.oportunidades.criar(
        conversa.empresaId,
        {
          titulo,
          contatoId,
          descricao: dados.necessidade,
          origem: 'whatsapp',
          prioridade: 'MEDIA',
          dadosPersonalizados: dados.campos,
        } as Parameters<OportunidadesService['criar']>[1],
        opcoesCriacao,
      );
    } catch {
      // Se a validacao de campos personalizados falhar, cria sem eles (dados sao best-effort).
      return this.oportunidades.criar(
        conversa.empresaId,
        {
          titulo,
          contatoId,
          descricao: dados.necessidade,
          origem: 'whatsapp',
          prioridade: 'MEDIA',
          dadosPersonalizados: {},
        } as Parameters<OportunidadesService['criar']>[1],
        opcoesCriacao,
      );
    }
  }

  private async garantirContato(conversa: Conversa, nome?: string): Promise<string> {
    if (conversa.contatoId) return conversa.contatoId;

    const telefoneNormalizado = normalizarTelefone(conversa.telefone);
    const existente = await this.prisma.contato.findUnique({
      where: {
        empresaId_telefoneNormalizado: { empresaId: conversa.empresaId, telefoneNormalizado },
      },
    });
    if (existente) {
      await this.conversas.vincularContato(conversa.id, existente.id);
      return existente.id;
    }

    const contato = await this.prisma.contato.create({
      data: {
        empresaId: conversa.empresaId,
        nome: nome || conversa.nomeContato || 'Contato WhatsApp',
        telefone: conversa.telefone,
        telefoneNormalizado,
        origem: 'whatsapp',
        dadosPersonalizados: {},
      },
    });
    await this.conversas.vincularContato(conversa.id, contato.id);
    return contato.id;
  }
}
