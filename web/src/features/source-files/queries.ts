import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toDisplayError } from '@/api/errors';
import {
  fetchSourceFileContent,
  fetchSourceFiles,
  saveBlob,
  uploadSourceFile as uploadSourceFileRequest,
} from './api';
import type { ListSourceFilesParams, SourceFileDto } from './types';

export const sourceFileKeys = {
  all: ['source-files'] as const,
  list: (params: ListSourceFilesParams) => [...sourceFileKeys.all, params] as const,
};

export function useSourceFiles(params: ListSourceFilesParams) {
  return useQuery({
    queryKey: sourceFileKeys.list(params),
    queryFn: () => fetchSourceFiles(params),
  });
}

export function useUploadSourceFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadSourceFileRequest(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sourceFileKeys.all });
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}

export function useDownloadSourceFile() {
  return useMutation({
    mutationFn: async (file: SourceFileDto) => {
      const blob = await fetchSourceFileContent(file.id);
      saveBlob(blob, file.originalName);
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}
