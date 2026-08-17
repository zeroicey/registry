import { existsSync } from 'node:fs';
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { env } from '@/env';
import { requestLogger, security } from '@/middleware';
import { attributesRouter } from '@/modules/attributes/attributes.router';
import { commentsRouter } from '@/modules/comments/comments.router';
import { filesRouter } from '@/modules/files/files.router';
import { healthRouter } from '@/modules/health/health.router';
import { sourceFilesRouter } from '@/modules/source-files/source-files.router';
import { usersRouter } from '@/modules/users/users.router';
import { onError } from '@/shared/error-handler';
import { Msg } from '@/shared/messages';

/** Built SPA assets land here in the production image (root Dockerfile). */
const WEB_DIST = './web-dist';

/**
 * Build the Hono app: global middleware (logging + security) first,
 * unified error contract, then module routers. In production the built
 * React SPA is served from the same origin — /assets/* as static files,
 * any other GET falling back to index.html (react-router owns routing).
 */
export function createApp(): Hono {
  const app = new Hono();

  // Global middleware: request logging first, then the security chain.
  app.use(requestLogger);
  app.use(...security);

  // Unified error contract.
  app.onError(onError);
  app.notFound((c) => c.json({ success: false, message: Msg.NOT_FOUND, code: 'NOT_FOUND' }, 404));

  // Module routers — mounted under /api so the SPA can own every other path
  // (deep links like /users/4 must fall back to index.html, not clash with
  // the JSON API).
  app.route('/api/health', healthRouter);
  app.route('/api/attributes', attributesRouter);
  app.route('/api/users', usersRouter);
  app.route('/api', commentsRouter); // POST/GET /api/users/:userId/comments, PATCH/DELETE /api/comments/:id
  app.route('/api', filesRouter); // POST/GET /api/users/:userId/files, GET/DELETE /api/files/:id/content
  app.route('/api/source-files', sourceFilesRouter); // POST/GET /api/source-files, GET /api/source-files/:id/content

  // Production only: serve the built SPA from the same origin. Registered
  // after the API routers so /users etc. always hit the API first.
  if (env.NODE_ENV === 'production' && existsSync(WEB_DIST)) {
    app.use('/assets/*', serveStatic({ root: WEB_DIST }));
    app.get('*', serveStatic({ path: `${WEB_DIST}/index.html` }));
  }

  return app;
}
