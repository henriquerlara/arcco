import { describe, expect, it } from 'vitest';
import { PersonalizacaoComercial, configuracoesEmpresaPadrao } from '@arcco/contratos';
import { EmpresasService } from './empresas.service';
import type { PlatformPrismaService } from '../../database/platform-prisma.service';

interface EmpresaFake {
  id: string;
  configuracoes: Record<string, unknown>;
}

function prismaFake(empresas: EmpresaFake[]): PlatformPrismaService {
  return {
    empresa: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        empresas.find((empresa) => empresa.id === where.id) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { configuracoes: Record<string, unknown> };
      }) => {
        const empresa = empresas.find((item) => item.id === where.id);
        if (!empresa) throw new Error('empresa ausente');
        empresa.configuracoes = data.configuracoes;
        return empresa;
      },
    },
  } as unknown as PlatformPrismaService;
}

describe('EmpresasService personalização comercial', () => {
  it('grava onboarding sem copiar a personalização de outra empresa e sem aceitar troca pelo cliente', async () => {
    const base = configuracoesEmpresaPadrao();
    const empresas: EmpresaFake[] = [
      {
        id: 'empresa-ecolume',
        configuracoes: {
          ...base,
          personalizacaoComercial: PersonalizacaoComercial.ECOLUME,
        },
      },
      {
        id: 'empresa-padrao',
        configuracoes: { ...base },
      },
    ];
    const servico = new EmpresasService(
      prismaFake(empresas),
      {} as never,
      { registrar: async () => undefined } as never,
    );

    await servico.atualizarOnboarding('empresa-ecolume', {
      onboardingConcluido: true,
      chatbot: { nome: 'Não deve ligar a outra empresa' },
    });

    expect(empresas[0]?.configuracoes.personalizacaoComercial).toBe(PersonalizacaoComercial.ECOLUME);
    expect(empresas[0]?.configuracoes.onboardingConcluido).toBe(true);
    expect(empresas[1]?.configuracoes.personalizacaoComercial).toBe(PersonalizacaoComercial.PADRAO);
    expect(empresas[1]?.configuracoes.onboardingConcluido).toBe(false);

    const lida = await servico.obterConfiguracoes('empresa-ecolume');
    expect(lida.personalizacaoComercial).toBe(PersonalizacaoComercial.ECOLUME);
    const outra = await servico.obterConfiguracoes('empresa-padrao');
    expect(outra.personalizacaoComercial).toBe(PersonalizacaoComercial.PADRAO);
  });
});
