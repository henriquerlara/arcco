import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  ChaveEtapaSistema,
  NaturezaPessoa,
  OrigemNegocio,
  PerfilUsuario,
  PrioridadeOportunidade,
  StatusOrcamento,
  TipoContato,
} from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CamposPersonalizadosService } from '../campos-personalizados/campos-personalizados.service';
import { ContatosService } from '../contatos/contatos.service';
import { EventosService } from '../eventos/eventos.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { ProdutosService } from '../produtos/produtos.service';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { OrcamentosService } from './orcamentos.service';

const ATIVO =
  process.env.ECOL_ORCAMENTO === '1' ||
  process.env.ECOL_NEGOCIO === '1' ||
  process.env.ECOL_PRODUTO === '1';

const operacional = new PrismaClient();
const platform = new PlatformClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

describe.skipIf(!ATIVO)('ECOL-12 no banco', () => {
  const auditoria = new AuditoriaService(platform as never);
  const permissoes = new PermissoesService(platform as never, auditoria);
  const campos = new CamposPersonalizadosService(operacional as never);
  const contatos = new ContatosService(
    operacional as never,
    platform as never,
    campos,
    permissoes,
  );
  const eventos = new EventosService(operacional as never);
  const produtos = new ProdutosService(operacional as never, auditoria, permissoes);
  const negocios = new OportunidadesService(
    operacional as never,
    platform as never,
    campos,
    eventos,
    produtos,
    permissoes,
    contatos,
  );
  const orcamentos = new OrcamentosService(
    operacional as never,
    platform as never,
    { enviar: async () => ({ id: 'arq' }) } as never,
    produtos,
    permissoes,
    {} as never,
  );

  let ecolumeId = '';
  let padraoId = '';
  let usuarioId = '';
  let clienteId = '';
  let oppEcolume = '';
  let oppLegado = '';

  beforeAll(async () => {
    const ecolume = await platform.empresa.create({
      data: {
        nome: `ORC12 ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true },
      },
    });
    const padrao = await platform.empresa.create({
      data: {
        nome: `ORC12P ${sufixo}`,
        segmento: 'OUTRO',
        databaseName: 'db_empresa_arcco',
        configuracoes: { onboardingConcluido: true },
      },
    });
    empresas.push(ecolume.id, padrao.id);
    ecolumeId = ecolume.id;
    padraoId = padrao.id;

    const user = await platform.usuario.create({
      data: {
        empresaId: ecolumeId,
        nome: `User ${sufixo}`,
        email: `orc12-${sufixo}@teste.local`,
        senhaHash: 'x',
        perfil: PerfilUsuario.PROPRIETARIO,
      },
    });
    usuarioId = user.id;

    for (const empresaId of [ecolumeId, padraoId]) {
      const existe = await operacional.etapaFunil.findFirst({
        where: { empresaId, chaveSistema: ChaveEtapaSistema.NOVO_CONTATO },
      });
      if (!existe) {
        await operacional.etapaFunil.create({
          data: {
            empresaId,
            nome: 'Novo contato',
            ordem: 1,
            tipo: 'ABERTA',
            chaveSistema: ChaveEtapaSistema.NOVO_CONTATO,
            ativo: true,
          },
        });
      }
      const cliente = await contatos.criar(empresaId, {
        nome: `Cliente ${sufixo} ${empresaId.slice(0, 4)}`,
        telefone: empresaId === ecolumeId ? '11970002001' : '11970002002',
        natureza: NaturezaPessoa.PF,
        tipo: TipoContato.OUTRO,
        dadosPersonalizados: {},
      });
      if (empresaId === ecolumeId) clienteId = cliente.id as string;

      if (empresaId === ecolumeId) {
        const neg = await negocios.criar(
          empresaId,
          {
            contatoId: cliente.id as string,
            titulo: `Neg ${sufixo}`,
            origemNegocio: OrigemNegocio.CLIENTE_DIRETO,
            responsavelId: usuarioId,
            prioridade: PrioridadeOportunidade.MEDIA,
            dadosPersonalizados: {},
          },
          { usuarioId },
        );
        oppEcolume = neg.id as string;
      } else {
        const op = await negocios.criar(
          empresaId,
          {
            contatoId: cliente.id as string,
            prioridade: PrioridadeOportunidade.MEDIA,
            dadosPersonalizados: {},
          },
          { usuarioId },
        );
        oppLegado = op.id as string;
      }
    }
  }, 120_000);

  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.itemOrcamento.deleteMany({
        where: { orcamento: { empresaId } },
      });
      await operacional.orcamento.deleteMany({ where: { empresaId } });
      await operacional.historicoEtapaOportunidade.deleteMany({
        where: { oportunidade: { empresaId } },
      });
      await operacional.oportunidade.deleteMany({ where: { empresaId } });
      await operacional.contato.deleteMany({ where: { empresaId } });
      await operacional.etapaFunil.deleteMany({ where: { empresaId } });
      await platform.usuario.deleteMany({ where: { empresaId } });
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await operacional.$disconnect();
    await platform.$disconnect();
  }, 120_000);

  it('sequência ORC concorrente, vários no negócio, trava e duplicação', async () => {
    const [o1, o2] = await Promise.all([
      orcamentos.criar(ecolumeId, usuarioId, {
        oportunidadeId: oppEcolume,
        descontoValor: 0,
        itens: [{ nome: 'A', quantidade: 1, precoUnitario: 10, unidade: 'un' }],
      }),
      orcamentos.criar(ecolumeId, usuarioId, {
        oportunidadeId: oppEcolume,
        descontoValor: 0,
        itens: [{ nome: 'B', quantidade: 1, precoUnitario: 20, unidade: 'un' }],
      }),
    ]);
    const numeros = [o1.numero, o2.numero].sort();
    expect(numeros[0]).toMatch(/^ORC-\d{4}$/);
    expect(numeros[1]).toMatch(/^ORC-\d{4}$/);
    expect(numeros[0]).not.toBe(numeros[1]);
    expect(numeros[0]).not.toMatch(/-v/);

    const lista = await orcamentos.listarPorOportunidade(ecolumeId, oppEcolume);
    expect(lista.length).toBeGreaterThanOrEqual(2);

    const enviado = await orcamentos.marcarEnviado(ecolumeId, o1.id);
    expect(enviado.status).toBe(StatusOrcamento.ENVIADO);
    expect(enviado.enviadoEm).toBeTruthy();

    // Único endpoint de mutação comercial é PATCH /orcamentos/:id → atualizar (sem rotas de itens).
    await expect(
      orcamentos.atualizar(ecolumeId, o1.id, {
        descontoValor: 99,
        observacoes: 'hack',
        itens: [{ nome: 'Hack', quantidade: 9, precoUnitario: 1, unidade: 'un', desconto: 3 }],
      }),
    ).rejects.toMatchObject({ codigo: 'ORCAMENTO_BLOQUEADO' });
    await expect(
      orcamentos.atualizar(ecolumeId, o1.id, { descontoValor: 1 }),
    ).rejects.toMatchObject({ codigo: 'ORCAMENTO_BLOQUEADO' });
    await expect(
      orcamentos.marcarEnviado(ecolumeId, o1.id),
    ).rejects.toMatchObject({ codigo: 'ORCAMENTO_NAO_ENVIAVEL' });

    const originalAntes = await orcamentos.obter(ecolumeId, o1.id);
    expect(originalAntes.itens[0]?.nome).toBe('A');
    expect(originalAntes.descontoValor).toBe(0);

    const copia = await orcamentos.duplicar(ecolumeId, usuarioId, o1.id);
    expect(copia.id).not.toBe(o1.id);
    expect(copia.numero).toMatch(/^ORC-\d{4}$/);
    expect(copia.numero).not.toBe(o1.numero);
    expect(copia.status).toBe(StatusOrcamento.RASCUNHO);
    expect(copia.orcamentoOrigemId).toBe(o1.id);
    expect(copia.orcamentoOrigem?.numero).toBe(o1.numero);
    expect(copia.itens).toHaveLength(originalAntes.itens.length);
    expect(copia.itens[0]?.nome).toBe(originalAntes.itens[0]?.nome);
    expect(copia.itens[0]?.quantidade).toBe(originalAntes.itens[0]?.quantidade);
    expect(copia.itens[0]?.precoUnitario).toBe(originalAntes.itens[0]?.precoUnitario);
    expect(copia.itens[0]?.id).not.toBe(originalAntes.itens[0]?.id);

    const originalDepois = await orcamentos.obter(ecolumeId, o1.id);
    expect(originalDepois.status).toBe(StatusOrcamento.ENVIADO);
    expect(originalDepois.total).toBe(originalAntes.total);
    expect(originalDepois.itens.map((i) => i.nome)).toEqual(originalAntes.itens.map((i) => i.nome));

    await orcamentos.marcarEnviado(ecolumeId, copia.id);
    const a = await orcamentos.obter(ecolumeId, o1.id);
    expect(a.status).toBe(StatusOrcamento.SUBSTITUIDO);
  }, 60_000);

  it('legado ORC-n-vN e isolamento entre empresas', async () => {
    const legado = await orcamentos.criar(padraoId, usuarioId, {
      oportunidadeId: oppLegado,
      descontoValor: 0,
      itens: [{ nome: 'Legado', quantidade: 1, precoUnitario: 5, unidade: 'un' }],
    });
    expect(legado.numero).toMatch(/^ORC-\d{4}-v\d+$/);

    await expect(orcamentos.obter(ecolumeId, legado.id)).rejects.toMatchObject({
      codigo: 'ORCAMENTO_NAO_ENCONTRADO',
    });
    expect(clienteId).toBeTruthy();
  });
});
