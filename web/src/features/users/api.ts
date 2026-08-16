import { apiClient, apiUrl, type QueryParams } from '@/api/client';
import { unwrap } from '@/api/unwrap';
import type { PaginatedResult } from '@/types';
import type { CreateUserInput, UpdateProfileInput, UpdateUserInput } from './schemas';
import type { ListUsersParams, UserDto, UserSummaryDto } from './types';

/**
 * Users API — the only place that talks to the users endpoints.
 * Never exposes raw Response objects; all errors surface as ApiError.
 */

/** Resolve the list query: reserved params + one query param per attribute filter. */
function listQuery(params: ListUsersParams): QueryParams {
  const query: QueryParams = {
    page: params.page,
    pageSize: params.pageSize,
    search: params.search,
  };
  // Filters carry both attribute keys and the special `hasCode` presence
  // filter — each becomes one query param, so ?hasCode=true works here.
  for (const filter of params.filters ?? []) {
    query[filter.key] = filter.value;
  }
  return query;
}

export async function fetchUsers(
  params: ListUsersParams,
): Promise<PaginatedResult<UserSummaryDto>> {
  const response = await apiClient.get(apiUrl('/users', listQuery(params)));
  return unwrap<PaginatedResult<UserSummaryDto>>(response);
}

export async function fetchUser(id: number): Promise<UserDto> {
  const response = await apiClient.get(apiUrl(`/users/${id}`));
  return unwrap<UserDto>(response);
}

export async function createUser(input: CreateUserInput): Promise<UserDto> {
  const response = await apiClient.post(apiUrl('/users'), { json: input });
  return unwrap<UserDto>(response);
}

export async function updateUser(id: number, input: UpdateUserInput): Promise<UserDto> {
  const response = await apiClient.patch(apiUrl(`/users/${id}`), { json: input });
  return unwrap<UserDto>(response);
}

export async function updateProfile(id: number, input: UpdateProfileInput): Promise<UserDto> {
  const response = await apiClient.patch(apiUrl(`/users/${id}/profile`), { json: input });
  return unwrap<UserDto>(response);
}

export async function deleteUser(id: number): Promise<void> {
  const response = await apiClient.delete(apiUrl(`/users/${id}`));
  await unwrap<void>(response);
}
