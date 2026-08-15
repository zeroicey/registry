/** HTTP status sentinel for network-level failures (no response received). */
export const NETWORK_ERROR_STATUS = 0;

/**
 * Typed API error — thrown by `unwrap()` for every failed request.
 * `message` is the backend envelope message (or a network/fallback message),
 * `status` the HTTP status (0 = network error), `detail` the extracted error
 * payload, `code` the backend business code (e.g. "NOT_FOUND").
 */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | undefined;
  readonly code: string | undefined;

  constructor(
    message: string,
    status: number = NETWORK_ERROR_STATUS,
    detail?: string,
    code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.code = code;
  }
}

function stringifyDetail(detail: unknown): string | undefined {
  if (typeof detail === 'string') return detail;
  if (detail === undefined || detail === null) return undefined;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

/**
 * Normalize any thrown value into a human-readable message — the single
 * formatter for sonner toasts and inline error UI in features.
 */
export function toDisplayError(error: unknown): string {
  if (error instanceof ApiError) {
    const suffix = error.detail ? `（${error.detail}）` : '';
    return `${error.message}${suffix}`;
  }
  if (error instanceof Error) return error.message;
  return '发生未知错误，请稍后重试';
}

export { stringifyDetail };
