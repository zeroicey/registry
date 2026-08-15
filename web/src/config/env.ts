import { z } from 'zod';

/**
 * Typed environment loader — the ONLY place that reads `import.meta.env`.
 * Every env var is declared and validated here; components import `env`
 * from this module and never touch `import.meta.env` directly.
 */
const envSchema = z.object({
  /** Display name shown in the navbar, footer and welcome page. */
  VITE_APP_NAME: z.string().trim().min(1).default('Registry'),
  /**
   * Base URL of the backend API. Relative ("/api") in dev — Vite proxies it
   * to the Bun backend; use an absolute URL in production builds.
   */
  VITE_API_BASE_URL: z.string().trim().default('/api'),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment variables:\n${details}\nFix .env / .env.local and restart.`);
}

/** Validated, typed environment. */
export const env = parsed.data;
