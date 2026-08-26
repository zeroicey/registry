import { Hono } from 'hono';
import type { createAuthHandlers } from './auth.handler';

/**
 * Auth routes mounted at /api/auth by app.ts:
 *   GET  /api/auth/oidc/url     → authorize redirect URL
 *   POST /api/auth/oidc/callback → code+state exchange, sets session cookie
 *   POST /api/auth/logout       → clears the session cookie
 *   GET  /api/auth/me           → public login-state probe
 */
export function createAuthRouter(handlers: ReturnType<typeof createAuthHandlers>): Hono {
  const router = new Hono();

  router.get('/oidc/url', handlers.oidcAuthorize);
  router.post('/oidc/callback', handlers.oidcCallback);
  router.post('/logout', handlers.logout);
  router.get('/me', handlers.me);

  return router;
}
