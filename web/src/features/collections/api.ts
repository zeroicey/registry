import { apiClient, apiUrl } from '@/api/client';
import { unwrap } from '@/api/unwrap';
import type { PaginatedResult } from '@/types';
import type { CollectionDto } from './types';

export interface CreateCollectionInput {
  name: string;
  description?: string | null;
}

export interface UpdateCollectionInput {
  name?: string;
  description?: string | null;
}

/** All active collections (pageSize=100 covers the selector + management list). */
export async function fetchCollections(): Promise<CollectionDto[]> {
  const response = await apiClient.get(apiUrl('/collections', { page: 1, pageSize: 100 }));
  const result = await unwrap<PaginatedResult<CollectionDto>>(response);
  return result.items;
}

export async function createCollection(input: CreateCollectionInput): Promise<CollectionDto> {
  const response = await apiClient.post(apiUrl('/collections'), { json: input });
  return unwrap<CollectionDto>(response);
}

export async function updateCollection(
  id: number,
  input: UpdateCollectionInput,
): Promise<CollectionDto> {
  const response = await apiClient.patch(apiUrl(`/collections/${id}`), { json: input });
  return unwrap<CollectionDto>(response);
}

export async function deleteCollection(id: number): Promise<void> {
  const response = await apiClient.delete(apiUrl(`/collections/${id}`));
  await unwrap<void>(response);
}
