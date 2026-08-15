import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toDisplayError } from '@/api/errors';
import {
  createComment as createCommentRequest,
  deleteComment as deleteCommentRequest,
  fetchComments,
  updateComment as updateCommentRequest,
} from './api';
import type { CreateCommentInput, UpdateCommentInput } from './schemas';
import type { ListCommentsParams } from './types';

export const commentKeys = {
  all: ['comments'] as const,
  list: (userId: number, params: ListCommentsParams) =>
    [...commentKeys.all, userId, params] as const,
};

/** Paginated comments for one user — page changes produce a new query key. */
export function useComments(userId: number, params: ListCommentsParams) {
  return useQuery({
    queryKey: commentKeys.list(userId, params),
    queryFn: () => fetchComments(userId, params),
    enabled: Number.isInteger(userId) && userId > 0,
  });
}

/** Mutation helpers share one invalidation: the user's comment list. */
function useCommentMutation<TInput>(
  mutationFn: (input: TInput) => Promise<unknown>,
  successMessage: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      // Refresh every comments list query for this user.
      queryClient.invalidateQueries({ queryKey: commentKeys.all });
      toast.success(successMessage);
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}

export function useCreateComment(userId: number) {
  return useCommentMutation<CreateCommentInput>(
    (input) => createCommentRequest(userId, input),
    '留言已发布',
  );
}

export function useUpdateComment() {
  return useCommentMutation<{ id: number; userId: number; input: UpdateCommentInput }>(
    ({ id, input }) => updateCommentRequest(id, input),
    '留言已更新',
  );
}

export function useDeleteComment() {
  return useCommentMutation<{ id: number; userId: number }>(
    ({ id }) => deleteCommentRequest(id),
    '留言已删除',
  );
}
