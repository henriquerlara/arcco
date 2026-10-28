import { readFileSync } from 'node:fs';
import path from 'node:path';

function normalizar(url: string): string {
  return url.trim().replace(/^["']|["']$/g, '').replace('://localhost', '://127.0.0.1');
}

/** A URL que o Vite usa. O processo do Playwright não carrega o .env sozinho. */
export function urlDaApi(): string {
  if (process.env.VITE_API_URL) return normalizar(process.env.VITE_API_URL);
  const candidatos = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'apps/web/.env'),
  ];
  for (const arquivo of candidatos) {
    try {
      const texto = readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, '');
      const linha = texto
        .split(/\r?\n/)
        .map((item) => item.replace(/^\uFEFF/, '').trim())
        .find((item) => item.startsWith('VITE_API_URL='));
      if (linha) return normalizar(linha.slice('VITE_API_URL='.length));
    } catch {
      // tenta o próximo caminho
    }
  }
  return 'http://127.0.0.1:3000';
}
