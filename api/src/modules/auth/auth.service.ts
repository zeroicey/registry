import type * as oidc from 'openid-client';
import * as openidClient from 'openid-client';
import { logger } from '@/shared/logger';
import {
  createPkcePair,
  DEFAULT_SESSION_TTL_SECONDS,
  OIDC_STATE_TTL_MS,
  randomToken,
  signSessionValue,
  verifySessionValue,
} from './auth.domain';
import type { OidcCallbackResult, OidcCallbackInput } from './auth.types';

// ---------------------------------------------------------------------------
// Auth service — Pocket ID OIDC login (authorization code + PKCE) over
// stateless session cookies. Zero user storage: a verified callback only
// mints a signed cookie; identity lives at the auth center.
//
// Login state (state → verifier/nonce/redirectUri) lives in an in-process
// memory Map with a 10-minute TTL, consumed exactly once. Token exchange and
// ID Token verification are delegated to openid-client (discovery + JWKS
// handled for us). Constructed with explicit config so tests never touch
// process.env.
//
// redirect_uri is derived per login attempt from the request origin and
// stored alongside the state: the intranet is reached through several
// origins (Tailscale IP, MagicDNS name), each registered as its own exact
// callback at Pocket ID. Recording it keeps the token exchange consistent
// with the authorize request (OAuth requires both to match byte-for-byte).
// ---------------------------------------------------------------------------

export interface AuthConfig {
  sessionSecret?: string | undefined;
  sessionTtlSeconds?: number | undefined;
  oidcIssuer?: string | undefined;
  oidcClientId?: string | undefined;
  oidcClientSecret?: string | undefined;
}

interface OidcLoginState {
  verifier: string;
  nonce: string;
  expiresAt: number;
  /** Exact redirect_uri used for the authorize request (origin + /auth/callback). */
  redirectUri: string;
}

/** Marker error so handlers can map failed logins to 401 without leaking why. */
export class UnauthorizedLoginError extends Error {}

/**
 * Minimal surface of `openid-client` the service relies on — injectable so
 * tests can supply a fake IdP without touching the global module registry.
 */
export interface OidcClientLike {
  discovery(
    issuerUrl: URL,
    clientId: string,
    clientSecret: string,
  ): Promise<oidc.Configuration>;
  buildAuthorizationUrl(
    config: oidc.Configuration,
    params: Record<string, string>,
  ): URL;
  authorizationCodeGrant(
    config: oidc.Configuration,
    currentUrl: URL,
    options: { pkceCodeVerifier: string; expectedState: string; expectedNonce: string },
  ): Promise<{ claims(): Record<string, unknown> | undefined }>;
}

export class AuthService {
  private readonly config: AuthConfig;
  private readonly oidc: OidcClientLike;

  // OIDC discovery client, cached per instance (lazy singleton).
  private clientPromise: Promise<oidc.Configuration> | null = null;

  // Login-state store: state → verifier/nonce/redirectUri, single-use.
  private readonly states = new Map<string, OidcLoginState>();

  constructor(config: AuthConfig, oidc: OidcClientLike = openidClient) {
    this.config = config;
    this.oidc = oidc;
  }

  /** Auth runs only when every required variable is present (dev may skip). */
  isAuthEnabled(): boolean {
    return Boolean(
      this.config.sessionSecret &&
        this.config.oidcIssuer &&
        this.config.oidcClientId &&
        this.config.oidcClientSecret,
    );
  }

  sessionTtlSeconds(): number {
    return this.config.sessionTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  }

  // ---- Session cookie (stateless, payload = expiry only) -------------------

  createSessionCookie(): string {
    const expires = Math.floor(Date.now() / 1000) + this.sessionTtlSeconds();
    // Callers/middleware gate on isAuthEnabled(), so the secret is always set
    // on any path that reaches here.
    return signSessionValue(this.config.sessionSecret ?? '', expires);
  }

  verifySessionCookie(value: string): boolean {
    if (!this.isAuthEnabled()) return true; // dev without auth: everything passes
    return verifySessionValue(
      this.config.sessionSecret ?? '',
      value,
      Math.floor(Date.now() / 1000),
    ).valid;
  }

  // ---- OIDC client discovery ------------------------------------------------

