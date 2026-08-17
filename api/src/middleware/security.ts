import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { timeout } from 'hono/timeout';
import { MemoryStore, rateLimiter } from 'hono-rate-limiter';
import { env } from '@/env';
import { Msg } from '@/shared/messages';

/**
 * Global security middleware chain, in order:
 *   cors → secure-headers → csrf → rate-limit → body-limit → timeout
 * CSRF origin enforcement only makes sense when CORS is locked down;
 * with CORS_ORIGINS=* every origin is trusted anyway, so it is skipped.
 */
export const security: MiddlewareHandler[] = (() => {
  const corsOrigins = env.CORS_ORIGINS;
  const isOpenCors = corsOrigins.includes('*');

  return [
    cors({
      origin: isOpenCors ? '*' : corsOrigins,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: 86_400,
      credentials: !isOpenCors,
    }),
    secureHeaders(),
    ...(isOpenCors
      ? []
      : [
          csrf({
            origin: corsOrigins,
          }),
        ]),
    rateLimiter({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: 'draft-7',
      keyGenerator: (c) =>
        c.req.header('cf-connecting-ip') ??
        c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
        'anonymous',
      handler: (c) =>
        c.json({ success: false, message: Msg.RATE_LIMITED, code: 'RATE_LIMITED' }, 429),
      store: new MemoryStore(),
    }),
    // Request-body cap must cover file uploads: widen to UPLOAD_MAX_SIZE + 1MB
    // of multipart envelope overhead. The true per-file limit is enforced inside
    // files.service (413 when a single file exceeds UPLOAD_MAX_SIZE).
    bodyLimit({
      maxSize: Math.max(env.BODY_LIMIT_BYTES, env.UPLOAD_MAX_SIZE + 1024 * 1024),
      onError: (c) =>
        c.json({ success: false, message: Msg.PAYLOAD_TOO_LARGE, code: 'PAYLOAD_TOO_LARGE' }, 413),
    }),
    timeout(env.REQUEST_TIMEOUT_MS, new HTTPException(408, { message: Msg.REQUEST_TIMEOUT })),
  ];
})();
