import { z } from 'zod';

/**
 * Typed environment loader (Bun natively reads .env — no dotenv).
 * Fails fast with a readable report when the environment is invalid.
 *
 * DATABASE_URL: required in production; in development/test a local
 * default is used so `bun run dev` and `bun test` work out of the box.
 */
const FALLBACK_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/registry';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),
  DATABASE_LOGGING: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  // Comma-separated allowed origins; `*` allows any origin (open CORS).
  CORS_ORIGINS: z
    .string()
    .default('*')
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1_048_576),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  throw new Error('Invalid environment configuration — fix your environment and restart.');
}

const envData = parsed.data;

if (envData.NODE_ENV === 'production' && envData.DATABASE_URL === undefined) {
  throw new Error('DATABASE_URL is required when NODE_ENV=production.');
}

export const env = {
  ...envData,
  DATABASE_URL: envData.DATABASE_URL ?? FALLBACK_DATABASE_URL,
} as const;

export type Env = typeof env;
