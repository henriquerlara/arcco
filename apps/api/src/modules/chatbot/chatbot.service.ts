import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ModoAtendimento,
  OrigemHistoricoEtapa,
  ChaveEtapaSistema,
  DirecaoMensagem,
  TipoMensagem,
  StatusMensagem,
  TipoAtividade,
  PerfilUsuario,
  configuracoesEmpresaSchema,
  estadoBotSchema,
  type EstadoBot,
} from '@arcco/contratos';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { PrismaService } from '../../database/prisma.service';
import { AI_PROVIDER, type AIProvider } from '../ia/ia.provider';
import { ConversasService } from '../conversas/conversas.service';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { AtividadesService } from '../atividades/atividades.service';
import { estaEmHorarioAtendimento } from '../../common/utils/horario';
import { normalizarTelefone } from '../../common/utils/telefone';
import { atribuirVendedor } from '../../common/utils/distribuicao';
import { intencaoPorOpcaoMenu } from '../ia/regras-intencao';
import { avancarChatbot, FLUXO } from './maquina-estados';
import { lerAjustes, novoItemAjuste, persistirAjustes } from '../../common/utils/ajustes-persistir';

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

function normalizarCpf(valor: string): string {
  return valor.replace(/\D/g, '');
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger('Chatbot');

  constructor(
    private readonly prisma: PrismaService,
    private readonly platform: PlatformPrismaService,
    private readonly conversas: ConversasService,
    private readonly oportunidades: OportunidadesService,
    private readonly atividades: AtividadesService,
    @Inject(AI_PROVIDER) private readonly ia: AIProvider,
  ) {}

  /**
   * Processa uma mensagem recebida em uma conversa e retorna as respostas do bot.
   * Nao responde quando a conversa esta em modo HUMANO ou PAUSADO.
   */
  async processar(conversa: Conversa, texto: string): Promise<ResultadoChatbot> {
    const atual = await this.prisma.conversa.findUnique({
      where: { id: conversa.id },
      select: { modo: true },
    });
    const modo = atual?.modo ?? conversa.modo;
    if (modo === ModoAtendimento.HUMANO || modo === ModoAtendimento.PAUSADO) {
      return { respostas: [], transferido: false };
    }

    const empresa = await this.platform.empresa.findUnique({ where: { id: conversa.empresaId } });
    const config = configuracoesEmpresaSchema.parse(empresa?.configuracoes ?? {});

    if (!config.chatbot.ativo) {
      await this.conversas.transferirParaHumano(conversa.empresaId, conversa.id);
      return { respostas: [], transferido: true };
    }

    const estado: EstadoBot = estadoBotSchema.parse(conversa.estadoBot ?? {});
    const emHorario = estaEmHorarioAtendimento(config.horarioAtendimento);

    let cadastroEncontrado: boolean | undefined;
    if (estado.fluxo === FLUXO.VENDAS && estado.etapa === 'novo_cpf') {
      cadastroEncontrado = await this.buscarCadastroPorCpf(conversa.empresaId, texto);
    }

    const intencaoIa = await this.ia.classificarIntencao(texto, {
      segmento: empresa?.segmento,
    });

    const saida = avancarChatbot({
      texto,
      estado,
      cadastroEncontrado,
      intencao: intencaoIa.intencao,
      opcaoMenu: intencaoPorOpcaoMenu(texto),
      config: config.chatbot,
      emHorario,
    });

    let transferido = false;
    let oportunidadeId: string | undefined;

    if (saida.acao === 'TRANSFERIR' || saida.acao === 'CRIAR_OPORTUNIDADE') {
      if (saida.acao === 'CRIAR_OPORTUNIDADE' && saida.dadosOportunidade) {
        try {
          const oportunidade = await this.criarOportunidade(conversa, saida.dadosOportunidade);
          oportunidadeId = oportunidade.id;
          await this.conversas.vincularOportunidade(conversa.id, oportunidade.id);
          await this.avisarEquipeAjuste(conversa, oportunidade, saida.dadosOportunidade);
        } catch (erro) {
          this.logger.error(`Falha ao criar oportunidade via chatbot: ${(erro as Error).message}`);
        }
      }

      if (saida.novoEstado.resumo) {
        await this.registrarResumoInterno(conversa, saida.novoEstado.resumo);
      }

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

  /** Busca contato com CPF em dadosPersonalizados.cpf (somente dígitos). */
  private async buscarCadastroPorCpf(empresaId: string, cpfInformado: string): Promise<boolean> {
    const cpf = normalizarCpf(cpfInformado);
    if (cpf.length < 11) return false;

    const contatos = await this.prisma.contato.findMany({
      where: { empresaId },
      select: { dadosPersonalizados: true },
      take: 5000,
    });

    return contatos.some((c) => {
      const dados = (c.dadosPersonalizados ?? {}) as Record<string, unknown>;
      const candidato = dados.cpf ?? dados.CPF ?? dados.documento;
      if (typeof candidato !== 'string' && typeof candidato !== 'number') return false;
      return normalizarCpf(String(candidato)) === cpf;
    });
  }

  /** Mensagem interna (não enviada ao WhatsApp) com o resumo da triagem. */
  private async registrarResumoInterno(conversa: Conversa, resumo: string) {
    try {
      await this.prisma.mensagem.create({
        data: {
          empresaId: conversa.empresaId,
          conversaId: conversa.id,
          direcao: DirecaoMensagem.ENVIADA,
          tipo: TipoMensagem.SISTEMA,
          conteudo: `[Resumo da triagem]\n${resumo}`,
          status: StatusMensagem.ENVIADA,
          remetente: 'bot',
          metadados: { interno: true, tipo: 'resumo_triagem' },
        },
      });
    } catch (erro) {
      this.logger.warn(`Não foi possível gravar resumo interno: ${(erro as Error).message}`);
    }
  }

  private async criarOportunidade(
    conversa: Conversa,
    dados: {
      titulo?: string;
      nome?: string;
      necessidade?: string;
      descricao?: string;
      codigoOrcamento?: string;
      campos: Record<string, unknown>;
    },
  ) {
    const infos = Object.fromEntries(
      Object.entries(dados.campos).filter(
        ([, v]) => v !== undefined && v !== null && String(v).trim() !== '',
      ),
    );

    if (String(infos.tipo_solicitacao ?? '').toLowerCase().includes('ajuste') && dados.descricao?.trim()) {
      const item = novoItemAjuste(dados.descricao.trim());
      Object.assign(infos, persistirAjustes(infos, [item]));
    }

    const codigo = dados.codigoOrcamento?.trim();
    if (codigo) {
      const existente = await this.prisma.oportunidade.findFirst({
        where: {
          empresaId: conversa.empresaId,
          OR: [{ codigo }, { codigoOrcamento: codigo }],
        },
        select: { id: true, descricao: true, codigoOrcamento: true, dadosPersonalizados: true },
      });
      if (existente) {
        const atuais = (existente.dadosPersonalizados ?? {}) as Record<string, unknown>;
        const ehAjuste = String(
          infos.tipo_solicitacao ?? atuais.tipo_solicitacao ?? '',
        )
          .toLowerCase()
          .includes('ajuste');
        let personalizados = { ...atuais, ...infos };
        let descricao = existente.descricao;

        if (ehAjuste && dados.descricao?.trim()) {
          const ajustes = lerAjustes(atuais, existente.descricao);
          ajustes.push(novoItemAjuste(dados.descricao.trim()));
          personalizados = persistirAjustes(personalizados, ajustes);
          descricao = ajustes.map((item) => item.texto).join('\n\n');
        } else {
          descricao =
            [existente.descricao?.trim(), dados.descricao?.trim()].filter(Boolean).join('\n\n') ||
            existente.descricao;
        }

        await this.prisma.oportunidade.update({
          where: { id: existente.id },
          data: {
            descricao: descricao || existente.descricao,
            codigoOrcamento: existente.codigoOrcamento || codigo,
            prioridade: 'ALTA',
            dadosPersonalizados: personalizados as object,
          },
        });
        return this.oportunidades.obter(conversa.empresaId, existente.id);
      }
    }

    const contatoId = await this.garantirContato(conversa, dados.nome, dados.campos);
    const titulo = dados.titulo?.trim() || dados.necessidade?.trim();
    const responsavelId = await this.escolherResponsavel(conversa.empresaId);

    const opcoesCriacao = {
      origemHistorico: OrigemHistoricoEtapa.CHATBOT,
      // Orçamento (QUALIFICACAO): dados coletados; time envia a proposta pelo CRM.
      chaveSistemaEtapa: ChaveEtapaSistema.QUALIFICACAO,
    } as const;

    const oportunidade = await this.oportunidades.criar(
      conversa.empresaId,
      {
        titulo,
        contatoId,
        origem: 'whatsapp',
        responsavelId,
        prioridade: String(infos.tipo_solicitacao ?? '').toLowerCase().includes('ajuste')
          ? 'ALTA'
          : 'MEDIA',
        descricao: dados.descricao,
        codigoOrcamento: codigo,
        dadosPersonalizados: {},
      } as Parameters<OportunidadesService['criar']>[1],
      opcoesCriacao,
    );

    // Campos do bot ficam em dadosPersonalizados (itens separados na UI),
    // sem passar pela validação de campos personalizados do segmento.
    if (Object.keys(infos).length > 0) {
      await this.prisma.oportunidade.update({
        where: { id: oportunidade.id },
        data: { dadosPersonalizados: infos as object },
      });
    }

    return this.oportunidades.obter(conversa.empresaId, oportunidade.id);
  }

  /** Agenda + preview da conversa para o time ver o ajuste sem caçar no kanban. */
  private async avisarEquipeAjuste(
    conversa: Conversa,
    oportunidade: { id: string; contatoId: string; codigo: string; responsavelId?: string | null },
    dados: { descricao?: string; codigoOrcamento?: string; campos: Record<string, unknown> },
  ) {
    const tipo = String(dados.campos.tipo_solicitacao ?? '');
    if (!tipo.toLowerCase().includes('ajuste')) return;

    const ajuste = dados.descricao?.trim() || 'Cliente pediu ajuste de orçamento.';
    const codigo = dados.codigoOrcamento?.trim() || oportunidade.codigo;
    const preview = `Ajuste ${codigo}: ${ajuste}`.slice(0, 120);

    await this.prisma.conversa.update({
      where: { id: conversa.id },
      data: { ultimaMensagemPreview: preview, ultimaMensagemEm: new Date() },
    });

    const responsavelId =
      oportunidade.responsavelId ??
      (
        await this.platform.usuario.findFirst({
          where: { empresaId: conversa.empresaId, ativo: true },
          orderBy: { criadoEm: 'asc' },
          select: { id: true },
        })
      )?.id;
    if (!responsavelId) return;

    try {
      await this.atividades.criar(conversa.empresaId, responsavelId, {
        tipo: TipoAtividade.REVISAR_ORCAMENTO,
        titulo: `Ajuste de orçamento ${codigo}`,
        descricao: ajuste,
        vencimento: new Date(),
        oportunidadeId: oportunidade.id,
        contatoId: oportunidade.contatoId || conversa.contatoId || undefined,
      });
    } catch (erro) {
      this.logger.warn(`Não foi possível criar tarefa de ajuste: ${(erro as Error).message}`);
    }
  }

  private async escolherResponsavel(empresaId: string): Promise<string | null> {
    const usuarios = await this.platform.usuario.findMany({
      where: { empresaId, ativo: true },
      select: { id: true, perfil: true },
      orderBy: { criadoEm: 'asc' },
    });
    if (usuarios.length === 0) return null;

    const vendedores = usuarios.filter((u) => u.perfil === PerfilUsuario.VENDEDOR);
    const pool = vendedores.length > 0 ? vendedores : usuarios;

    const cargas = await this.prisma.oportunidade.groupBy({
      by: ['responsavelId'],
      where: {
        empresaId,
        fechadaEm: null,
        responsavelId: { in: pool.map((u) => u.id) },
      },
      _count: { _all: true },
    });
    const cargaPorId = new Map(
      cargas
        .filter((c) => c.responsavelId)
        .map((c) => [c.responsavelId!, c._count._all]),
    );

    const escolhido = atribuirVendedor(
      pool.map((u) => ({
        id: u.id,
        ativo: true,
        cargaAtual: cargaPorId.get(u.id) ?? 0,
      })),
    );
    return escolhido?.id ?? null;
  }

  private async garantirContato(
    conversa: Conversa,
    nome?: string,
    campos?: Record<string, unknown>,
  ): Promise<string> {
    if (conversa.contatoId) {
      if (campos?.cpf) {
        await this.atualizarCpfContato(conversa.contatoId, String(campos.cpf));
      }
      return conversa.contatoId;
    }

    const telefoneNormalizado = normalizarTelefone(conversa.telefone);
    const existente = await this.prisma.contato.findUnique({
      where: {
        empresaId_telefoneNormalizado: { empresaId: conversa.empresaId, telefoneNormalizado },
      },
    });
    if (existente) {
      if (campos?.cpf) await this.atualizarCpfContato(existente.id, String(campos.cpf));
      await this.conversas.vincularContato(conversa.id, existente.id);
      return existente.id;
    }

    const dadosPersonalizados: Record<string, unknown> = {};
    if (campos?.cpf) dadosPersonalizados.cpf = normalizarCpf(String(campos.cpf));
    if (campos?.enderecoObra) dadosPersonalizados.enderecoObra = campos.enderecoObra;

    const contato = await this.prisma.contato.create({
      data: {
        empresaId: conversa.empresaId,
        nome: nome || conversa.nomeContato || 'Contato WhatsApp',
        telefone: conversa.telefone,
        telefoneNormalizado,
        origem: 'whatsapp',
        dadosPersonalizados: dadosPersonalizados as object,
      },
    });
    await this.conversas.vincularContato(conversa.id, contato.id);
    return contato.id;
  }

  private async atualizarCpfContato(contatoId: string, cpf: string) {
    const contato = await this.prisma.contato.findUnique({ where: { id: contatoId } });
    if (!contato) return;
    const dados = { ...((contato.dadosPersonalizados ?? {}) as Record<string, unknown>) };
    dados.cpf = normalizarCpf(cpf);
    await this.prisma.contato.update({
      where: { id: contatoId },
      data: { dadosPersonalizados: dados as object },
    });
  }
}
