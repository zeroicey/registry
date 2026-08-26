import { ApiError } from '@/api/errors';
import { apiClient, apiUrl } from '@/api/client';
import { unwrap } from '@/api/unwrap';
import type { AuthStatusEntry } from './types';

// ---------------------------------------------------------------------------
// Auth API contract. All requests go through the shared `apiClient` (ky,
// credentials included) like every other feature. The session itself is an
// HttpOnly cookie set by the backend — the SPA only ever forwards the OIDC
// redirect query and reads status.
// ---------------------------------------------------------------------------

interface OidcAuthorizeEntry {
  authorizationUrl: string;
}

/** Ask the backend for an auth-center authorize URL (state/nonce/PKCE server-side). */
export async function fetchOidcAuthorizeUrl(): Promise<string> {
  const response = await apiClient.get(apiUrl('auth/oidc/url'));
  return (await unwrap<OidcAuthorizeEntry>(response)).authorizationUrl;
}

/**
 * Complete the login: forward the FULL redirect query string (code, state,
 * iss, …) to the backend; a successful exchange sets the HttpOnly session
 * cookie on the same origin.
 */
export async function postOidcCallback(queryString: string): Promise<AuthStatusEntry> {
  const response = await apiClient.post(apiUrl('auth/oidc/callback'), {
    json: { query: queryString },
  });
  await unwrap<AuthStatusEntry>(response);
  return { authenticated: true };
}

/** Clear the session cookie. */
export async function postLogout(): Promise<void> {
  const response = await apiClient.post(apiUrl('auth/logout'));
  await unwrap(response);
}

/**
 * Probe the current login state. A missing/expired session — or a temporarily
 * unreachable backend — is a normal "logged out" state for the guard, never
 * an error thrown into feature code.
 */
export async function fetchAuthStatus(): Promise<AuthStatusEntry> {
  try {
    const response = await apiClient.get(apiUrl('auth/me'));
    const entry = await unwrap<AuthStatusEntry | null>(response);
    return { authenticated: entry?.authenticated === true };
  } catch (error) {
    void (error instanceof ApiError ? error.status : undefined);
    return { authenticated: false };
  }
}
