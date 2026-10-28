import { describe, expect, it } from 'vitest';
import { PersonalizacaoComercial, TipoAuditoria } from '@arcco/contratos';
import { AppError } from '../../common/erros/erros';
import { AuditoriaService } from './auditoria.service';

function montar(configuracoes: unknown) {
  const gravados: Array<Record<string, unknown>> = [];
  const platform = {
    empresa: {
      findUnique: async () => ({ configuracoes }),
    },
  };
  const operacional = {
    logAuditoria: {
      findMany: async () => [],
      findFirst: async () => null,
    },
  };
  const servico = new AuditoriaService(platform as never, operacional as never);
  const tx = {
    logAuditoria: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        gravados.push(data);
        return data;
      },
    },
  };
  return { servico, gravados, tx };
}

const entrada = {
  empresaId: 'emp-a',
  usuarioId: 'usr-1',
  tipo: TipoAuditoria.ALTERACAO_PRECO,
  entidade: 'produto',
  entidadeId: 'prod-1',
  anterior: { precoVenda: 10, senha: 'Arcco@123', acesso: { token: 'segredo' } },
  posterior: { precoVenda: 12 },
};

describe('auditoria', () => {
  it('grava empresa, usuário, operação, entidade e o antes/depois sem segredo', async () => {
    const { servico, gravados, tx } = montar({ personalizacaoComercial: PersonalizacaoComercial.ECOLUME });
    await servico.registrar(tx as never, entrada);
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({
      empresaId: 'emp-a',
      usuarioId: 'usr-1',
      tipo: TipoAuditoria.ALTERACAO_PRECO,
      entidade: 'produto',
      entidadeId: 'prod-1',
      posterior: { precoVenda: 12 },
    });
    expect(gravados[0].anterior).toEqual({ precoVenda: 10, acesso: {} });
    expect(JSON.stringify(gravados[0])).not.toContain('Arcco@123');
    expect(JSON.stringify(gravados[0])).not.toContain('segredo');
  });

  it('empresa sem a flag não gera registro', async () => {
    const { servico, gravados, tx } = montar({ onboardingConcluido: true });
    await servico.registrar(tx as never, entrada);
    expect(gravados).toHaveLength(0);
  });

  it('tipo desconhecido não grava e impede o sucesso', async () => {
    const { servico, gravados, tx } = montar({ personalizacaoComercial: PersonalizacaoComercial.ECOLUME });
    await expect(
      servico.registrar(tx as never, { ...entrada, tipo: 'OUTRO' as TipoAuditoria }),
    ).rejects.toBeInstanceOf(AppError);
    expect(gravados).toHaveLength(0);
  });

  it('recusa alteração e exclusão para qualquer chamador', () => {
    const { servico } = montar({});
    expect(() => servico.alterar()).toThrow(AppError);
    expect(() => servico.excluir()).toThrow(AppError);
  });
});
