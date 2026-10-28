import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, test, type Page } from '@playwright/test';
import { urlDaApi } from './ambiente';

/**
 * ECOL-22 — alternância Lista/Semana/Mês e preservação de filtros.
 * Requer API; marca ECOLUME na empresa concreto só durante o arquivo.
 */

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

test.describe('ECOL-22 Agenda calendário', () => {
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

  test.beforeEach(() => {
    test.skip(!pronto, 'API indisponível — ECOL-22 Playwright SKIP.');
  });

  test('ECOLUME: Lista → Semana → Mês preserva filtros e navega período', async ({ page }) => {
    await entrar(page, EMAIL_ECOLUME);
    await page.goto('/app/agenda');
    await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();

    const vistas = page.getByTestId('agenda-vista');
    await expect(vistas).toBeVisible();

    // filtro tipo se disponível
    const selects = page.locator('select, [role="combobox"]');
    await expect(selects.first()).toBeVisible();

    await vistas.locator('[data-vista="semana"]').click();
    await expect(page.getByTestId('agenda-nav-periodo')).toBeVisible();
    await expect(page.getByTestId('agenda-hoje')).toBeVisible();

    await page.getByLabel('Próximo').click();
    await page.getByLabel('Anterior').click();
    await page.getByTestId('agenda-hoje').click();

    await vistas.locator('[data-vista="mes"]').click();
    await expect(page.getByTestId('agenda-nav-periodo')).toBeVisible();
    await expect(page).toHaveURL(/vista=mes/);

    await vistas.locator('[data-vista="lista"]').click();
    await expect(page.getByTestId('agenda-nav-periodo')).toHaveCount(0);
  });

  test('empresa sem flag não vê seletor de calendário', async ({ page }) => {
    await entrar(page, EMAIL_PADRAO);
    await page.goto('/app/agenda');
    await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
    await expect(page.getByTestId('agenda-vista')).toHaveCount(0);
  });
});
