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

  const uploadBodyLimit = bodyLimit({
    maxSize: env.UPLOAD_MAX_SIZE + 1024 * 1024,
    onError: (c) =>
      c.json({ success: false, message: Msg.PAYLOAD_TOO_LARGE, code: 'PAYLOAD_TOO_LARGE' }, 413),
  });
  const defaultBodyLimit = bodyLimit({
    maxSize: env.BODY_LIMIT_BYTES,
    onError: (c) =>
      c.json({ success: false, message: Msg.PAYLOAD_TOO_LARGE, code: 'PAYLOAD_TOO_LARGE' }, 413),
  });

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
      // This service is directly exposed on the EasyTier address. Forwarded
      // headers are not authenticated here, so trusting them would let clients
      // evade the in-memory limit by forging a new source IP per request.
      keyGenerator: () => 'registry-direct',
      handler: (c) =>
        c.json({ success: false, message: Msg.RATE_LIMITED, code: 'RATE_LIMITED' }, 429),
      store: new MemoryStore(),
    }),
    // Only multipart file uploads need the larger envelope allowance. Keep the
    // tighter default cap for JSON APIs to avoid accepting unnecessarily large bodies.
    async (c, next) => {
      const isFileUpload =
        c.req.method === 'POST' &&
        c.req.path.startsWith('/api/users/') &&
        c.req.path.endsWith('/files');
      return (isFileUpload ? uploadBodyLimit : defaultBodyLimit)(c, next);
    },
    timeout(env.REQUEST_TIMEOUT_MS, new HTTPException(408, { message: Msg.REQUEST_TIMEOUT })),
  ];
})();
