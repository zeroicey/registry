import { z } from 'zod';

/**
 * Body of POST /api/auth/oidc/callback. The SPA forwards the FULL redirect
 * query string it received (code, state, iss, …) — RFC 9207 `iss` support
 * requires every parameter to reach the token exchange untouched.
 */
export const OidcCallbackSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(4096)
    .refine((q) => q.includes('code=') && q.includes('state='), {
      message: '回调参数缺少 code 或 state',
    }),
});

export type OidcCallbackInput = z.infer<typeof OidcCallbackSchema>;

/** Result of a completed OIDC callback — identity is NOT persisted anywhere. */
export interface OidcCallbackResult {
  /** Pocket ID subject id; only used for logging. */
  sub: string;
}

/** Session status reported by GET /api/auth/me. */
export interface AuthStatusEntry {
  authenticated: boolean;
}
