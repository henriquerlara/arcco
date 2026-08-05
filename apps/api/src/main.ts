import 'reflect-metadata';
import { iniciarObservabilidade } from './observabilidade/otel';

// Observabilidade deve ser iniciada antes de qualquer outra instrumentacao.
iniciarObservabilidade();

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module';
import { carregarEnv } from './config/env';

/** Aceita localhost e 127.0.0.1 (e variantes de porta) para desenvolvimento local. */
function origensPermitidas(frontendUrl: string): string[] {
  const base = frontendUrl.replace(/\/$/, '');
  const variantes = new Set<string>([base]);
  try {
    const url = new URL(base);
    if (url.hostname === 'localhost') {
      variantes.add(`${url.protocol}//127.0.0.1${url.port ? `:${url.port}` : ''}`);
    } else if (url.hostname === '127.0.0.1') {
      variantes.add(`${url.protocol}//localhost${url.port ? `:${url.port}` : ''}`);
    }
  } catch {
    // mantem apenas a URL original
  }
  return [...variantes];
}

async function bootstrap(): Promise<void> {
  const env = carregarEnv();
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: false },
  );

  // Casts pontuais: os plugins Fastify aumentam a instancia e o TS reclama da ordem
  // das augmentations; em runtime funciona normalmente.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  await app.register(cookie as any);
  await app.register(cors as any, {
    origin: origensPermitidas(env.FRONTEND_URL),
    credentials: true,
  });
  await app.register(helmet as any, {
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    // SPA em outra origem/porta precisa ler a API; same-origin bloqueia o fetch no browser.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await app.register(multipart as any, {
    limits: { fileSize: 20 * 1024 * 1024 },
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  app.setGlobalPrefix('api');

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.log(`ARCCO API ouvindo em http://localhost:${env.PORT}/api`);
}

void bootstrap();
