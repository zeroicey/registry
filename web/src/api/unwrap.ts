import type { ApiEnvelope } from '@/types';
import { ApiError, stringifyDetail } from './errors';

function isApiEnvelope(value: unknown): value is ApiEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { success?: unknown }).success === 'boolean' &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

/**
 * Parse the backend's unified response envelope `{ success, message, code?, data?, error? }`
 * and return `data`. Throws `ApiError` on failure — non-2xx status, malformed
 * body, or `success: false`. Feature `api.ts` files never touch raw `Response`.
 */
export async function unwrap<T>(response: Response): Promise<T> {
  let envelope: ApiEnvelope;

  try {
    envelope = (await response.json()) as ApiEnvelope;
  } catch {
    throw new ApiError(
      `请求失败（HTTP ${response.status}）`,
      response.status,
      '响应不是有效的 JSON',
    );
  }

  if (!isApiEnvelope(envelope)) {
    throw new ApiError(
      `请求失败（HTTP ${response.status}）`,
      response.status,
      '响应不符合统一格式 { success, message, code?, data?, error? }',
    );
  }

  if (!response.ok || !envelope.success) {
    throw new ApiError(
      envelope.message || `请求失败（HTTP ${response.status}）`,
      response.status,
      stringifyDetail(envelope.error),
      envelope.code,
    );
  }

  return envelope.data as T;
}
