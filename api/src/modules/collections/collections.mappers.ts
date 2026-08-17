import type { Collection } from '@/db/schema';
import type { CollectionDto } from './collections.types';

/** DB row (+ member count) → API DTO (camelCase, ISO timestamps). */
export function toCollectionDto(row: Collection & { memberCount: number }): CollectionDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    memberCount: row.memberCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
