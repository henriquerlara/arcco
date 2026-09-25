import { Injectable } from '@nestjs/common';
import { configuracoesEmpresaSchema, type ConfiguracoesEmpresa } from '@arcco/contratos';
import { Prisma } from '../../database/generated/platform';
import { PlatformPrismaService } from '../../database/platform-prisma.service';
import { Erros } from '../../common/erros/erros';
import type { AtualizarEmpresaInput, AtualizarOnboardingInput } from './empresas.schemas';

@Injectable()
export class EmpresasService {
  constructor(private readonly prisma: PlatformPrismaService) {}

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

  async atualizarOnboarding(empresaId: string, dto: AtualizarOnboardingInput) {
    const empresa = await this.obter(empresaId);
    const atual = configuracoesEmpresaSchema.parse(empresa.configuracoes ?? {});

    const novas: ConfiguracoesEmpresa = {
      horarioAtendimento: dto.horarioAtendimento ?? atual.horarioAtendimento,
      chatbot: dto.chatbot ? { ...atual.chatbot, ...dto.chatbot } : atual.chatbot,
      onboardingConcluido:
        dto.onboardingConcluido ?? atual.onboardingConcluido ?? false,
      diasFollowUpOrcamento: atual.diasFollowUpOrcamento ?? 3,
    };

    return this.prisma.empresa.update({
      where: { id: empresaId },
      data: { configuracoes: novas as unknown as object },
    });
  }

  async obterConfiguracoes(empresaId: string): Promise<ConfiguracoesEmpresa> {
    const empresa = await this.obter(empresaId);
    return configuracoesEmpresaSchema.parse(empresa.configuracoes ?? {});
  }
}
