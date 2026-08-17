import type { FileRow } from '@/db/schema';
import type { FileDto } from './files.types';

/** DB row → API DTO. `storagePath` is deliberately NOT exposed. */
export function toFileDto(row: FileRow): FileDto {
  return {
    id: row.id,
    userId: row.userId,
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    createdAt: row.createdAt.toISOString(),
  };
}
