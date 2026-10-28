import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, test, type Page } from '@playwright/test';
import { urlDaApi } from './ambiente';

/**
 * ECOL-27b — consulta administrativa de auditoria.
 * Requer API + Vite e empresa concreto com ECOLUME (mesmo padrão do menu).
 */

const execFileAsync = promisify(execFile);
const API_URL = urlDaApi();
const SENHA = process.env.E2E_SENHA ?? 'Arcco@123';
const EMAIL_ECOLUME = process.env.E2E_EMAIL_ECOLUME ?? 'proprietario.concreto@demo.arcco.local';
/** Conta não-admin da mesma empresa ECOLUME (seed demo concreto). */
const EMAIL_RESTRITO =
  process.env.E2E_EMAIL_RESTRITO_ECOLUME ?? 'vendedor.concreto@demo.arcco.local';

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

test.describe('Consulta de auditoria ECOL-27b', () => {
  test.describe.configure({ mode: 'serial' });
  let pronto = false;

  test.beforeAll(async () => {
    pronto = await apiDisponivel();
    if (!pronto) return;
    await definirPersonalizacao(EMAIL_ECOLUME, 'ECOLUME');
  });

  test.afterAll(async () => {
    if (!pronto) return;
    await definirPersonalizacao(EMAIL_ECOLUME, 'PADRAO');
  });

  test('administrador ECOLUME vê Histórico de auditoria', async ({ page }) => {
    test.skip(!pronto, 'API indisponível — SKIP ECOL-27b Playwright');
    await entrar(page, EMAIL_ECOLUME);
    await page.goto('/app/configuracoes/auditoria');
    await expect(page.getByRole('heading', { name: 'Histórico de auditoria' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Tipo de ação')).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Auditoria' })).toBeVisible();
  });

  test('link Auditoria some sem perfil de administrador (UI)', async ({ page }) => {
    test.skip(!pronto, 'API indisponível — SKIP ECOL-27b Playwright');
    await entrar(page, EMAIL_RESTRITO);
    await page.goto('/app/configuracoes/empresa');
    await expect(
      page.getByRole('navigation').getByRole('link', { name: 'Auditoria' }),
    ).toHaveCount(0);
    await page.goto('/app/configuracoes/auditoria');
    await expect(page.getByText(/Disponível apenas para administradores/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});
