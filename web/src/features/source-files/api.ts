import { apiClient, apiUrl } from '@/api/client';
import { unwrap } from '@/api/unwrap';
import type { PaginatedResult } from '@/types';
import type { ListSourceFilesParams, SourceFileDto } from './types';

/** Source-files API — provenance files backing file-imported users. */
export async function fetchSourceFiles(
  params: ListSourceFilesParams,
): Promise<PaginatedResult<SourceFileDto>> {
  const response = await apiClient.get(
    apiUrl('/source-files', {
      page: params.page,
      pageSize: params.pageSize,
      collectionId: params.collectionId,
    }),
  );
  return unwrap<PaginatedResult<SourceFileDto>>(response);
}

export async function uploadSourceFile(file: File, collectionId: number): Promise<SourceFileDto> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('collectionId', String(collectionId));
  const response = await apiClient.post(apiUrl('/source-files'), {
    body: formData,
    timeout: false,
  });
  return unwrap<SourceFileDto>(response);
}

export async function fetchSourceFileContent(id: number): Promise<Blob> {
  const response = await apiClient.get(apiUrl(`/source-files/${id}/content`), { timeout: false });
  if (!response.ok) {
    await unwrap<never>(response);
  }
  return response.blob();
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
