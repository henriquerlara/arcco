/**
 * Ajusta só a chave personalizacaoComercial da empresa do e-mail informado.
 * Usado pelos testes de navegação. Não cria empresa nem altera outros campos.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '../src/database/generated/platform';

function urlDaPlataforma(): string {
  if (process.env.PLATFORM_DATABASE_URL) return process.env.PLATFORM_DATABASE_URL;
  const texto = readFileSync(resolve(__dirname, '../.env'), 'utf8');
  const linha = texto.split(/\r?\n/).find((item) => item.startsWith('PLATFORM_DATABASE_URL='));
  if (!linha) throw new Error('PLATFORM_DATABASE_URL ausente');
  return linha.slice('PLATFORM_DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
}

const email = process.argv[2];
const valor = process.argv[3];
if (!email || (valor !== 'PADRAO' && valor !== 'ECOLUME')) {
  throw new Error('uso: email PADRAO|ECOLUME');
}

async function main(): Promise<void> {
  process.env.PLATFORM_DATABASE_URL = urlDaPlataforma();
  const prisma = new PrismaClient();
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: { empresaId: true, empresa: { select: { configuracoes: true } } },
    });
    if (!usuario) throw new Error(`usuario nao encontrado: ${email}`);
    const atual = (usuario.empresa.configuracoes ?? {}) as Record<string, unknown>;
    atual.personalizacaoComercial = valor;
    await prisma.empresa.update({
      where: { id: usuario.empresaId },
      data: { configuracoes: atual },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro: unknown) => {
  process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`);
  process.exit(1);
});