  private client(): Promise<oidc.Configuration> {
    if (!this.isAuthEnabled()) {
      throw new UnauthorizedLoginError('认证未配置，无法进行 OIDC 登录');
    }
    this.clientPromise ??= this.discover();
    return this.clientPromise;
  }

  private async discover(): Promise<oidc.Configuration> {
    let issuerUrl: URL;
    try {
      issuerUrl = new URL(this.config.oidcIssuer ?? '');
    } catch {
      throw new UnauthorizedLoginError('OIDC_ISSUER 配置无效');
    }
    return this.oidc.discovery(
      issuerUrl,
      this.config.oidcClientId ?? '',
      this.config.oidcClientSecret ?? '',
    );
  }

  // ---- Login-state store ----------------------------------------------------

  private sweepStates(nowMs: number): void {
    for (const [key, rec] of this.states) {
      if (nowMs >= rec.expiresAt) this.states.delete(key);
    }
  }

  /**
   * Build the auth-center authorize URL: random state + nonce + S256 PKCE
   * pair, login state kept in memory keyed by state. `webOrigin` is the
   * browser-facing origin of THIS request (e.g. http://100.64.0.1:3100); the
   * callback URL becomes `<webOrigin>/auth/callback`, which must be one of
   * the exact callbacks registered at Pocket ID.
   */
  async buildOidcAuthorizeUrl(webOrigin: string, nowMs: number = Date.now()): Promise<string> {
    let originUrl: URL;
    try {
      originUrl = new URL(webOrigin);
    } catch {
      throw new UnauthorizedLoginError('请求来源无法解析为合法回调地址');
    }
    if (originUrl.protocol !== 'http:' && originUrl.protocol !== 'https:') {
      throw new UnauthorizedLoginError('请求来源协议不受支持');
    }

    const client = await this.client();
    this.sweepStates(nowMs);

    const state = randomToken(32);
    const nonce = randomToken(32);
    const { verifier, challenge } = createPkcePair();
    const redirectUri = `${originUrl.origin}/auth/callback`;
    this.states.set(state, { verifier, nonce, expiresAt: nowMs + OIDC_STATE_TTL_MS, redirectUri });

    const authorizationUrl = this.oidc.buildAuthorizationUrl(client, {
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return authorizationUrl.href;
  }

  /**
   * Complete the callback: consume the state once → exchange code+verifier →
   * verify nonce via openid-client → return the verified subject. Any failure
   * throws {@link UnauthorizedLoginError}; the message deliberately does not
   * distinguish "bad state" from "used code" (smaller probing surface).
   *
   * `input.query` is the full redirect query string as received by the SPA.
   */
  async handleOidcCallback(
    input: OidcCallbackInput,
    nowMs: number = Date.now(),
  ): Promise<OidcCallbackResult> {
    const raw = input.query.startsWith('?') ? input.query.slice(1) : input.query;
    const params = new URLSearchParams(raw);
    const state = params.get('state') ?? '';
    const record = state ? this.states.get(state) : undefined;
    this.sweepStates(nowMs);
    if (!state || !record || nowMs >= record.expiresAt) {
      throw new UnauthorizedLoginError('登录状态无效或已过期，请重新登录');
    }
    // Delete before use: one successful completion per state; replays fall through.
    this.states.delete(state);

    try {
      const client = await this.client();
      // Rebuild the redirect URL from the recorded redirect_uri + the FULL
      // forwarded query (RFC 9207 iss parameter must pass through untouched).
      const currentUrl = new URL(`${record.redirectUri}?${params.toString()}`);
      const tokens = await this.oidc.authorizationCodeGrant(client, currentUrl, {
        pkceCodeVerifier: record.verifier,
        expectedState: state,
        expectedNonce: record.nonce,
      });
      const claims = tokens.claims();
      if (!claims?.sub || typeof claims.sub !== 'string') {
        throw new Error('missing sub claim');
      }
      logger.info({ sub: claims.sub }, 'Login succeeded via Pocket ID');
      return { sub: claims.sub };
    } catch (err) {
      logger.warn({ err }, 'OIDC callback verification failed');
      throw new UnauthorizedLoginError('登录验证失败，请重新登录');
    }
  }
}
