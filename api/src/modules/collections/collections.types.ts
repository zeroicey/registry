import type { z } from 'zod';
import type {
  addCollectionMembersSchema,
  collectionMemberParamsSchema,
  collectionParamsSchema,
  createCollectionSchema,
  listCollectionsQuerySchema,
  updateCollectionSchema,
} from './collections.schema';

export type CollectionParams = z.infer<typeof collectionParamsSchema>;
export type CollectionMemberParams = z.infer<typeof collectionMemberParamsSchema>;
export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;
export type ListCollectionsQuery = z.infer<typeof listCollectionsQuerySchema>;
export type AddCollectionMembersInput = z.infer<typeof addCollectionMembersSchema>;

export interface CollectionDto {
  id: number;
  name: string;
  description: string | null;
  /** How many active users belong to this collection. */
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
