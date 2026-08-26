import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------------
// Auth domain — pure rules only, no DB / IO / env imports:
//   stateless session-cookie signing & verification (HMAC-SHA256 over the
//   expiry timestamp), cookie header builders, constant-time comparison and
//   OIDC login-state helpers (PKCE pair / state / nonce).
//
// Design notes (see .ai/requirements/2026-08-26-pocket-id-auth.md):
//   - Zero user storage: identity verification is delegated to Pocket ID; a
//     successful OIDC callback mints a signed cookie whose payload carries
//     ONLY the expiry timestamp — there is no userId to store.
//   - Same-origin deployment behind Hono → SameSite=Lax is sufficient, and the
//     intranet entry points are plain http, so Secure must NOT be set (browsers
//     would refuse to store the cookie).
// ---------------------------------------------------------------------------

export const SESSION_COOKIE_NAME = 'registry_session';
// Decision ⑥ (2026-08-26): 3-day sessions, aligned with serenique.
export const DEFAULT_SESSION_TTL_SECONDS = 3 * 24 * 3600;
// OIDC login-state (state → verifier/nonce) TTL: an authorize round-trip
// normally completes within seconds.
export const OIDC_STATE_TTL_MS = 10 * 60_000;

const SESSION_PREFIX = 'registry-session.';

/** Constant-time string compare. */
export function secretsEqual(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Sign a session value carrying only the expiry:
 * "<exp>.<base64url(HMAC-SHA256(secret, prefix+exp))>".
 */
export function signSessionValue(secret: string, expires: number): string {
  const sig = createHmac('sha256', secret)
    .update(`${SESSION_PREFIX}${expires}`)
    .digest('base64url');
  return `${expires}.${sig}`;
}

export type SessionVerifyResult =
  | { valid: true }
  | { valid: false; reason: 'malformed' | 'tampered' | 'expired' };

/** Verify a session value at a given unix-second clock. */
export function verifySessionValue(
  secret: string,
  value: string,
  nowSec: number,
): SessionVerifyResult {
  const dot = value.indexOf('.');
  if (dot <= 0) return { valid: false, reason: 'malformed' };
  const expires = Number(value.slice(0, dot));
  if (!Number.isInteger(expires) || expires <= 0) {
    return { valid: false, reason: 'malformed' };
  }
  const signature = value.slice(dot + 1);
  const expectedSignature = signSessionValue(secret, expires).slice(dot + 1);
  if (!secretsEqual(signature, expectedSignature)) {
    return { valid: false, reason: 'tampered' };
  }
  if (expires < nowSec) return { valid: false, reason: 'expired' };
  return { valid: true };
}

/**
 * Build a Set-Cookie header. Same-origin deployment → SameSite=Lax; the
 * intranet is plain http so Secure must NOT be set (browsers would refuse to
 * store it) — buildSecureSessionCookie exists for a future TLS reverse proxy.
 */
export function buildSessionCookie(value: string, maxAgeSeconds: number): string {
  return sessionCookieParts(value, maxAgeSeconds).join('; ');
}

/** Same as {@link buildSessionCookie} but with the Secure flag (https only). */
export function buildSecureSessionCookie(value: string, maxAgeSeconds: number): string {
  return `${sessionCookieParts(value, maxAgeSeconds).join('; ')}; Secure`;
}

function sessionCookieParts(value: string, maxAgeSeconds: number): string[] {
  return [
    `${SESSION_COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
}

export function clearSessionCookie(): string {
  return buildSessionCookie('', 0);
}

// ---- OIDC login-state helpers ----------------------------------------------
// Authorization-code + PKCE login-state generation: state guards against CSRF,
// nonce binds the ID Token, verifier/challenge form an S256 PKCE pair. The
// service keeps them in an in-memory Map keyed by state, consumed once.

/** URL-safe random token (base64url), for state / nonce / PKCE verifier. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** S256 PKCE pair: challenge = base64url(SHA256(verifier)). RFC 7636 §4.2. */
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomToken(32);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}
