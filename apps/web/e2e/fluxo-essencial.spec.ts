import { test, expect, type Page } from '@playwright/test';
import { urlDaApi } from './ambiente';

/**
 * Fluxo essencial de aceitação da ARCCO.
 *
 * Estes testes cobrem o caminho crítico: entrar, ver o painel, navegar pelo
 * pipeline, contatos, conversas e configurações.
 *
 * Eles dependem de uma API rodando em VITE_API_URL com um usuário de testes.
 * Quando a API não está disponível, os testes de fluxo autenticado são
 * automaticamente ignorados (skip) — mas continuam versionados e prontos para o CI.
 */

const API_URL = urlDaApi();
const EMAIL = process.env.E2E_EMAIL ?? 'proprietario.iluminacao@demo.arcco.local';
const SENHA = process.env.E2E_SENHA ?? 'Arcco@123';

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

async function entrar(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(EMAIL);
  await page.locator('#senha').fill(SENHA);
  await page.getByRole('button', { name: 'Acessar minha operação' }).click();
  await page.waitForURL(/\/app\//, { timeout: 15_000 });
}

test.describe('Telas públicas (sem API)', () => {
  test('a tela de login renderiza a marca e o formulário', async ({ page }) => {
    await page.goto('/entrar');
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    await expect(page.getByLabel('E-mail')).toBeVisible();
    await expect(page.locator('#senha')).toBeVisible();
    await expect(page.getByRole('img', { name: /ARCCO/ }).first()).toBeVisible();
    await expect(page.getByText('Cada mensagem vira contexto, prazo e próxima ação')).toBeVisible();
    await expect(page.locator('main')).toHaveCSS('height', `${page.viewportSize()!.height}px`);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight),
    ).toBe(true);
    const preview = await page.locator('.auth-thread').boundingBox();
    const rodape = await page.locator('main footer').boundingBox();
    expect(preview).not.toBeNull();
    expect(rodape).not.toBeNull();
    expect(preview!.y + preview!.height).toBeLessThan(rodape!.y);
    await page.getByRole('button', { name: 'Mostrar senha' }).click();
    await expect(page.locator('#senha')).toHaveAttribute('type', 'text');
  });

  test('valida credenciais obrigatórias', async ({ page }) => {
    await page.goto('/entrar');
    await page.getByRole('button', { name: 'Acessar minha operação' }).click();
    await expect(page.getByText('E-mail inválido')).toBeVisible();
  });

  test('navega para o cadastro', async ({ page }) => {
    await page.goto('/entrar');
    await page.getByRole('link', { name: 'Criar empresa' }).click();
    await expect(page.getByRole('heading', { name: 'Criar empresa' })).toBeVisible();
    await expect(page.getByLabel('Nome da empresa')).toBeVisible();
  });

  test('rota desconhecida mostra 404', async ({ page }) => {
    await page.goto('/rota-que-nao-existe');
    await expect(page.getByText('404')).toBeVisible();
  });
});

test.describe('Fluxo autenticado (requer API)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async () => {
    test.skip(!(await apiDisponivel()), 'API indisponível em VITE_API_URL — pulando fluxo autenticado.');
  });

  test('entra e visualiza o painel', async ({ page }) => {
    await entrar(page);
    await expect(page).toHaveURL(/\/app\/(dashboard|onboarding|trocar-senha)/);
  });

  test('navega pelas seções principais', async ({ page }) => {
    await entrar(page);
    await page.getByRole('navigation').getByRole('link', { name: 'Negócios', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/pipeline/);
    await expect(page.getByRole('heading', { name: 'Negócios' })).toBeVisible();

    await page.getByRole('navigation').getByRole('link', { name: 'Pessoas', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/contatos/);

    await page.getByRole('navigation').getByRole('link', { name: 'Conversas', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/conversas/);
  });

  test('pipeline começa vazio sem dados de seed', async ({ page }) => {
    await entrar(page);
    await page.goto('/app/pipeline');
    await expect(page.getByRole('heading', { name: 'Negócios' })).toBeVisible();
    await expect(page.locator('main article[role="link"]')).toHaveCount(0);
  });

  test('cria um contato', async ({ page }) => {
    await entrar(page);
    await page.goto('/app/contatos');
    await page.getByRole('button', { name: 'Nova pessoa' }).first().click();
    const nome = `Contato E2E ${Date.now()}`;
    await page.getByLabel('Nome').fill(nome);
    await page.getByLabel('Telefone').fill(`11${String(Date.now()).slice(-9)}`);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText(nome)).toBeVisible({ timeout: 10_000 });
  });

  test('acessa configurações da empresa', async ({ page }) => {
    await entrar(page);
    await page.goto('/app/configuracoes/empresa');
    await expect(page.getByRole('heading', { name: 'Dados da empresa' })).toBeVisible();
  });
});
