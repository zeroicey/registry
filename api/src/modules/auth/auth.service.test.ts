import { createHash } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import type * as oidc from 'openid-client';
import { AuthService, UnauthorizedLoginError, type OidcClientLike } from './auth.service';

// ---------------------------------------------------------------------------
// Unit tests for the OIDC orchestration. A fake IdP (OidcClientLike) enforces
// the same checks the real flow relies on: state round-trip, nonce binding,
// S256 PKCE and single-use consumption — without network or process.env.
// ---------------------------------------------------------------------------

const SESSION_SECRET = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'; // 32 hex chars, fake

/** Captured authorize requests by state (multiple logins can be in flight). */
const authorizesByState = new Map<string, Record<string, string>>();
/** When true the fake token endpoint fails (simulates IdP-side rejection). */
let failTokenExchange = false;

const fakeOidc: OidcClientLike = {
  async discovery(): Promise<oidc.Configuration> {
    return { fake: true } as unknown as oidc.Configuration;
  },
  buildAuthorizationUrl(_config, params): URL {
    if (typeof params.state === 'string') {
      authorizesByState.set(params.state, { ...params });
    }
    return new URL(`https://auth.example.test/authorize?${new URLSearchParams(params)}`);
  },
  async authorizationCodeGrant(_config, currentUrl, options) {
    const params = currentUrl.searchParams;
    const state = params.get('state');
    const authorize = state === null ? undefined : authorizesByState.get(state);
    if (!state || !authorize) throw new Error('no matching authorize request recorded');
    if (options.expectedState !== state) throw new Error('state mismatch');
    if (options.expectedNonce !== authorize.nonce) throw new Error('nonce mismatch');
    const digest = createHash('sha256').update(options.pkceCodeVerifier).digest('base64url');
    if (digest !== authorize.code_challenge) throw new Error('pkce verifier mismatch');
    if (failTokenExchange) throw new Error('token exchange rejected');
    return { claims: () => ({ sub: 'sub-123', email: 'owner@example.test' }) };
  },
};

function makeService(ttlSeconds?: number): AuthService {
  return new AuthService(
    {
      sessionSecret: SESSION_SECRET,
      ...(ttlSeconds === undefined ? {} : { sessionTtlSeconds: ttlSeconds }),
      oidcIssuer: 'https://auth.example.test',
      oidcClientId: 'client-1',
      oidcClientSecret: 'secret-1',
    },
    fakeOidc,
  );
}

async function loginThrough(
  service: AuthService,
  origin = 'http://100.64.0.1:3100',
): Promise<string> {
  const authorizeUrl = await service.buildOidcAuthorizeUrl(origin);
  const url = new URL(authorizeUrl);
  expect(url.origin + url.pathname).toBe('https://auth.example.test/authorize');
  expect(url.searchParams.get('redirect_uri')).toBe(`${origin}/auth/callback`);
  expect(url.searchParams.get('scope')).toBe('openid email profile');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  return `code=abc123&state=${url.searchParams.get('state')}&iss=https%3A%2F%2Fauth.example.test`;
}

describe('AuthService.isAuthEnabled / session cookie', () => {
  test('enabled only when all four config values are present', () => {
    expect(makeService().isAuthEnabled()).toBe(true);
    expect(new AuthService({}).isAuthEnabled()).toBe(false);
    expect(
      new AuthService({ sessionSecret: SESSION_SECRET, oidcIssuer: 'https://x' }).isAuthEnabled(),
    ).toBe(false);
  });

  test('session cookie round-trips; TTL defaults to 3 days', () => {
    const service = makeService();
    expect(service.sessionTtlSeconds()).toBe(3 * 24 * 3600);
    expect(makeService(3600).sessionTtlSeconds()).toBe(3600);

    const value = service.createSessionCookie();
    expect(service.verifySessionCookie(value)).toBe(true);
    expect(service.verifySessionCookie('garbage')).toBe(false);
  });
});

describe('OIDC login flow', () => {
  test('happy path: authorize → callback returns verified sub', async () => {
    const service = makeService();
    const query = await loginThrough(service);
    await expect(service.handleOidcCallback({ query })).resolves.toEqual({ sub: 'sub-123' });
  });

  test('state is single-use: replaying the callback fails', async () => {
    const service = makeService();
    const query = await loginThrough(service);
    await service.handleOidcCallback({ query });
    await expect(service.handleOidcCallback({ query })).rejects.toBeInstanceOf(
      UnauthorizedLoginError,
    );
  });

  test('unknown or tampered state is rejected', async () => {
    const service = makeService();
    await loginThrough(service);
    const forged = 'code=abc&state=tampered-state';
    await expect(service.handleOidcCallback({ query: forged })).rejects.toBeInstanceOf(
      UnauthorizedLoginError,
    );
  });

  test('expired login state (>10 min) is rejected', async () => {
    const service = makeService();
    const now = Date.now();
    const query = await loginThrough(service, /* origin */ 'http://hpcore.hpnet.internal:3100');
    void query; // consumed below at a shifted clock
    // Re-run with a controlled clock: build at t0, consume past the TTL.
    const service2 = makeService();
    const q2 = await loginThrough(service2);
    const tenMinutesLater = now + 11 * 60_000;
    await expect(
      service2.handleOidcCallback({ query: q2 }, tenMinutesLater),
    ).rejects.toBeInstanceOf(UnauthorizedLoginError);
  });

  test('IdP token-exchange failure surfaces as a generic login error', async () => {
    failTokenExchange = true;
    try {
      const service = makeService();
      const query = await loginThrough(service);
      await expect(service.handleOidcCallback({ query })).rejects.toBeInstanceOf(
        UnauthorizedLoginError,
      );
    } finally {
      failTokenExchange = false;
    }
  });

  test('each web origin gets its own exact redirect_uri', async () => {
    const service = makeService();
    const ipQuery = await loginThrough(service, 'http://100.64.0.1:3100');
    const dnsQuery = await loginThrough(service, 'http://hpcore.hpnet.internal:3100');
    await expect(service.handleOidcCallback({ query: ipQuery })).resolves.toEqual({
      sub: 'sub-123',
    });
    await expect(service.handleOidcCallback({ query: dnsQuery })).resolves.toEqual({
      sub: 'sub-123',
    });
  });

  test('unsupported web origins are refused before touching the auth center', async () => {
    const service = makeService();
    await expect(service.buildOidcAuthorizeUrl('ftp://evil.example')).rejects.toBeInstanceOf(
      UnauthorizedLoginError,
    );
    await expect(service.buildOidcAuthorizeUrl('not-a-url')).rejects.toBeInstanceOf(
      UnauthorizedLoginError,
    );
  });
});
