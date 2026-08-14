import { pino } from 'pino';
import { env } from '@/env';

/** Structured JSON logger. Env-driven level (LOG_LEVEL). */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'registry-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
});
