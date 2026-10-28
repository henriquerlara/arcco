import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { urlDaApi } from './ambiente';

/**
 * Navegação da ECOL-01 contra a API real.
 * A empresa de iluminação permanece sem a flag.
 * A empresa de concreto recebe ECOLUME só durante este arquivo e volta a PADRAO ao final.
 */

const execFileAsync = promisify(execFile);
const API_URL = urlDaApi();
const SENHA = process.env.E2E_SENHA ?? 'Arcco@123';
const EMAIL_PADRAO = process.env.E2E_EMAIL ?? 'proprietario.iluminacao@demo.arcco.local';
const EMAIL_ECOLUME = process.env.E2E_EMAIL_ECOLUME ?? 'proprietario.concreto@demo.arcco.local';

async function apiDisponivel(): Promise<boolean> {
  try {
    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), 8000);
    const resposta = await fetch(`${API_URL}/api/autenticacao/eu`, { signal: controlador.signal });
    clearTimeout(timer);
    return !!resposta;
  } catch {
    return false;
  }
}

async function definirPersonalizacao(email: string, valor: 'PADRAO' | 'ECOLUME'): Promise<void> {
  const api = path.resolve(process.cwd(), '../api');
  await execFileAsync(
    'pnpm',
    ['exec', 'tsx', 'scripts/definir-personalizacao-teste.ts', email, valor],
    { cwd: api, windowsHide: true, shell: process.platform === 'win32' },
  );
}

async function entrar(page: Page, email: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.locator('#senha').fill(SENHA);
  await page.getByRole('button', { name: 'Acessar minha operação' }).click();
  await page.waitForURL(/\/app\//, { timeout: 15_000 });
}

function item(page: Page, nome: string) {
  return page.getByRole('navigation').getByRole('link', { name: nome, exact: true });
}

test.describe('Menu da personalização comercial', () => {
  test.describe.configure({ mode: 'serial' });
  let navegadorPronto = false;

  test.beforeAll(async () => {
    navegadorPronto = await apiDisponivel();
    if (!navegadorPronto) return;
    await definirPersonalizacao(EMAIL_ECOLUME, 'ECOLUME');
  });

  test.afterAll(async () => {
    if (!navegadorPronto) return;
    await definirPersonalizacao(EMAIL_ECOLUME, 'PADRAO');
  });

  test.beforeEach(async () => {
    test.skip(!navegadorPronto, 'API indisponível — navegação da ECOL-01 não executada.');
  });

  test('empresa sem flag mantém o menu e as rotas atuais', async ({ page }) => {
    await entrar(page, EMAIL_PADRAO);
    await expect(item(page, 'Conversas')).toBeVisible();
    await expect(item(page, 'Pessoas')).toBeVisible();
    await expect(item(page, 'Projetos')).toBeVisible();
    await expect(item(page, 'Produtos')).toBeVisible();
    await expect(item(page, 'Clientes')).toHaveCount(0);

    await page.goto('/app/conversas');
    await expect(page).toHaveURL(/\/app\/conversas/);
    await page.goto('/app/contatos');
    await expect(page).toHaveURL(/\/app\/contatos/);
    await page.goto('/app/produtos');
    await expect(page).toHaveURL(/\/app\/produtos/);
    await page.goto('/app/obras');
    await expect(page).toHaveURL(/\/app\/obras/);
  });

  test('empresa com ECOLUME vê o menu da seção 6 e não as telas ainda inexistentes', async ({
    page,
  }) => {
    await entrar(page, EMAIL_ECOLUME);
    for (const nome of [
      'Visão geral',
      'Negócios',
      'Agenda',
      'Clientes',
      'Parceiros',
      'Estoque',
      'Fornecedores',
      'Fiscal',
      'Configurações',
    ]) {
      await expect(item(page, nome)).toBeVisible();
    }
    for (const nome of ['Conversas', 'Pessoas', 'Projetos', 'Produtos']) {
      await expect(item(page, nome)).toHaveCount(0);
    }
  });

  test('rotas ocultas e /app/contatos redirecionam só na empresa com flag', async ({ page }) => {
    await entrar(page, EMAIL_ECOLUME);
    for (const rota of [
      '/app/conversas',
      '/app/produtos',
      '/app/obras',
      '/app/configuracoes/whatsapp',
      '/app/configuracoes/chatbot',
    ]) {
      await page.goto(rota);
      await expect(page).toHaveURL(/\/app\/dashboard/);
    }
    await page.goto('/app/contatos');
    await expect(page).toHaveURL(/\/app\/clientes$/);
    await page.goto('/app/clientes');
    await expect(page).toHaveURL(/\/app\/clientes$/);
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
    await page.goto('/app/parceiros');
    await expect(page).toHaveURL(/\/app\/parceiros$/);
    await expect(page.getByRole('heading', { name: 'Parceiros' })).toBeVisible();
  });

  test('estoque ECOLUME mostra as quatro sub-abas; legado não', async ({ page }) => {
    await entrar(page, EMAIL_ECOLUME);
    await page.goto('/app/estoque');
    await expect(page.getByRole('button', { name: 'Produtos e saldo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Movimentações' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fornecedores' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lista de compra' })).toBeVisible();
    await page.getByRole('button', { name: 'Lista de compra' }).click();
    await expect(page.getByText(/saldo negativo|Nada a comprar|quantidade faltante/i).first()).toBeVisible();

    await entrar(page, EMAIL_PADRAO);
    await page.goto('/app/estoque');
    await expect(page.getByRole('button', { name: 'Produtos e saldo' })).toHaveCount(0);
    await expect(page.getByText('Zerados')).toBeVisible();
  });

  test('a flag de uma empresa não aparece na sessão da outra', async ({ browser }) => {
    const padrao = await sessao(browser, EMAIL_PADRAO);
    const ecolume = await sessao(browser, EMAIL_ECOLUME);
    await expect(item(padrao, 'Conversas')).toBeVisible();
    await expect(item(ecolume, 'Conversas')).toHaveCount(0);
    await expect(item(ecolume, 'Clientes')).toBeVisible();
    await expect(item(padrao, 'Clientes')).toHaveCount(0);
    await padrao.context().close();
    await ecolume.context().close();
  });
});

async function sessao(browser: Browser, email: string): Promise<Page> {
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
  await entrar(page, email);
  return page;
}
