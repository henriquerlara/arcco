import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  PerfilUsuario,
  PermissaoComercial,
  TipoAuditoria,
} from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from './auditoria.service';
import { FornecedoresService } from '../fornecedores/fornecedores.service';
import { PermissoesService } from '../permissoes/permissoes.service';

/**
 * Banco local. ECOL_AUDIT=1 (mesma flag da 27a) exercita consulta + ST + isolamentoência.
 */
const ATIVO = process.env.ECOL_AUDIT === '1';
const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];
const CNPJ = '11222333000181';

describe.skipIf(!ATIVO)('ECOL-27b no banco', () => {
  const auditoria = new AuditoriaService(platform as never, operacional as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const fornecedores = new FornecedoresService(operacional as never, permissoes, auditoria);

  let ecolumeId = '';
  let outraId = '';
  let adminId = '';
  let gestorId = '';
  let fornecedorId = '';

  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.logAuditoria.deleteMany({ where: { empresaId } });
      await operacional.fornecedor.deleteMany({ where: { empresaId } });
      await platform.logAuditoria.deleteMany({ where: { empresaId } });
      await platform.concessaoPermissao.deleteMany({ where: { empresaId } });
      await platform.usuario.deleteMany({ where: { empresaId } });
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  });

  it('prepara empresas', async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `AUD27b ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const outra = await platform.empresa.create({
      data: {
        nome: `AUD27bB ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    empresas.push(ecolume.id, outra.id);
    ecolumeId = ecolume.id;
    outraId = outra.id;

    const admin = await platform.usuario.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Admin 27b',
        email: `ecol27b.admin.${sufixo}@teste.arcco.local`,
        senhaHash: 'nao-e-segredo',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    const gestor = await platform.usuario.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Gestor 27b',
        email: `ecol27b.gestor.${sufixo}@teste.arcco.local`,
        senhaHash: 'nao-e-segredo',
        perfil: PerfilUsuario.GESTOR,
      },
    });
    adminId = admin.id;
    gestorId = gestor.id;

    const forn = await fornecedores.criar(ecolumeId, {
      nome: 'ST Fornecedor',
      cnpj: CNPJ,
      aliquotaSt: 10,
    });
    fornecedorId = forn.id;
  });

  it('alteração de ST% grava log na mesma transação', async () => {
    await fornecedores.atualizar(ecolumeId, fornecedorId, { aliquotaSt: 18 }, adminId);
    const logs = await operacional.logAuditoria.findMany({
      where: { empresaId: ecolumeId, tipo: TipoAuditoria.ALTERACAO_ST_FORNECEDOR },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      usuarioId: adminId,
      entidade: 'fornecedor',
      entidadeId: fornecedorId,
    });
    expect(logs[0].anterior).toMatchObject({ aliquotaSt: 10 });
    expect(logs[0].posterior).toMatchObject({ aliquotaSt: 18 });

    // Mesmo ST% não gera segunda linha.
    await fornecedores.atualizar(ecolumeId, fornecedorId, { aliquotaSt: 18 }, adminId);
    expect(
      await operacional.logAuditoria.count({
        where: { empresaId: ecolumeId, tipo: TipoAuditoria.ALTERACAO_ST_FORNECEDOR },
      }),
    ).toBe(1);
  });

  it('falha do log de ST desfaz a alteração', async () => {
    const original = auditoria.registrar.bind(auditoria);
    auditoria.registrar = async () => {
      throw Object.assign(new Error('falha audit st'), { codigo: 'AUDITORIA_TESTE' });
    };
    await expect(
      fornecedores.atualizar(ecolumeId, fornecedorId, { aliquotaSt: 22 }, adminId),
    ).rejects.toThrow(/falha audit st/);
    auditoria.registrar = original;

    const forn = await operacional.fornecedor.findFirst({ where: { id: fornecedorId } });
    expect(Number(forn?.aliquotaSt)).toBe(18);
    expect(
      await operacional.logAuditoria.count({
        where: { empresaId: ecolumeId, tipo: TipoAuditoria.ALTERACAO_ST_FORNECEDOR },
      }),
    ).toBe(1);
  });

  it('consulta mescla, filtra, isola empresa e bloqueia gestor', async () => {
    await permissoes.conceder(
      ecolumeId,
      gestorId,
      [PermissaoComercial.VER_CUSTOS],
      adminId,
    );

    const lista = await auditoria.listar(
      ecolumeId,
      { id: adminId, perfil: PerfilUsuario.PROPRIETARIO },
      { pagina: 1, porPagina: 50 },
    );
    const tipos = lista.dados.map((d) => d.tipo);
    expect(tipos).toContain(TipoAuditoria.ALTERACAO_ST_FORNECEDOR);
    expect(tipos).toContain(TipoAuditoria.ALTERACAO_PERMISSAO);

    const soSt = await auditoria.listar(
      ecolumeId,
      { id: adminId, perfil: PerfilUsuario.PROPRIETARIO },
      { pagina: 1, porPagina: 20, tipo: TipoAuditoria.ALTERACAO_ST_FORNECEDOR },
    );
    expect(soSt.dados.every((d) => d.tipo === TipoAuditoria.ALTERACAO_ST_FORNECEDOR)).toBe(true);

    const soUsuario = await auditoria.listar(
      ecolumeId,
      { id: adminId, perfil: PerfilUsuario.PROPRIETARIO },
      { pagina: 1, porPagina: 20, usuarioId: adminId },
    );
    expect(soUsuario.dados.every((d) => d.usuarioId === adminId)).toBe(true);

    await expect(
      auditoria.listar(
        ecolumeId,
        { id: gestorId, perfil: PerfilUsuario.GESTOR },
        { pagina: 1, porPagina: 20 },
      ),
    ).rejects.toMatchObject({ codigo: 'SEM_PERMISSAO' });

    const outra = await auditoria.listar(
      outraId,
      { id: adminId, perfil: PerfilUsuario.PROPRIETARIO },
      { pagina: 1, porPagina: 20 },
    );
    expect(outra.dados).toHaveLength(0);
    expect(outra.dados.every((d) => d.empresaId === outraId)).toBe(true);
  });

  it('detalhe e histórico preservados após desativar usuário', async () => {
    const st = await operacional.logAuditoria.findFirst({
      where: { empresaId: ecolumeId, tipo: TipoAuditoria.ALTERACAO_ST_FORNECEDOR },
    });
    expect(st).toBeTruthy();
    const detalhe = await auditoria.obter(
      ecolumeId,
      { id: adminId, perfil: PerfilUsuario.PROPRIETARIO },
      st!.id,
    );
    expect(detalhe.entidadeId).toBe(fornecedorId);
    expect(JSON.stringify(detalhe)).not.toContain('nao-e-segredo');

    await platform.usuario.update({
      where: { id: adminId },
      data: { ativo: false },
    });
    const lista = await auditoria.listar(
      ecolumeId,
      { id: adminId, perfil: PerfilUsuario.PROPRIETARIO },
      { pagina: 1, porPagina: 50, usuarioId: adminId },
    );
    expect(lista.dados.length).toBeGreaterThan(0);
    expect(lista.dados[0].usuarioNome).toBe('Admin 27b');
  });
});
