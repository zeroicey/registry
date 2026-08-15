import ky from 'ky';
import { env } from '@/config/env';

/**
 * The ONLY HTTP client in the app.
 * - `throwHttpErrors: false` — non-2xx responses are passed to `unwrap()`
 *   instead of being thrown by ky, so feature code only ever sees typed data.
 * - `credentials: "include"` — cookies are sent (auth-ready).
 * - `retry: 1` — one automatic retry for transient failures.
 *
 * No `prefix` option: ky prepends it to ANY string input (absolute URLs
 * included), which would double up with `apiUrl()`/`resolveApiPath()` — the
 * full request URL (base + path + query) is always built by `apiUrl()`.
 */
export const apiClient = ky.create({
  credentials: 'include',
  throwHttpErrors: false,
  retry: 1,
  timeout: 15_000,
});

/** Join the env base URL and a backend path, normalizing slashes. */
export function resolveApiPath(path: string): string {
  const base = (env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  const normalizedPath = path.trim().replace(/^\/+/, '');
  return normalizedPath ? `${base}/${normalizedPath}` : base || '/';
}

export type QueryParams = Record<string, string | number | boolean | undefined>;

/**
 * Resolve a full request URL (path + optional query params).
 * Undefined values are skipped. Always use this (or `resolveApiPath`) when
 * calling `apiClient` — never hardcode URLs in features.
 */
export function apiUrl(path: string, query?: QueryParams): string {
  const url = new URL(resolveApiPath(path), window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}
