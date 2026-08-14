import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { AppError } from './errors';
import { logger } from './logger';
import { Msg } from './messages';

/** Status → business code for framework exceptions (hono/timeout, etc.). */
const HTTP_CODE_MAP: Partial<Record<number, AppError['code']>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  408: 'REQUEST_TIMEOUT',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

const HTTP_MESSAGE_MAP: Partial<Record<number, string>> = {
  400: Msg.BAD_REQUEST,
  401: Msg.UNAUTHORIZED,
  403: Msg.FORBIDDEN,
  404: Msg.NOT_FOUND,
  408: Msg.REQUEST_TIMEOUT,
  409: Msg.CONFLICT,
  413: Msg.PAYLOAD_TOO_LARGE,
  429: Msg.RATE_LIMITED,
  503: Msg.SERVICE_UNAVAILABLE,
};

/**
 * Global error handler — wired in app.ts via app.onError.
 * Maps every thrown error to the unified response envelope:
 *   AppError      → status from the error, body carries code + optional details
 *   HTTPException → framework exceptions (e.g. request timeout) rendered uniformly
 *   SyntaxError   → 400 (malformed JSON body)
 *   anything else → 500, logged, stack never leaked
 */
export function onError(err: Error, c: Context): Response {
  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        message: err.message,
        code: err.code,
        ...(err.details === undefined ? {} : { error: err.details }),
      },
      err.status as ContentfulStatusCode,
    );
  }

  if (err instanceof HTTPException) {
    return c.json(
      {
        success: false,
        message: HTTP_MESSAGE_MAP[err.status] ?? err.message,
        code: HTTP_CODE_MAP[err.status] ?? 'INTERNAL',
      },
      err.status as ContentfulStatusCode,
    );
  }

  if (err instanceof SyntaxError) {
    return c.json({ success: false, message: Msg.BAD_REQUEST, code: 'BAD_REQUEST' }, 400);
  }

  logger.error({ err, method: c.req.method, path: c.req.path }, 'Unhandled error');
  return c.json({ success: false, message: Msg.INTERNAL_ERROR, code: 'INTERNAL' }, 500);
}
