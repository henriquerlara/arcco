import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET muito curto'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET muito curto'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  WHATSAPP_PROVIDER: z.enum(['mock', 'evolution']).default('mock'),
  EVOLUTION_API_URL: z.string().optional().default(''),
  EVOLUTION_API_KEY: z.string().optional().default(''),
  EVOLUTION_WEBHOOK_SECRET: z.string().optional().default(''),
  API_PUBLIC_URL: z.string().default('http://localhost:3000'),

  AI_PROVIDER: z.enum(['rules', 'openai']).default('rules'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  STORAGE_PROVIDER: z.enum(['local', 'r2']).default('local'),
  LOCAL_STORAGE_PATH: z.string().default('./storage'),
  R2_ENDPOINT: z.string().optional().default(''),
  R2_REGION: z.string().optional().default('auto'),
  R2_BUCKET: z.string().optional().default(''),
  R2_ACCESS_KEY: z.string().optional().default(''),
  R2_SECRET_KEY: z.string().optional().default(''),

  OTEL_SERVICE_NAME: z.string().default('arcco-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional().default(''),
});

export type Env = z.infer<typeof envSchema>;

let cache: Env | null = null;

export function carregarEnv(): Env {
  if (cache) return cache;
  const resultado = envSchema.safeParse(process.env);
  if (!resultado.success) {
    const detalhes = resultado.error.flatten().fieldErrors;
    // eslint-disable-next-line no-console
    console.error('Variaveis de ambiente invalidas:', detalhes);
    throw new Error('Configuracao de ambiente invalida');
  }
  cache = resultado.data;
  return cache;
}

export function ehProducao(): boolean {
  return carregarEnv().NODE_ENV === 'production';
}
