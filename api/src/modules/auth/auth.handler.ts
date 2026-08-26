import type { Context, MiddlewareHandler } from 'hono';
import { logger } from '@/shared/logger';
import { Msg } from '@/shared/messages';
import {
  buildSessionCookie,
  buildSecureSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE_NAME,
} from './auth.domain';
import { UnauthorizedLoginError, type AuthService } from './auth.service';
import { OidcCallbackSchema } from './auth.types';
import { Res } from '@/shared/response';

// ---------------------------------------------------------------------------
// Auth handlers + middleware. Set-Cookie is assembled here; the cookie flags
// follow the deployment reality: same-origin (Hono serves the SPA) →
// SameSite=Lax, intranet http → no Secure flag.
// ---------------------------------------------------------------------------

/** Best-effort client ip for login logs (never security-critical here). */
function clientIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? 'unknown'
  );
}

function sessionCookieHeader(c: Context, service: AuthService, value: string): string {
  const maxAge = service.sessionTtlSeconds();
  return c.req.header('x-forwarded-proto') === 'https'
    ? buildSecureSessionCookie(value, maxAge)
    : buildSessionCookie(value, maxAge);
}

export function createAuthHandlers(service: AuthService) {
  return {
    /** GET /api/auth/oidc/url — build the auth-center authorize redirect URL. */
    async oidcAuthorize(c: Context): Promise<Response> {
      if (!service.isAuthEnabled()) {
        return Res.error(Msg.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE').build(c);
      }
      try {
        const url = new URL(c.req.url);
        const forwardedProto = c.req.header('x-forwarded-proto');
        const origin = forwardedProto ? `${forwardedProto}://${url.host}` : url.origin;
        const authorizationUrl = await service.buildOidcAuthorizeUrl(origin);
        logger.info({ ip: clientIp(c), origin }, 'OIDC authorize URL issued');
        return Res.ok('获取授权地址成功', { authorizationUrl }).build(c);
      } catch (err) {
        if (err instanceof UnauthorizedLoginError) {
          return Res.unauthorized(err.message).build(c);
        }
        throw err;
      }
    },

    /** POST /api/auth/oidc/callback — exchange code+state for a session cookie. */
    async oidcCallback(c: Context): Promise<Response> {
      const parsed = OidcCallbackSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) {
        return Res.badRequest(Msg.VALIDATION_ERROR).build(c);
      }
      try {
        await service.handleOidcCallback(parsed.data);
        c.header('Set-Cookie', sessionCookieHeader(c, service, service.createSessionCookie()));
        return Res.ok('登录成功', { authenticated: true }).build(c);
      } catch (err) {
        if (err instanceof UnauthorizedLoginError) {
          return Res.unauthorized(err.message).build(c);
        }
        throw err;
      }
    },

    /** POST /api/auth/logout — clear the session cookie. */
    async logout(c: Context): Promise<Response> {
      c.header('Set-Cookie', clearSessionCookie());
      logger.info({ ip: clientIp(c) }, 'Logout');
      return Res.ok('已退出登录', { authenticated: false }).build(c);
    },

    /** GET /api/auth/me — public probe used by the SPA's AuthGuard. */
    async me(c: Context): Promise<Response> {
      const value = readSessionCookie(c);
      const authenticated = value !== null && service.verifySessionCookie(value);
      return Res.ok(Msg.OK, { authenticated }).build(c);
    },
  };
}

/** Extract the raw session-cookie value from the request, or null. */
export function readSessionCookie(c: Context): string | null {
  const header = c.req.header('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE_NAME) return rest.join('=');
  }
  return null;
}

/**
 * Gate every /api/* route: pass health + auth endpoints through, require a
 * valid session cookie everywhere else. When auth is unconfigured (dev/test)
 * the gate opens entirely so local development stays friction-free.
 */
export function createAuthMiddleware(service: AuthService): MiddlewareHandler {
  return async (c, next) => {
    if (!service.isAuthEnabled()) return next();

    const path = c.req.path;
    if (path.startsWith('/api/health') || path.startsWith('/api/auth/')) {
      return next();
    }

    const value = readSessionCookie(c);
    if (value !== null && service.verifySessionCookie(value)) return next();

    return Res.unauthorized(Msg.UNAUTHORIZED).build(c);
  };
}
