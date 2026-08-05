import { test, expect, type Page } from '@playwright/test';

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

const API_URL = process.env.VITE_API_URL ?? 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'proprietario@arcco.dev';
const SENHA = process.env.E2E_SENHA ?? 'arcco12345';

async function apiDisponivel(): Promise<boolean> {
  try {
    const controlador = new AbortController();
    const t = setTimeout(() => controlador.abort(), 2000);
    const resposta = await fetch(`${API_URL}/health`, { signal: controlador.signal }).catch(
      () => fetch(`${API_URL}/auth/sessao`, { signal: controlador.signal }),
    );
    clearTimeout(t);
    return !!resposta;
  } catch {
    return false;
  }
}

async function entrar(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(EMAIL);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/app\//, { timeout: 15_000 });
}

test.describe('Telas públicas (sem API)', () => {
  test('a tela de login renderiza a marca e o formulário', async ({ page }) => {
    await page.goto('/entrar');
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    await expect(page.getByLabel('E-mail')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
    await expect(page.getByText('ARCCO').first()).toBeVisible();
  });

  test('valida credenciais obrigatórias', async ({ page }) => {
    await page.goto('/entrar');
    await page.getByRole('button', { name: 'Entrar' }).click();
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
  test.beforeEach(async () => {
    test.skip(!(await apiDisponivel()), 'API indisponível em VITE_API_URL — pulando fluxo autenticado.');
  });

  test('entra e visualiza o painel', async ({ page }) => {
    await entrar(page);
    await expect(page).toHaveURL(/\/app\/(dashboard|onboarding|trocar-senha)/);
  });

  test('navega pelas seções principais', async ({ page }) => {
    await entrar(page);
    await page.getByRole('link', { name: 'Pipeline' }).click();
    await expect(page).toHaveURL(/\/app\/pipeline/);
    await expect(page.getByRole('heading', { name: 'Pipeline' })).toBeVisible();

    await page.getByRole('link', { name: 'Contatos' }).click();
    await expect(page).toHaveURL(/\/app\/contatos/);

    await page.getByRole('link', { name: 'Conversas' }).click();
    await expect(page).toHaveURL(/\/app\/conversas/);
  });

  test('cria um contato', async ({ page }) => {
    await entrar(page);
    await page.goto('/app/contatos');
    await page.getByRole('button', { name: 'Novo contato' }).first().click();
    const nome = `Contato E2E ${Date.now()}`;
    await page.getByLabel('Nome').fill(nome);
    await page.getByLabel('Telefone').fill('11988887777');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText(nome)).toBeVisible({ timeout: 10_000 });
  });

  test('acessa configurações da empresa', async ({ page }) => {
    await entrar(page);
    await page.goto('/app/configuracoes/empresa');
    await expect(page.getByRole('heading', { name: 'Dados da empresa' })).toBeVisible();
  });
});
