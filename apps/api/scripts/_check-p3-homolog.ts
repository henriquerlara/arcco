/**
 * Lê presença de campos P3 sem imprimir valores fiscais.
 * Uso: pnpm exec tsx scripts/_check-p3-homolog.ts
 */
import { PrismaClient } from '../src/database/generated/platform';

const KEYS = [
  'regimeTributario',
  'cfopPadrao',
  'csosnPadrao',
  'cstPadrao',
  'naturezaOperacao',
  'tratamentoSt',
  'informacoesComplementaresNfe',
  'personalizacaoComercial',
] as const;

async function main() {
  const p = new PrismaClient();
  try {
    const empresas = await p.empresa.findMany({
      select: { nome: true, configuracoes: true },
    });
    for (const e of empresas) {
      const c =
        e.configuracoes && typeof e.configuracoes === 'object'
          ? (e.configuracoes as Record<string, unknown>)
          : {};
      const campos: Record<string, string> = {};
      for (const k of KEYS) {
        const v = c[k];
        campos[k] =
          typeof v === 'string' && v.trim() ? 'SET' : v == null || v === '' ? 'EMPTY' : typeof v;
      }
      const p3Completo =
        campos.regimeTributario === 'SET' &&
        campos.cfopPadrao === 'SET' &&
        campos.naturezaOperacao === 'SET' &&
        (campos.csosnPadrao === 'SET' || campos.cstPadrao === 'SET');
      console.log(
        JSON.stringify({
          nome: e.nome,
          p3Completo,
          personalizacao: campos.personalizacaoComercial,
          campos,
        }),
      );
    }
  } finally {
    await p.$disconnect();
  }
}

main().catch((err) => {
  console.error('ERR', (err as Error).message);
  process.exit(1);
});
