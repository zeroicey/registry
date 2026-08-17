import type { z } from 'zod';
import type { fileParamsSchema, listFilesQuerySchema, userIdParamsSchema } from './files.schema';

export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type FileParams = z.infer<typeof fileParamsSchema>;
export type ListFilesQuery = z.infer<typeof listFilesQuerySchema>;

/** Pagination options passed down to the repository layer. */
export interface ListFilesOptions {
  page: number;
  pageSize: number;
}

/** API-facing file shape (camelCase, ISO timestamps; storagePath never exposed). */
export interface FileDto {
  id: number;
  userId: number;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

/** Streamable file content + the metadata the download response needs. */
export interface FileContent {
  body: Blob;
  size: number;
  mimeType: string;
  originalName: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Result of DELETE /api/files/cleanup-orphans. */
export interface CleanupResult {
  checked: number;
  deleted: string[];
  failed: { path: string; message: string }[];
}
