import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, test, type Page } from '@playwright/test';
import { urlDaApi } from './ambiente';

/** ECOL-25 — três sub-abas Fiscal (ECOLUME). Requer API. */

const execFileAsync = promisify(execFile);
const API_URL = urlDaApi();
const SENHA = process.env.E2E_SENHA ?? 'Arcco@123';
const EMAIL_ECOLUME = process.env.E2E_EMAIL_ECOLUME ?? 'proprietario.concreto@demo.arcco.local';
const EMAIL_PADRAO = process.env.E2E_EMAIL ?? 'proprietario.iluminacao@demo.arcco.local';

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

test.describe('ECOL-25 Fiscal abas', () => {
  test.describe.configure({ mode: 'serial' });
  let pronto = false;

  test.beforeAll(async () => {
    pronto = await apiDisponivel();
    if (!pronto) return;
    await definirPersonalizacao(EMAIL_ECOLUME, 'ECOLUME');
    await definirPersonalizacao(EMAIL_PADRAO, 'PADRAO');
  });

  test.afterAll(async () => {
    if (!pronto) return;
    await definirPersonalizacao(EMAIL_ECOLUME, 'PADRAO').catch(() => undefined);
  });

  test('ECOLUME: três sub-abas em /app/fiscal', async ({ page }) => {
    test.skip(!pronto, 'API indisponível — SKIP Playwright ECOL-25');
    await entrar(page, EMAIL_ECOLUME);
    await page.goto('/app/fiscal');
    await expect(page.getByRole('heading', { name: 'Fiscal' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('tab', { name: 'Notas emitidas' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Notas de entrada' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Pendentes de emissão' })).toBeVisible();

    await page.getByRole('tab', { name: 'Notas de entrada' }).click();
    await expect(page).toHaveURL(/aba=entrada/);

    await page.getByRole('tab', { name: 'Pendentes de emissão' }).click();
    await expect(page).toHaveURL(/aba=pendentes/);
  });

  test('legado: menu Fiscal ausente', async ({ page }) => {
    test.skip(!pronto, 'API indisponível — SKIP Playwright ECOL-25');
    await entrar(page, EMAIL_PADRAO);
    await expect(page.getByRole('link', { name: 'Fiscal' })).toHaveCount(0);
  });
});
