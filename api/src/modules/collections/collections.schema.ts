import { z } from 'zod';

export const collectionParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const collectionMemberParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
});

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
});

export const updateCollectionSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).nullable(),
  })
  .partial();

export const listCollectionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
});

/** Bulk-add members to a collection (idempotent). */
export const addCollectionMembersSchema = z.object({
  userIds: z.array(z.number().int().positive()).min(1),
});
