import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ErrorCode } from './errors';
import { ERROR_CODES } from './errors';

/**
 * Unified response envelope:
 *   { success, message, code?, data?, error? }
 * `success` + `message` are always present; `code` / `data` / `error`
 * are OMITTED when unset (undefined, never null).
 */
export interface ResponseBody<T = unknown> {
  success: boolean;
  message: string;
  code?: ErrorCode;
  data?: T;
  error?: unknown;
}

export class Res<T = never> {
  private constructor(
    private readonly payload: ResponseBody<T> | undefined,
    private readonly status: number,
    private readonly emptyBody: boolean = false,
  ) {}

  // ── success builders ──
  static ok<T>(message: string, data?: T): Res<T> {
    return new Res({ success: true, message, ...(data === undefined ? {} : { data }) }, 200);
  }

  static created<T>(message: string, data?: T): Res<T> {
    return new Res({ success: true, message, ...(data === undefined ? {} : { data }) }, 201);
  }

  static noContent(_message: string): Res<never> {
    return new Res(undefined, 204, true);
  }

  // ── error builder ──
  static error(message: string, code: ErrorCode, status?: number, error?: unknown): Res<never> {
    return new Res(
      { success: false, message, code, ...(error === undefined ? {} : { error }) },
      status ?? ERROR_CODES[code],
    );
  }

  // ── error shortcuts (status derived from code) ──
  static badRequest(message: string, error?: unknown): Res<never> {
    return Res.error(message, 'BAD_REQUEST', undefined, error);
  }

  static unauthorized(message: string): Res<never> {
    return Res.error(message, 'UNAUTHORIZED');
  }

  static forbidden(message: string): Res<never> {
    return Res.error(message, 'FORBIDDEN');
  }

  static notFound(message: string): Res<never> {
    return Res.error(message, 'NOT_FOUND');
  }

  static conflict(message: string): Res<never> {
    return Res.error(message, 'CONFLICT');
  }

  static internalError(message: string): Res<never> {
    return Res.error(message, 'INTERNAL');
  }

  build(c: Context): Response {
    if (this.emptyBody) {
      return new Response(null, { status: this.status });
    }
    return c.json(this.payload, this.status as ContentfulStatusCode);
  }
}
