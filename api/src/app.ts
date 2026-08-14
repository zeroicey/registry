import { Hono } from 'hono';
import { requestLogger, security } from '@/middleware';
import { healthRouter } from '@/modules/health/health.router';
import { todosRouter } from '@/modules/todos';
import { onError } from '@/shared/error-handler';
import { Msg } from '@/shared/messages';

/**
 * Build the Hono app: global middleware (logging + security) first,
 * unified error contract, then module routers.
 */
export function createApp(): Hono {
  const app = new Hono();

  // Global middleware: request logging first, then the security chain.
  app.use(requestLogger);
  app.use(...security);

  // Unified error contract.
  app.onError(onError);
  app.notFound((c) => c.json({ success: false, message: Msg.NOT_FOUND, code: 'NOT_FOUND' }, 404));

  // Module routers.
  app.route('/health', healthRouter);
  app.route('/todos', todosRouter);

  return app;
}
