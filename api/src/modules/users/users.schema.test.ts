import { describe, expect, test } from 'bun:test';
import { listUsersQuerySchema } from './users.schema';

describe('listUsersQuerySchema', () => {
  test('treats an empty search as absent instead of failing min(1)', () => {
    const parsed = listUsersQuerySchema.parse({ page: '1', pageSize: '20', search: '' });
    expect(parsed.search).toBeUndefined();
  });

  test('keeps a non-empty search', () => {
    const parsed = listUsersQuerySchema.parse({ page: '1', pageSize: '20', search: '张' });
    expect(parsed.search).toBe('张');
  });

  test('passes extra query params through as attribute filters', () => {
    const parsed = listUsersQuerySchema.parse({ page: '1', pageSize: '20', phone: '13144036356' });
    expect(parsed.phone).toBe('13144036356');
  });
});
