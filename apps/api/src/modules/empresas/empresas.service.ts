import { Injectable } from '@nestjs/common';
import {
  configuracoesEmpresaPadrao,
  configuracoesEmpresaSchema,
  lerParametrosComerciais,
  parametrosComerciaisPadrao,
  PersonalizacaoComercial,
  TipoAuditoria,
  type ConfiguracoesEmpresa,
} from '@arcco/contratos';
import { Prisma } from '../../database/generated/platform';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { PrismaService } from '../../database/prisma.service';
import { Erros } from '../../common/erros/erros';
import { carregarEnv } from '../../config/env';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type {
  AtualizarEmpresaInput,
  AtualizarOnboardingInput,
  AtualizarParametrosComerciaisInput,
} from './empresas.schemas';

@Injectable()
export class EmpresasService {
  constructor(
    private readonly prisma: PlatformPrismaService,
    private readonly operacional: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  buscar(empresaId: string) {
    return this.prisma.empresa.findUnique({ where: { id: empresaId } });
  }

  async obter(empresaId: string) {
    const empresa = await this.buscar(empresaId);
    if (!empresa) throw Erros.naoEncontrado('EMPRESA_NAO_ENCONTRADA', 'Empresa nao encontrada');
    return empresa;
  }

  async atualizar(empresaId: string, dto: AtualizarEmpresaInput) {
    await this.obter(empresaId);
    return this.prisma.empresa.update({
      where: { id: empresaId },
      data: {
        nome: dto.nome,
        nomeFantasia: dto.nomeFantasia,
        segmento: dto.segmento,
        telefone: dto.telefone,
        cidade: dto.cidade,
        estado: dto.estado,
        logoArquivoId: dto.logoArquivoId,
        cnpj: dto.cnpj === undefined ? undefined : dto.cnpj?.replace(/\D/g, '') || null,
        inscricaoEstadual: dto.inscricaoEstadual,
        enderecoFiscal:
          dto.enderecoFiscal === undefined
            ? undefined
            : dto.enderecoFiscal === null
              ? Prisma.DbNull
              : (dto.enderecoFiscal as object),
      },
    });
  }

  private mesclarConfig(
    atualRaw: unknown,
    patch: Record<string, unknown>,
  ): ConfiguracoesEmpresa {
    const padrao = configuracoesEmpresaPadrao();
    const atual = {
      ...padrao,
      ...((atualRaw && typeof atualRaw === 'object' ? atualRaw : {}) as object),
    } as Record<string, unknown>;
    const mesclado = { ...atual, ...patch };
    return configuracoesEmpresaSchema.parse(mesclado);
  }

  async atualizarOnboarding(empresaId: string, dto: AtualizarOnboardingInput) {
    const empresa = await this.obter(empresaId);
    const atual = (empresa.configuracoes ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (dto.horarioAtendimento !== undefined) patch.horarioAtendimento = dto.horarioAtendimento;
    if (dto.chatbot !== undefined) {
      patch.chatbot = {
        ...((atual.chatbot as object) ?? {}),
        ...dto.chatbot,
      };
    }
    if (dto.onboardingConcluido !== undefined) {
      patch.onboardingConcluido = dto.onboardingConcluido;
    }
    const novas = this.mesclarConfig(atual, patch);
    return this.prisma.empresa.update({
      where: { id: empresaId },
      data: { configuracoes: novas as unknown as object },
    });
  }

  async obterConfiguracoes(empresaId: string): Promise<ConfiguracoesEmpresa> {
    const empresa = await this.obter(empresaId);
    return this.mesclarConfig(empresa.configuracoes, {});
  }

  /** ECOL-02 — leitura dos parâmetros comerciais (+ status certificado sem segredo). */
  async obterParametrosComerciais(empresaId: string) {
    const empresa = await this.obter(empresaId);
    const personalizacao =
      (empresa.configuracoes as { personalizacaoComercial?: string } | null)
        ?.personalizacaoComercial ?? PersonalizacaoComercial.PADRAO;
    if (personalizacao !== PersonalizacaoComercial.ECOLUME) {
      throw Erros.invalido(
        'PARAMETROS_ECOLUME_INDISPONIVEL',
        'Parametros comerciais so na personalizacao ECOLUME',
      );
    }
    const parametros = lerParametrosComerciais(empresa.configuracoes);
    const tokenFocus = Boolean(carregarEnv().FOCUS_NFE_TOKEN?.trim());
    return {
      ...parametros,
      sugestoesP6: {
        margemPadraoGlobal: 1.6,
        validadeOrcamentoDias: 15,
      },
      certificado: {
        tokenFocusConfigurado: tokenFocus,
        armazenamentoSegredo:
          'FOCUS_NFE_TOKEN e certificado A1 permanecem no ambiente do servidor (nao no JSON de configuracoes).',
        pendenciaP3:
          'Regime, CFOP, CSOSN/CST e textos dependem do contador (P3). Emissao real bloqueada enquanto incompleto.',
      },
      empresa: {
        id: empresa.id,
        nome: empresa.nome,
        nomeFantasia: empresa.nomeFantasia,
        cnpj: empresa.cnpj,
        inscricaoEstadual: empresa.inscricaoEstadual,
        enderecoFiscal: empresa.enderecoFiscal,
      },
    };
  }

  async atualizarParametrosComerciais(
    empresaId: string,
    dto: AtualizarParametrosComerciaisInput,
    ator: { id: string; perfil: string },
  ) {
    const empresa = await this.obter(empresaId);
    const personalizacao =
      (empresa.configuracoes as { personalizacaoComercial?: string } | null)
        ?.personalizacaoComercial ?? PersonalizacaoComercial.PADRAO;
    if (personalizacao !== PersonalizacaoComercial.ECOLUME) {
      throw Erros.invalido(
        'PARAMETROS_ECOLUME_INDISPONIVEL',
        'Parametros comerciais so na personalizacao ECOLUME',
      );
    }

    const anterior = lerParametrosComerciais(empresa.configuracoes);
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) {
      if (v !== undefined) patch[k] = v;
    }
    if (dto.baseRtComissao !== undefined) patch.baseRtComissao = 'TOTAL_PEDIDO';

    const novas = this.mesclarConfig(empresa.configuracoes, patch);
    const atualizada = await this.prisma.empresa.update({
      where: { id: empresaId },
      data: { configuracoes: novas as unknown as object },
    });
    const posterior = lerParametrosComerciais(atualizada.configuracoes);

    await this.auditoria.registrar(this.operacional, {
      empresaId,
      usuarioId: ator.id,
      tipo: TipoAuditoria.ALTERACAO_PARAMETRO_COMERCIAL,
      entidade: 'empresa_configuracoes',
      entidadeId: empresaId,
      anterior: {
        diasOrcamentoSemMovimentacao: anterior.diasOrcamentoSemMovimentacao,
        diasChecklistPendente: anterior.diasChecklistPendente,
        rtPadraoParceiro: anterior.rtPadraoParceiro,
        descontoMaximoPercentual: anterior.descontoMaximoPercentual,
        margemPadraoGlobal: anterior.margemPadraoGlobal,
        validadeOrcamentoDias: anterior.validadeOrcamentoDias,
        fiscal: {
          regime: anterior.fiscal.regimeTributario,
          cfop: anterior.fiscal.cfopPadrao,
        },
      },
      posterior: {
        diasOrcamentoSemMovimentacao: posterior.diasOrcamentoSemMovimentacao,
        diasChecklistPendente: posterior.diasChecklistPendente,
        rtPadraoParceiro: posterior.rtPadraoParceiro,
        descontoMaximoPercentual: posterior.descontoMaximoPercentual,
        margemPadraoGlobal: posterior.margemPadraoGlobal,
        validadeOrcamentoDias: posterior.validadeOrcamentoDias,
        fiscal: {
          regime: posterior.fiscal.regimeTributario,
          cfop: posterior.fiscal.cfopPadrao,
        },
      },
    });

    return this.obterParametrosComerciais(empresaId);
  }

  parametrosPadrao() {
    return parametrosComerciaisPadrao();
  }
}
