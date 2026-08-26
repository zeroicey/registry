import { createHash } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import {
  buildSecureSessionCookie,
  buildSessionCookie,
  clearSessionCookie,
  createPkcePair,
  randomToken,
  secretsEqual,
  SESSION_COOKIE_NAME,
  signSessionValue,
  verifySessionValue,
} from './auth.domain';

// 32 chars of hex — long enough for HMAC test vectors, obviously fake.
const SECRET = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

describe('secretsEqual', () => {
  test('accepts equal values, rejects different values and lengths', () => {
    expect(secretsEqual('abc', 'abc')).toBe(true);
    expect(secretsEqual('abc', 'abd')).toBe(false);
    expect(secretsEqual('abc', 'abcd')).toBe(false);
  });
});

describe('signSessionValue / verifySessionValue', () => {
  const exp = 1_800_000_000;
  const value = signSessionValue(SECRET, exp);

  test('round-trips and expires', () => {
    expect(verifySessionValue(SECRET, value, exp - 1)).toEqual({ valid: true });
    expect(verifySessionValue(SECRET, value, exp)).toEqual({ valid: true });
    expect(verifySessionValue(SECRET, value, exp + 1)).toEqual({
      valid: false,
      reason: 'expired',
    });
    // "<exp>.<sig>" — exactly one dot.
    expect(value.split('.').length).toBe(2);
    expect(Number(value.split('.')[0])).toBe(exp);
  });

  test('rejects tampering, wrong secret and malformed values', () => {
    const [expStr, sig] = value.split('.');
    expect(verifySessionValue(SECRET, `${Number(expStr) + 1}.${sig}`, 1)).toEqual({
      valid: false,
      reason: 'tampered',
    });
    expect(verifySessionValue(SECRET, `${expStr}.xxxx`, 1)).toEqual({
      valid: false,
      reason: 'tampered',
    });
    expect(verifySessionValue('yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy', value, exp - 1)).toEqual({
      valid: false,
      reason: 'tampered',
    });
    expect(verifySessionValue(SECRET, 'nosig', 1)).toEqual({ valid: false, reason: 'malformed' });
    expect(verifySessionValue(SECRET, 'notanumber.sig', 1)).toEqual({
      valid: false,
      reason: 'malformed',
    });
    expect(verifySessionValue(SECRET, '', 1)).toEqual({ valid: false, reason: 'malformed' });
  });
});

describe('cookie builders', () => {
  test('session cookie is HttpOnly + SameSite=Lax and never Secure (intranet http)', () => {
    const cookie = buildSessionCookie('v', 3600);
    expect(cookie).toStartWith(`${SESSION_COOKIE_NAME}=v`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=3600');
    expect(cookie).not.toContain('Secure');
  });

  test('secure variant adds Secure; clear cookie zeroes Max-Age', () => {
    expect(buildSecureSessionCookie('v', 3600)).toContain('Secure');
    expect(clearSessionCookie()).toContain('Max-Age=0');
    expect(clearSessionCookie()).not.toContain('Secure');
  });
});

describe('OIDC login-state helpers', () => {
  test('randomToken produces unique url-safe strings', () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test('PKCE challenge is base64url(SHA256(verifier))', () => {
    const { verifier, challenge } = createPkcePair();
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toEqual(expected);
    expect(verifier).not.toEqual(challenge);
  });
});
