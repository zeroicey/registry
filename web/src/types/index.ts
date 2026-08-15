/**
 * Shared types — cross-feature contracts.
 *
 * The backend's unified response envelope (see api/src/shared/response.ts):
 *   { success, message, code?, data?, error? }
 * `success` + `message` are always present; `code` / `data` / `error` are
 * omitted when unset (never null). Parsed by `api/unwrap.ts`.
 */
export interface ApiEnvelope<T = unknown> {
  success: boolean;
  message: string;
  /** Business error code, e.g. "NOT_FOUND" (failure responses only). */
  code?: string;
  /** Payload of a successful response. */
  data?: T;
  /** Extra failure details (validation issues, etc.). */
  error?: unknown;
}

/** Backend pagination envelope (see api/src/modules — PaginatedResult in each module's types.ts). */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
