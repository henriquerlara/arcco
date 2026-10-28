import { describe, expect, it } from 'vitest';
import {
  OrigemAuditoria,
  PerfilUsuario,
  PersonalizacaoComercial,
  TipoAuditoria,
} from '@arcco/contratos';
import { AppError } from '../../common/erros/erros';
import { AuditoriaService } from './auditoria.service';

function montar() {
  const opLogs = [
    {
      id: 'op-2',
      empresaId: 'emp-a',
      usuarioId: 'usr-1',
      tipo: TipoAuditoria.AJUSTE_ESTOQUE,
      entidade: 'produto',
      entidadeId: 'prod-1',
      criadoEm: new Date('2026-10-20T12:00:00.000Z'),
      anterior: { estoque: 1 },
      posterior: { estoque: 2, senha: 'segredo' },
    },
    {
      id: 'op-1',
      empresaId: 'emp-a',
      usuarioId: 'usr-1',
      tipo: TipoAuditoria.ALTERACAO_ST_FORNECEDOR,
      entidade: 'fornecedor',
      entidadeId: 'forn-1',
      criadoEm: new Date('2026-10-18T12:00:00.000Z'),
      anterior: { aliquotaSt: 10 },
      posterior: { aliquotaSt: 12 },
    },
  ];
  const platLogs = [
    {
      id: 'plat-1',
      empresaId: 'emp-a',
      usuarioId: 'usr-2',
      tipo: TipoAuditoria.ALTERACAO_PERMISSAO,
      entidade: 'usuario',
      entidadeId: 'usr-2',
      criadoEm: new Date('2026-10-21T12:00:00.000Z'),
      anterior: { chaves: [] },
      posterior: { chaves: ['VER_CUSTOS'] },
    },
  ];

  const platform = {
    empresa: {
      findUnique: async () => ({
        configuracoes: { personalizacaoComercial: PersonalizacaoComercial.ECOLUME },
      }),
    },
    usuario: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => ({ id, nome: id === 'usr-1' ? 'Ana' : 'Bruno' })),
    },
    logAuditoria: {
      findMany: async () => platLogs.map(({ anterior: _a, posterior: _p, ...rest }) => rest),
      findFirst: async ({ where }: { where: { id: string } }) =>
        platLogs.find((l) => l.id === where.id) ?? null,
    },
  };
  const operacional = {
    logAuditoria: {
      findMany: async () => opLogs.map(({ anterior: _a, posterior: _p, ...rest }) => rest),
      findFirst: async ({ where }: { where: { id: string } }) =>
        opLogs.find((l) => l.id === where.id) ?? null,
    },
  };
  return {
    servico: new AuditoriaService(platform as never, operacional as never),
  };
}

describe('auditoria consulta ECOL-27b', () => {
  it('mescla bancos, ordena do mais recente e pagina', async () => {
    const { servico } = montar();
    const pagina1 = await servico.listar(
      'emp-a',
      { id: 'admin', perfil: PerfilUsuario.PROPRIETARIO },
      { pagina: 1, porPagina: 2 },
    );
    expect(pagina1.dados).toHaveLength(2);
    expect(pagina1.dados[0].id).toBe('plat-1');
    expect(pagina1.dados[0].origem).toBe(OrigemAuditoria.PLATAFORMA);
    expect(pagina1.dados[0].usuarioNome).toBe('Bruno');
    expect(pagina1.dados[1].id).toBe('op-2');
    expect(pagina1.paginacao.total).toBe(3);

    const pagina2 = await servico.listar(
      'emp-a',
      { id: 'admin', perfil: PerfilUsuario.PROPRIETARIO },
      { pagina: 2, porPagina: 2 },
    );
    expect(pagina2.dados).toHaveLength(1);
    expect(pagina2.dados[0].tipo).toBe(TipoAuditoria.ALTERACAO_ST_FORNECEDOR);
  });

  it('bloqueia não administrador e detalhe redige segredos', async () => {
    const { servico } = montar();
    await expect(
      servico.listar('emp-a', { id: 'g', perfil: PerfilUsuario.GESTOR }, { pagina: 1, porPagina: 20 }),
    ).rejects.toBeInstanceOf(AppError);

    const detalhe = await servico.obter(
      'emp-a',
      { id: 'admin', perfil: PerfilUsuario.PROPRIETARIO },
      'op-2',
      OrigemAuditoria.OPERACIONAL,
    );
    expect(detalhe.posterior).toEqual({ estoque: 2 });
    expect(JSON.stringify(detalhe)).not.toContain('segredo');
  });
});
