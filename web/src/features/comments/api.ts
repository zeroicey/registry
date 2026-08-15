import { apiClient, apiUrl } from '@/api/client';
import { unwrap } from '@/api/unwrap';
import type { PaginatedResult } from '@/types';
import type { CreateCommentInput, UpdateCommentInput } from './schemas';
import type { CommentDto, ListCommentsParams } from './types';

/**
 * Comments API — the only place that talks to the comments endpoints.
 * Never exposes raw Response objects; all errors surface as ApiError.
 */
export async function fetchComments(
  userId: number,
  params: ListCommentsParams,
): Promise<PaginatedResult<CommentDto>> {
  const response = await apiClient.get(
    apiUrl(`/users/${userId}/comments`, { page: params.page, pageSize: params.pageSize }),
  );
  return unwrap<PaginatedResult<CommentDto>>(response);
}

export async function createComment(
  userId: number,
  input: CreateCommentInput,
): Promise<CommentDto> {
  const response = await apiClient.post(apiUrl(`/users/${userId}/comments`), { json: input });
  return unwrap<CommentDto>(response);
}

export async function updateComment(id: number, input: UpdateCommentInput): Promise<CommentDto> {
  const response = await apiClient.patch(apiUrl(`/comments/${id}`), { json: input });
  return unwrap<CommentDto>(response);
}

export async function deleteComment(id: number): Promise<void> {
  const response = await apiClient.delete(apiUrl(`/comments/${id}`));
  await unwrap<void>(response);
}
