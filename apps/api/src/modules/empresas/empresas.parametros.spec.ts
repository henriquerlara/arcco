import { describe, expect, it } from 'vitest';
import {
  PersonalizacaoComercial,
  TipoAuditoria,
  configuracoesEmpresaPadrao,
  parametrosFiscaisCompletos,
} from '@arcco/contratos';
import { EmpresasService } from './empresas.service';
import type { PlatformPrismaService } from '../../database/platform-prisma.service';

interface EmpresaFake {
  id: string;
  nome: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  inscricaoEstadual: string | null;
  enderecoFiscal: unknown;
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

describe('ECOL-02 EmpresasService parametros comerciais', () => {
  const auditoriaChamadas: Array<{ tipo: string; anterior: unknown; posterior: unknown }> = [];

  function servico(empresas: EmpresaFake[]) {
    auditoriaChamadas.length = 0;
    return new EmpresasService(
      prismaFake(empresas),
      {} as never,
      {
        registrar: async (_tx: unknown, e: { tipo: string; anterior: unknown; posterior: unknown }) => {
          auditoriaChamadas.push(e);
        },
      } as never,
    );
  }

  function empresaEcolume(overrides: Partial<EmpresaFake> = {}): EmpresaFake {
    const base = configuracoesEmpresaPadrao();
    return {
      id: 'emp-eco',
      nome: 'Ecolume',
      nomeFantasia: null,
      cnpj: null,
      inscricaoEstadual: null,
      enderecoFiscal: null,
      configuracoes: {
        ...base,
        personalizacaoComercial: PersonalizacaoComercial.ECOLUME,
      },
      ...overrides,
    };
  }

  it('defaults e atualização sem deploy (JSON)', async () => {
    const empresas = [empresaEcolume()];
    const s = servico(empresas);
    const antes = await s.obterParametrosComerciais('emp-eco');
    expect(antes.diasOrcamentoSemMovimentacao).toBe(7);
    expect(antes.rtPadraoParceiro).toBe(10);
    expect(antes.descontoMaximoPercentual).toBeNull();
    expect(antes.baseRtComissao).toBe('TOTAL_PEDIDO');
    expect(antes.certificado?.tokenFocusConfigurado).toBe(false);
    expect(antes).not.toHaveProperty('FOCUS_NFE_TOKEN');
    expect(antes.certificado).not.toHaveProperty('senha');
    expect(antes.certificado).not.toHaveProperty('password');
    // documentação pode citar o nome da env var; valor secreto não vem na API
    expect(antes.certificado?.armazenamentoSegredo).toMatch(/ambiente do servidor/i);

    await s.atualizarParametrosComerciais(
      'emp-eco',
      { diasOrcamentoSemMovimentacao: 4, rtPadraoParceiro: 15, descontoMaximoPercentual: 12 },
      { id: 'u1', perfil: 'GESTOR' },
    );
    const depois = await s.obterParametrosComerciais('emp-eco');
    expect(depois.diasOrcamentoSemMovimentacao).toBe(4);
    expect(depois.rtPadraoParceiro).toBe(15);
    expect(depois.descontoMaximoPercentual).toBe(12);
    expect(auditoriaChamadas[0]?.tipo).toBe(TipoAuditoria.ALTERACAO_PARAMETRO_COMERCIAL);
  });

  it('isolamento: legado PADRAO não acessa', async () => {
    const base = configuracoesEmpresaPadrao();
    const empresas = [
      empresaEcolume(),
      {
        id: 'emp-pad',
        nome: 'Padrao',
        nomeFantasia: null,
        cnpj: null,
        inscricaoEstadual: null,
        enderecoFiscal: null,
        configuracoes: { ...base },
      },
    ];
    const s = servico(empresas);
    await expect(s.obterParametrosComerciais('emp-pad')).rejects.toThrow(/ECOLUME|Parametros/i);
    // ecolume permanece intacta
    const eco = await s.obterParametrosComerciais('emp-eco');
    expect(eco.rtPadraoParceiro).toBe(10);
  });

  it('P3 incompleta: parametrosFiscaisCompletos false e sem segredo na resposta', async () => {
    const empresas = [empresaEcolume()];
    const s = servico(empresas);
    const p = await s.obterParametrosComerciais('emp-eco');
    expect(parametrosFiscaisCompletos(p.fiscal)).toBe(false);
    expect(p).not.toHaveProperty('token');
    expect(p.certificado).not.toHaveProperty('senha');
  });

  it('motivos de perda editáveis preservam estrutura', async () => {
    const empresas = [empresaEcolume()];
    const s = servico(empresas);
    await s.atualizarParametrosComerciais(
      'emp-eco',
      {
        motivosPerda: [
          { codigo: 'PRECO', rotulo: 'Preço alto', exigeDescricao: false },
          { codigo: 'OUTRO', rotulo: 'Outro', exigeDescricao: true },
        ],
      },
      { id: 'u1', perfil: 'GESTOR' },
    );
    const p = await s.obterParametrosComerciais('emp-eco');
    expect(p.motivosPerda).toHaveLength(2);
    expect(p.motivosPerda[0]?.codigo).toBe('PRECO');
  });
});
