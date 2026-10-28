import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  chaveDataLocal,
  fimSemana,
  inicioSemana,
  TipoAtividade,
} from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { EventosService } from '../eventos/eventos.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AtividadesService } from './atividades.service';

const ATIVO =
  process.env.ECOL_CALENDARIO === '1' ||
  process.env.ECOL_ENTREGA === '1' ||
  process.env.ECOL_FOLLOWUP === '1';

const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);

describe.skipIf(!ATIVO)('ECOL-22 calendário listagem por intervalo', () => {
  const auditoria = new AuditoriaService(platform as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const eventos = new EventosService(operacional as never);
  const atividades = new AtividadesService(operacional as never, eventos, permissoes);

  let empresaA = '';
  let empresaB = '';
  let usuarioA = '';

  beforeAll(async () => {
    const a = await platform.empresa.create({
      data: {
        nome: `CalA ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const b = await platform.empresa.create({
      data: {
        nome: `CalB ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { onboardingConcluido: true },
      },
    });
    empresaA = a.id;
    empresaB = b.id;
    const u = await platform.usuario.create({
      data: {
        empresaId: empresaA,
        nome: 'Cal user',
        email: `cal-${sufixo}@teste.local`,
        senhaHash: 'x',
        perfil: 'PROPRIETARIO',
      },
    });
    usuarioA = u.id;
  }, 60_000);

  afterAll(async () => {
    for (const empresaId of [empresaA, empresaB]) {
      await operacional.atividade.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.usuario.deleteMany({ where: { empresaId } }).catch(() => undefined);
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  }, 60_000);

  it('intervalo, múltiplos no dia, tipos e isolamento', async () => {
    const ancora = new Date(2026, 9, 28, 12, 0, 0); // qua
    const de = inicioSemana(ancora);
    const ate = fimSemana(ancora);

    const base = {
      empresaId: empresaA,
      responsavelId: usuarioA,
      concluida: false,
    };

    await operacional.atividade.create({
      data: {
        ...base,
        tipo: TipoAtividade.TAREFA,
        titulo: `Horario ${sufixo}`,
        vencimento: new Date(2026, 9, 28, 14, 30, 0),
      },
    });
    await operacional.atividade.create({
      data: {
        ...base,
        tipo: TipoAtividade.VISITA,
        titulo: `Dia inteiro ${sufixo}`,
        vencimento: new Date(2026, 9, 28, 9, 0, 0),
        diaInteiro: true,
      },
    });
    await operacional.atividade.create({
      data: {
        ...base,
        tipo: TipoAtividade.ENTREGA,
        titulo: `Manha ${sufixo}`,
        vencimento: new Date(2026, 9, 29, 8, 0, 0),
        periodoDia: 'MANHA',
      },
    });
    await operacional.atividade.create({
      data: {
        ...base,
        tipo: TipoAtividade.FOLLOW_UP,
        titulo: `Fora ${sufixo}`,
        vencimento: new Date(2026, 10, 10, 10, 0, 0),
      },
    });
    await operacional.atividade.create({
      data: {
        empresaId: empresaB,
        responsavelId: usuarioA,
        tipo: TipoAtividade.TAREFA,
        titulo: `Outra emp ${sufixo}`,
        vencimento: new Date(2026, 9, 28, 11, 0, 0),
        concluida: false,
      },
    });

    const lista = await atividades.listar(empresaA, {
      pagina: 1,
      porPagina: 500,
      de: de.toISOString(),
      ate: ate.toISOString(),
    });

    const titulos = lista.dados.map((a) => a.titulo);
    expect(titulos.some((t) => t.includes(`Horario ${sufixo}`))).toBe(true);
    expect(titulos.some((t) => t.includes(`Dia inteiro ${sufixo}`))).toBe(true);
    expect(titulos.some((t) => t.includes(`Manha ${sufixo}`))).toBe(true);
    expect(titulos.some((t) => t.includes(`Fora ${sufixo}`))).toBe(false);
    expect(titulos.some((t) => t.includes(`Outra emp ${sufixo}`))).toBe(false);

    const noDia = lista.dados.filter(
      (a) => chaveDataLocal(new Date(a.vencimento)) === '2026-10-28',
    );
    expect(noDia.length).toBeGreaterThanOrEqual(2);

    const soTarefa = await atividades.listar(empresaA, {
      pagina: 1,
      porPagina: 500,
      tipo: TipoAtividade.TAREFA,
      de: de.toISOString(),
      ate: ate.toISOString(),
    });
    expect(soTarefa.dados.every((a) => a.tipo === TipoAtividade.TAREFA)).toBe(true);
    expect(soTarefa.dados.some((a) => a.titulo.includes(`Horario ${sufixo}`))).toBe(true);
  }, 60_000);
});
