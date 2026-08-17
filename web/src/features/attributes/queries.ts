import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toDisplayError } from '@/api/errors';
import type { CollectionScope } from '@/stores/collection-store';
import { scopeToAttributesQuery } from '@/stores/collection-store';
import type { AttributeDef } from '@/types/attribute';
import {
  createAttribute as createAttributeRequest,
  deleteAttribute as deleteAttributeRequest,
  fetchAttributes,
  updateAttribute as updateAttributeRequest,
} from './api';
import type { CreateAttributeInput, UpdateAttributeInput } from './schemas';

export const attributeKeys = {
  all: ['attributes'] as const,
};

/**
 * Active attribute definitions within a scope (default: all). The scope drives
 * the query key, so switching collections refetches the matching attribute set.
 */
export function useAttributeDefs(scope: CollectionScope = { kind: 'all' }) {
  const query = scopeToAttributesQuery(scope);
  return useQuery({
    queryKey: [...attributeKeys.all, query],
    queryFn: () => fetchAttributes(1, 100, query),
    staleTime: 60_000,
  });
}

export function useCreateAttribute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAttributeInput) => createAttributeRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attributeKeys.all });
      toast.success('属性已创建');
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}

export function useUpdateAttribute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateAttributeInput }) =>
      updateAttributeRequest(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attributeKeys.all });
      toast.success('属性已更新');
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}

export function useDeleteAttribute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAttributeRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attributeKeys.all });
      toast.success('属性已删除');
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}

export type { AttributeDef };
