import { apiClient, apiUrl } from '@/api/client';
import { unwrap } from '@/api/unwrap';
import type { PaginatedResult } from '@/types';
import type { AttributeDef } from '@/types/attribute';
import type { CreateAttributeInput, UpdateAttributeInput } from './schemas';

/**
 * Attributes API — the only place that talks to the attributes endpoints.
 * Never exposes raw Response objects; all errors surface as ApiError.
 */
export async function fetchAttributes(page = 1, pageSize = 100): Promise<AttributeDef[]> {
  const response = await apiClient.get(apiUrl('/attributes', { page, pageSize }));
  const result = await unwrap<PaginatedResult<AttributeDef>>(response);
  return result.items;
}

export async function createAttribute(input: CreateAttributeInput): Promise<AttributeDef> {
  const response = await apiClient.post(apiUrl('/attributes'), { json: input });
  return unwrap<AttributeDef>(response);
}

export async function updateAttribute(
  id: number,
  input: UpdateAttributeInput,
): Promise<AttributeDef> {
  const response = await apiClient.patch(apiUrl(`/attributes/${id}`), { json: input });
  return unwrap<AttributeDef>(response);
}

export async function deleteAttribute(id: number): Promise<void> {
  const response = await apiClient.delete(apiUrl(`/attributes/${id}`));
  await unwrap<void>(response);
}
