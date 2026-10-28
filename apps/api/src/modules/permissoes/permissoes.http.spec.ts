import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { PerfilUsuario, PermissaoComercial } from '@arcco/contratos';
import { PrismaClient as PlatformClient } from '../../database/generated/platform';

/**
 * Requisições HTTP contra a API já em execução.
 * Só roda com ECOL_HTTP=1 para não derrubar a suíte quando o servidor está parado.
 * Cria empresas e usuários descartáveis. Não altera as contas de demonstração.
 */
const ATIVO = process.env.ECOL_HTTP === '1';
const API = process.env.ECOL_HTTP_URL ?? 'http://127.0.0.1:3001';
const SENHA = 'Arcco@123';

const platform = new PlatformClient();
const operacional = new PrismaClient();
const sufixo = randomUUID().slice(0, 8);
const empresas: string[] = [];

interface Sessao {
  cookie: string;
  corpo: {
    permissoesComerciais: string[] | null;
    usuario: { id: string; perfil: string };
    empresa: { id: string };
  };
}

async function entrar(email: string): Promise<Sessao> {
  const resposta = await fetch(`${API}/api/autenticacao/entrar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, senha: SENHA }),
  });
  const corpo = (await resposta.json()) as Sessao['corpo'];
  expect(resposta.status, JSON.stringify(corpo)).toBe(201);
  const cookies = resposta.headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');
  return { cookie: cookies, corpo };
}

async function chamar(sessao: Sessao, caminho: string, init: RequestInit = {}) {
  const resposta = await fetch(`${API}${caminho}`, {
    ...init,
    headers: {
      cookie: sessao.cookie,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  const texto = await resposta.text();
  let json: unknown = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = texto;
  }
  return { status: resposta.status, json, texto };
}

async function criarEmpresa(nome: string, ecolume: boolean) {
  const empresa = await platform.empresa.create({
    data: {
      nome,
      segmento: 'OUTRO',
      databaseHost: 'localhost',
      databasePort: 5432,
      databaseName: 'db_empresa_arcco',
      configuracoes: ecolume
        ? { personalizacaoComercial: 'ECOLUME', onboardingConcluido: true }
        : { onboardingConcluido: true },
    },
  });
  empresas.push(empresa.id);
  return empresa;
}

async function criarUsuario(empresaId: string, perfil: string, papel: string) {
  const email = `ecol26a.${papel}.${sufixo}@teste.arcco.local`;
  const senhaHash = await argon2.hash(SENHA, { type: argon2.argon2id });
  return platform.usuario.create({
    data: { empresaId, nome: papel, email, senhaHash, perfil: perfil as never },
  });
}

describe.skipIf(!ATIVO)('ECOL-26a por HTTP', () => {
  let ecolumeId = '';
  let padraoId = '';
  let dono: Sessao;
  let gestor: Sessao;
  let vendedor: Sessao;
  let atendente: Sessao;
  let concedido: Sessao;
  let vendedorPadrao: Sessao;
  let produtoAlheio = '';

  afterAll(async () => {
    for (const empresaId of empresas) {
      await operacional.movimentacaoEstoque.deleteMany({ where: { empresaId } });
      await operacional.orcamento.deleteMany({ where: { empresaId } });
      await operacional.oportunidade.deleteMany({ where: { empresaId } });
      await operacional.contato.deleteMany({ where: { empresaId } });
      await operacional.etapaFunil.deleteMany({ where: { empresaId } });
      await operacional.produto.deleteMany({ where: { empresaId } });
      await platform.empresa.delete({ where: { id: empresaId } }).catch(() => undefined);
    }
    await platform.$disconnect();
    await operacional.$disconnect();
  });

  it('prepara duas empresas descartáveis e as sessões', async () => {
    const ecolume = await criarEmpresa(`ECOL26A ${sufixo}`, true);
    const padrao = await criarEmpresa(`PADRAO26A ${sufixo}`, false);
    ecolumeId = ecolume.id;
    padraoId = padrao.id;

    const etapa = await operacional.etapaFunil.create({
      data: { empresaId: ecolumeId, nome: 'Aberto', ordem: 1, tipo: 'ABERTA' },
    });
    const contato = await operacional.contato.create({
      data: {
        empresaId: ecolumeId,
        nome: 'Cliente teste',
        telefone: '11999990000',
        telefoneNormalizado: `55${sufixo}90000`,
      },
    });
    await operacional.oportunidade.create({
      data: {
        empresaId: ecolumeId,
        codigo: `OP-${sufixo}`,
        titulo: 'Negócio teste',
        contatoId: contato.id,
        etapaId: etapa.id,
        valorEstimado: 1500,
      },
    });

    const uDono = await criarUsuario(ecolumeId, PerfilUsuario.PROPRIETARIO, 'dono');
    const uGestor = await criarUsuario(ecolumeId, PerfilUsuario.GESTOR, 'gestor');
    const uVendedor = await criarUsuario(ecolumeId, PerfilUsuario.VENDEDOR, 'vendedor');
    const uAtendente = await criarUsuario(ecolumeId, PerfilUsuario.ATENDENTE, 'atendente');
    const uConcedido = await criarUsuario(ecolumeId, PerfilUsuario.VENDEDOR, 'concedido');
    const uPadrao = await criarUsuario(padraoId, PerfilUsuario.VENDEDOR, 'padrao');
    await platform.concessaoPermissao.create({
      data: { empresaId: ecolumeId, usuarioId: uConcedido.id, chave: PermissaoComercial.VER_CUSTOS },
    });

    dono = await entrar(uDono.email);
    gestor = await entrar(uGestor.email);
    vendedor = await entrar(uVendedor.email);
    atendente = await entrar(uAtendente.email);
    concedido = await entrar(uConcedido.email);
    vendedorPadrao = await entrar(uPadrao.email);

    const criado = await chamar(dono, '/api/produtos', {
      method: 'POST',
      body: JSON.stringify({ nome: `Spot ${sufixo}`, precoVenda: 89.9 }),
    });
    expect(criado.status).toBe(201);
    produtoAlheio = (criado.json as { id: string }).id;
  });

  it('a sessão traz só as permissões calculadas no servidor', () => {
    expect(dono.corpo.permissoesComerciais).toEqual(expect.arrayContaining([PermissaoComercial.VER_CUSTOS, PermissaoComercial.VER_FATURAMENTO]));
    expect(gestor.corpo.permissoesComerciais).toEqual([]);
    expect(vendedor.corpo.permissoesComerciais).toEqual([]);
    expect(atendente.corpo.permissoesComerciais).toEqual([]);
    expect(concedido.corpo.permissoesComerciais).toEqual([PermissaoComercial.VER_CUSTOS]);
    expect(vendedorPadrao.corpo.permissoesComerciais).toBeNull();
    expect(dono.corpo.empresa.id).toBe(ecolumeId);
    expect(vendedorPadrao.corpo.empresa.id).toBe(padraoId);
  });

  it('proprietário vê faturamento e ticket; os demais perfis sem concessão não', async () => {
    const painelDono = await chamar(dono, '/api/dashboard/metricas');
    const painelGestor = await chamar(gestor, '/api/dashboard/metricas');
    const painelVendedor = await chamar(vendedor, '/api/dashboard/metricas');
    const painelAtendente = await chamar(atendente, '/api/dashboard/metricas');
    expect(painelDono.status).toBe(200);
    const oportunidades = (painelDono.json as { oportunidades: Record<string, unknown>; funil: Array<Record<string, unknown>> });
    expect(oportunidades.oportunidades.valorPipeline).toBe(1500);
    expect(oportunidades.oportunidades.ticketMedioGanho).toBeDefined();
    expect(oportunidades.funil[0]?.valor).toBe(1500);

    for (const painel of [painelGestor, painelVendedor, painelAtendente]) {
      expect(painel.status).toBe(200);
      const corpo = painel.json as { oportunidades: Record<string, unknown>; funil: Array<Record<string, unknown>> };
      expect(corpo.oportunidades.abertas).toBe(1);
      expect(corpo.oportunidades).not.toHaveProperty('valorPipeline');
      expect(corpo.oportunidades).not.toHaveProperty('ticketMedioGanho');
      expect(corpo.oportunidades).not.toHaveProperty('valorGanhoNoPeriodo');
      expect(corpo.funil[0]).not.toHaveProperty('valor');
      expect(corpo.funil[0]?.quantidade).toBe(1);
      expect(painel.texto).not.toContain('1500');
    }
  });

  it('concessão só de custo não devolve o faturamento do painel', async () => {
    const painel = await chamar(concedido, '/api/dashboard/metricas');
    const corpo = painel.json as { oportunidades: Record<string, unknown> };
    expect(corpo.oportunidades).not.toHaveProperty('valorPipeline');
    expect(corpo.oportunidades).not.toHaveProperty('ticketMedioGanho');
  });

  it('empresa sem flag continua recebendo os valores do painel', async () => {
    const painel = await chamar(vendedorPadrao, '/api/dashboard/metricas');
    expect(painel.status).toBe(200);
    const corpo = painel.json as { oportunidades: Record<string, unknown> };
    expect(corpo.oportunidades).toHaveProperty('valorPipeline');
    expect(corpo.oportunidades).toHaveProperty('ticketMedioGanho');
    expect(corpo.oportunidades).toHaveProperty('valorGanhoNoPeriodo');
  });

  it('preço de venda permanece e o corpo com custo é recusado só na empresa com flag', async () => {
    const lista = await chamar(vendedor, '/api/produtos');
    expect(lista.status).toBe(200);
    const itens = lista.json as Array<{ nome: string; precoVenda: number; custoMedio?: number }>;
    const spot = itens.find((item) => item.nome === `Spot ${sufixo}`);
    expect(spot?.precoVenda).toBe(89.9);
    expect(spot).not.toHaveProperty('custoMedio');

    const recusa = await chamar(vendedor, '/api/produtos', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Item com custo', precoVenda: 10, custoMedio: 999.91 }),
    });
    expect(recusa.status).toBe(403);
    expect(recusa.json).toEqual({
      erro: { codigo: 'SEM_PERMISSAO', mensagem: 'Voce nao tem permissao para esta acao' },
    });
    expect(recusa.texto).not.toContain('999.91');
    expect(recusa.texto).not.toContain('stack');

    const legado = await chamar(vendedorPadrao, '/api/produtos', {
      method: 'POST',
      body: JSON.stringify({ nome: `Legado ${sufixo}`, precoVenda: 15, custoMedio: 4 }),
    });
    expect(legado.status).toBe(201);
    expect(legado.json).toMatchObject({ precoVenda: 15 });
    expect(legado.json).not.toHaveProperty('custoMedio');
  });

  it('ordenar ou filtrar por campo financeiro é recusado só na empresa com flag', async () => {
    const recusa = await chamar(atendente, '/api/produtos?orderBy=custoMedio');
    expect(recusa.status).toBe(403);
    expect((recusa.json as { erro: { codigo: string } }).erro.codigo).toBe('SEM_PERMISSAO');

    const filtro = await chamar(gestor, '/api/produtos?margem=10');
    expect(filtro.status).toBe(403);

    const legado = await chamar(vendedorPadrao, '/api/produtos?orderBy=custoMedio');
    expect(legado.status).toBe(200);
    expect(Array.isArray(legado.json)).toBe(true);
  });

  it('usuário de outra empresa não lê o produto nem o painel alheio', async () => {
    const leitura = await chamar(vendedorPadrao, `/api/produtos/${produtoAlheio}`);
    expect(leitura.status).toBe(404);
    expect(leitura.texto).not.toContain(`Spot ${sufixo}`);
    expect(leitura.texto).not.toContain('1500');
  });

  it('orçamento aninhado no negócio conserva o preço e não ganha campo de custo', async () => {
    const negocios = await chamar(dono, '/api/oportunidades');
    expect(negocios.status).toBe(200);
    const lista = negocios.json as { dados: Array<{ id: string }> };
    const id = lista.dados[0]?.id;
    expect(id).toBeTruthy();

    const criado = await chamar(dono, '/api/orcamentos', {
      method: 'POST',
      body: JSON.stringify({
        oportunidadeId: id,
        itens: [{ nome: 'Linha', quantidade: 2, precoUnitario: 40, desconto: 0 }],
      }),
    });
    expect(criado.status).toBe(201);
    const orcamento = criado.json as { itens: Array<{ precoUnitario: number; totalLinha: number }> };
    expect(orcamento.itens[0]?.precoUnitario).toBe(40);
    expect(orcamento.itens[0]?.totalLinha).toBe(80);

    const detalhe = await chamar(vendedor, `/api/oportunidades/${id}`);
    expect(detalhe.status).toBe(200);
    const texto = detalhe.texto;
    expect(texto).toContain('40');
    expect(texto).not.toContain('custoMedio');
    expect(texto).not.toContain('margem');
  });
});
