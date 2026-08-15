import { describe, expect, it } from 'vitest';
import { ApiError, toDisplayError } from './errors';
import { unwrap } from './unwrap';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('unwrap', () => {
  it('returns data for a successful envelope', async () => {
    const response = jsonResponse({ success: true, message: 'OK', data: { id: 1 } });
    await expect(unwrap<{ id: number }>(response)).resolves.toEqual({ id: 1 });
  });

  it('throws ApiError with status/code/detail when success is false', async () => {
    const response = jsonResponse(
      { success: false, message: 'Not found', code: 'NOT_FOUND', error: { field: 'x' } },
      404,
    );
    const promise = unwrap(response);
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Not found',
      detail: JSON.stringify({ field: 'x' }),
    });
  });

  it('throws ApiError for a non-JSON body', async () => {
    const response = new Response('gateway timeout', { status: 502 });
    const promise = unwrap(response);
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ status: 502 });
  });

  it('throws ApiError for a malformed envelope', async () => {
    const response = jsonResponse({ foo: 'bar' });
    await expect(unwrap(response)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('toDisplayError', () => {
  it('formats ApiError with its detail', () => {
    expect(toDisplayError(new ApiError('创建失败', 400, '名字已存在'))).toBe(
      '创建失败（名字已存在）',
    );
  });

  it('falls back to a generic message for unknown values', () => {
    expect(toDisplayError('oops')).toBe('发生未知错误，请稍后重试');
  });
});
