/**
 * Cria somente a empresa de demonstração Concreto, já descrita no seed e ausente neste banco.
 * O seed atual só grava a empresa de iluminação. Não altera a empresa existente nem a clínica.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as argon2 from 'argon2';
import { configuracoesEmpresaPadrao } from '@arcco/contratos';
import { BANCO_EMPRESA_UNICO } from '../src/database/banco-empresa';
import { PrismaClient } from '../src/database/generated/platform';

const EMAIL = 'proprietario.concreto@demo.arcco.local';

function urlDaPlataforma(): string {
  const texto = readFileSync(resolve(__dirname, '../.env'), 'utf8').replace(/^\uFEFF/, '');
  const linha = texto
    .split(/\r?\n/)
    .map((item) => item.replace(/^\uFEFF/, '').trim())
    .find((item) => item.startsWith('PLATFORM_DATABASE_URL='));
  if (!linha) throw new Error('PLATFORM_DATABASE_URL ausente');
  return linha.slice('PLATFORM_DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
}

async function main(): Promise<void> {
  process.env.PLATFORM_DATABASE_URL = urlDaPlataforma();
  const prisma = new PrismaClient();
  try {
    const existente = await prisma.usuario.findUnique({ where: { email: EMAIL } });
    if (existente) {
      process.stdout.write('empresa concreto ja existe\n');
      return;
    }
    const config = configuracoesEmpresaPadrao();
    config.onboardingConcluido = true;
    const senhaHash = await argon2.hash('Arcco@123', { type: argon2.argon2id });
    const empresa = await prisma.empresa.create({
      data: {
        nome: 'ARCCO Demo Concreto',
        nomeFantasia: 'ARCCO Demo Concreto',
        segmento: 'CONCRETO',
        cidade: 'Campinas',
        estado: 'SP',
        telefone: '(19) 3200-2000',
        configuracoes: config,
        databaseHost: BANCO_EMPRESA_UNICO.host,
        databasePort: BANCO_EMPRESA_UNICO.port,
        databaseName: BANCO_EMPRESA_UNICO.name,
      },
    });
    await prisma.usuario.create({
      data: {
        empresaId: empresa.id,
        nome: 'Otavio Concer',
        email: EMAIL,
        senhaHash,
        perfil: 'PROPRIETARIO',
      },
    });
    process.stdout.write(`empresa criada: ${empresa.id}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
