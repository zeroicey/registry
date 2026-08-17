import type { z } from 'zod';
import type { SourceFileStatus } from '@/db/schema';
import type { listSourceFilesQuerySchema, sourceFileParamsSchema } from './source-files.schema';

export type SourceFileParams = z.infer<typeof sourceFileParamsSchema>;
export type ListSourceFilesQuery = z.infer<typeof listSourceFilesQuerySchema>;

/** Pagination options passed down to the repository layer. */
export interface ListSourceFilesOptions {
  page: number;
  pageSize: number;
  collectionId?: number;
}

/** API-facing source-file shape (camelCase, ISO timestamps; storagePath never exposed). */
export interface SourceFileDto {
  id: number;
  /** 归属名录；API 上传必填，仅历史孤儿行可为 null。 */
  collectionId: number | null;
  originalName: string;
  mimeType: string;
  size: number;
  /** uploaded = 已上传未导入；imported = 已由外部 AI 导入并完成溯源标记。 */
  status: SourceFileStatus;
  createdAt: string;
}

/** Streamable source-file content + the metadata the download response needs. */
export interface SourceFileContent {
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
