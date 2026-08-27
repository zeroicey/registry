import { Hono } from 'hono';
import { describe, expect, test } from 'bun:test';
import { createAuthMiddleware, readBearerToken } from './auth.handler';
import { AuthService } from './auth.service';

// ---------------------------------------------------------------------------
// Middleware tests: the /api/* gate must admit EITHER a valid session cookie
// (browser) OR a valid bearer token (CLI). The two channels are independent —
// configuring only the API token must not accidentally open the cookie path.
// ---------------------------------------------------------------------------

const SECRET = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const API_TOKEN = 'k'.repeat(48);

describe('readBearerToken', () => {
  async function parse(header: string | undefined): Promise<unknown> {
    const app = new Hono();
    app.get('/', (c) => c.json({ token: readBearerToken(c) ?? null }));
    const res = await app.request('/', {
      headers: header === undefined ? {} : { authorization: header },
    });
    const body = (await res.json()) as { token: string | null };
    return body.token;
  }

  test('parses a bearer token, tolerating case and extra spacing', async () => {
    expect(await parse('Bearer abc123')).toBe('abc123');
    expect(await parse('bearer   abc123')).toBe('abc123');
    expect(await parse('  Bearer abc123  ')).toBe('abc123');
  });

  test('returns null for missing, empty and non-bearer headers', async () => {
    expect(await parse(undefined)).toBeNull();
    expect(await parse('')).toBeNull();
    expect(await parse('Bearer ')).toBeNull();
    expect(await parse('Basic abc123')).toBeNull();
  });
});

describe('createAuthMiddleware', () => {
  function appFor(service: AuthService): Hono {
    const app = new Hono();
    app.use('/api/*', createAuthMiddleware(service));
    app.get('/api/data', (c) => c.json({ ok: true }));
    app.get('/api/health', (c) => c.json({ ok: 'health' }));
    return app;
  }

  function fullService(): AuthService {
    return new AuthService({
      sessionSecret: SECRET,
      oidcIssuer: 'https://x',
      oidcClientId: 'x',
      oidcClientSecret: 'x',
      apiToken: API_TOKEN,
    });
  }

  test('opens the gate entirely when neither channel is configured (dev)', async () => {
    const app = appFor(new AuthService({}));
    expect((await app.request('/api/data')).status).toBe(200);
  });

  test('passes a valid bearer token', async () => {
    const app = appFor(fullService());
    const res = await app.request('/api/data', {
      headers: { authorization: `Bearer ${API_TOKEN}` },
    });
    expect(res.status).toBe(200);
  });

  test('passes a valid session cookie', async () => {
    const service = fullService();
    const app = appFor(service);
    const cookie = service.createSessionCookie();
    const res = await app.request('/api/data', {
      headers: { cookie: `registry_session=${cookie}` },
    });
    expect(res.status).toBe(200);
  });

  test('rejects with 401 when neither credential is valid', async () => {
    const app = appFor(fullService());
    expect((await app.request('/api/data')).status).toBe(401);
    expect(
      (await app.request('/api/data', { headers: { authorization: 'Bearer WRONG' } })).status,
    ).toBe(401);
  });

  test('health stays public', async () => {
    const app = appFor(fullService());
    expect((await app.request('/api/health')).status).toBe(200);
  });

  test('cookie channel stays closed when only the API token is configured', async () => {
    const service = new AuthService({ apiToken: API_TOKEN });
    const app = appFor(service);
    // OIDC channel is off: a forged cookie must not open the gate...
    expect(
      (await app.request('/api/data', { headers: { cookie: 'registry_session=fake' } })).status,
    ).toBe(401);
    // ...but the bearer token still works.
    expect(
      (await app.request('/api/data', { headers: { authorization: `Bearer ${API_TOKEN}` } }))
        .status,
    ).toBe(200);
  });
});