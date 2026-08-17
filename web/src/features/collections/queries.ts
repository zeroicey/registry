import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toDisplayError } from '@/api/errors';
import type { CreateCollectionInput, UpdateCollectionInput } from './api';
import {
  createCollection as createCollectionRequest,
  deleteCollection as deleteCollectionRequest,
  fetchCollections,
  updateCollection as updateCollectionRequest,
} from './api';

export const collectionKeys = {
  all: ['collections'] as const,
};

/** All active collections — shared by the selector and the management page. */
export function useCollections() {
  return useQuery({
    queryKey: collectionKeys.all,
    queryFn: fetchCollections,
    staleTime: 60_000,
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCollectionInput) => createCollectionRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.all });
      toast.success('名录已创建');
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}

export function useUpdateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateCollectionInput }) =>
      updateCollectionRequest(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.all });
      toast.success('名录已更新');
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCollectionRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.all });
      toast.success('名录已删除');
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}
