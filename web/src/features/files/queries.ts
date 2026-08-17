import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toDisplayError } from '@/api/errors';
import {
  deleteFile as deleteFileRequest,
  fetchFileContent,
  fetchFiles,
  saveBlob,
  uploadFile as uploadFileRequest,
} from './api';
import type { FileDto, ListFilesParams } from './types';

export const fileKeys = {
  all: ['files'] as const,
  user: (userId: number) => [...fileKeys.all, userId] as const,
  list: (userId: number, params: ListFilesParams) => [...fileKeys.user(userId), params] as const,
};

export function useFiles(userId: number, params: ListFilesParams) {
  return useQuery({
    queryKey: fileKeys.list(userId, params),
    queryFn: () => fetchFiles(userId, params),
    enabled: Number.isInteger(userId) && userId > 0,
  });
}

export function useUploadFile(userId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadFileRequest(userId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fileKeys.user(userId) });
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}

export function useDeleteFile(userId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteFileRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fileKeys.user(userId) });
      toast.success('附件已移除');
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}

export function useDownloadFile() {
  return useMutation({
    mutationFn: async (file: FileDto) => {
      const blob = await fetchFileContent(file.id);
      saveBlob(blob, file.originalName);
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}
