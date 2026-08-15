/** Predefined message constants — keep user-facing strings in one place. */
export const Msg = {
  // ── generic ──
  OK: 'OK',
  CREATED: 'Created successfully',
  NO_CONTENT: 'No content',
  BAD_REQUEST: 'Bad request',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Resource not found',
  CONFLICT: 'Conflict',
  PAYLOAD_TOO_LARGE: 'Payload too large',
  REQUEST_TIMEOUT: 'Request timed out',
  RATE_LIMITED: 'Too many requests, please slow down',
  SERVICE_UNAVAILABLE: 'Service unavailable',
  INTERNAL_ERROR: 'Internal server error',
  VALIDATION_ERROR: 'Validation failed',
  // ── health ──
  HEALTH_OK: 'Service is healthy',
} as const satisfies Record<string, string>;

export type Message = (typeof Msg)[keyof typeof Msg];
