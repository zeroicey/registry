import { createApp } from '@/app';
import { env } from '@/env';
import { logger } from '@/shared/logger';

const app = createApp();

const server = Bun.serve({
  hostname: env.HOST,
  port: env.PORT,
  fetch: app.fetch,
});

logger.info(`registry-api listening on http://${env.HOST}:${env.PORT} (${env.NODE_ENV})`);

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down');
  server.stop();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
