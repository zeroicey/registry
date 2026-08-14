/**
 * Business error codes — the programmatic identifier carried in the
 * unified response envelope (`code` field). HTTP status is derived
 * from the code unless explicitly overridden.
 */
export const ERROR_CODES = {
  VALIDATION: 400,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  REQUEST_TIMEOUT: 408,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL: 500,
  // ── module-specific codes ──
  TODO_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export const DEFAULT_STATUS: Record<ErrorCode, number> = ERROR_CODES;

/**
 * App-level error. Throw it anywhere (handlers, services, middleware);
 * the global onError maps it to the unified response envelope.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status ?? DEFAULT_STATUS[code];
    if (details !== undefined) {
      this.details = details;
    }
  }
}
