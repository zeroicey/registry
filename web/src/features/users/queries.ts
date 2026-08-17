import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toDisplayError } from '@/api/errors';
import {
  createUser as createUserRequest,
  deleteUser as deleteUserRequest,
  fetchUser,
  fetchUsers,
  updateProfile as updateProfileRequest,
  updateUser as updateUserRequest,
} from './api';
import type { CreateUserInput, UpdateProfileInput, UpdateUserInput } from './schemas';
import type { ListUsersParams } from './types';

export const userKeys = {
  all: ['users'] as const,
  list: (params: ListUsersParams) => [...userKeys.all, params] as const,
  detail: (id: number) => [...userKeys.all, id] as const,
};

/**
 * Paginated user list — `search`/filters/page changes produce a new query key.
 * Pass `enabled: false` to keep the list idle (no request) until the user
 * explicitly submits a query.
 */
export function useUsers(params: ListUsersParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => fetchUsers(params),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useUser(id: number, collectionId?: number) {
  return useQuery({
    queryKey: [...userKeys.detail(id), collectionId],
    queryFn: () => fetchUser(id, collectionId),
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => createUserRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success('人员已创建');
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateUserInput }) =>
      updateUserRequest(id, input),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success('基本信息已更新');
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateProfileInput }) =>
      updateProfileRequest(id, input),
    onSuccess: (_data, { id }) => {
      // Profile change also refreshes the detail query, which re-assembles the profile.
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      toast.success('属性已保存');
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteUserRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success('人员已删除');
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}
