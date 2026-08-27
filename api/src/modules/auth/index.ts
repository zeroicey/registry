import { env } from '@/env';
import { createAuthHandlers, createAuthMiddleware } from './auth.handler';
import { createAuthRouter } from './auth.router';
import { AuthService } from './auth.service';

// ---------------------------------------------------------------------------
// Auth module barrel — the ONLY place that wires the env-based singleton.
// app.ts imports { authRouter, authMiddleware } from this module; tests build
// their own AuthService instances and never touch process.env.
// ---------------------------------------------------------------------------

export const authService = new AuthService({
  sessionSecret: env.SESSION_SECRET,
  sessionTtlSeconds: env.SESSION_TTL,
  oidcIssuer: env.OIDC_ISSUER,
  oidcClientId: env.OIDC_CLIENT_ID,
  oidcClientSecret: env.OIDC_CLIENT_SECRET,
  apiToken: env.API_TOKEN,
});

export const authHandlers = createAuthHandlers(authService);
export const authMiddleware = createAuthMiddleware(authService);
export const authRouter = createAuthRouter(authHandlers).basePath('/auth');
