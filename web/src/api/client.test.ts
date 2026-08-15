import { describe, expect, it } from 'vitest';
import { apiUrl, resolveApiPath } from './client';

describe('resolveApiPath', () => {
  it('joins the env base URL and the path, normalizing slashes', () => {
    expect(resolveApiPath('/health')).toBe('/api/health');
    expect(resolveApiPath('health/')).toBe('/api/health/');
  });
});

describe('apiUrl', () => {
  it('appends query params and skips undefined values', () => {
    const url = apiUrl('/users', { page: 2, keyword: '张', flag: undefined });
    expect(url).toBe(
      `${window.location.origin}/api/users?page=2&keyword=${encodeURIComponent('张')}`,
    );
  });
});
