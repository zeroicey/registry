import { apiClient, apiUrl } from '@/api/client';
import { unwrap } from '@/api/unwrap';
import type { PaginatedResult } from '@/types';
import type { FileDto, ListFilesParams } from './types';

/** Files API — user attachments backed by the backend local-file storage module. */
export async function fetchFiles(
  userId: number,
  params: ListFilesParams,
): Promise<PaginatedResult<FileDto>> {
  const response = await apiClient.get(
    apiUrl(`/users/${userId}/files`, { page: params.page, pageSize: params.pageSize }),
  );
  return unwrap<PaginatedResult<FileDto>>(response);
}

export async function uploadFile(userId: number, file: File): Promise<FileDto> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post(apiUrl(`/users/${userId}/files`), {
    body: formData,
    timeout: false,
  });
  return unwrap<FileDto>(response);
}

export async function deleteFile(id: number): Promise<void> {
  const response = await apiClient.delete(apiUrl(`/files/${id}`));
  await unwrap<void>(response);
}

export async function downloadFileContent(id: number): Promise<Blob> {
  const response = await apiClient.get(apiUrl(`/files/${id}/content`), { timeout: false });
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
