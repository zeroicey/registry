import type { SourceFileRow } from '@/db/schema';
import type { SourceFileDto } from './source-files.types';

/** DB row → API DTO. `storagePath` is deliberately NOT exposed. */
export function toSourceFileDto(row: SourceFileRow): SourceFileDto {
  return {
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}
