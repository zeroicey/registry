import { z } from 'zod';

export const userCodeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'code may contain only letters, digits, underscores and dashes');

/** Profile patch/list-filter keys: any attribute business key is allowed. */
export const profileSchema = z.record(z.string().min(1).max(64), z.unknown());

export const createUserSchema = z.object({
  realName: z.string().min(1).max(100),
  code: userCodeSchema.nullable().optional(),
  /** 创建时所在的名录（初始成员关系 + profile 解析作用域）。可选：不传 = 全局用户。 */
  collectionId: z.number().int().positive().optional(),
  /** Initial profile values keyed by attribute business key (validated against attributes.config). */
  profiles: profileSchema.optional(),
});

export const updateUserSchema = z
  .object({
    realName: z.string().min(1).max(100),
    code: userCodeSchema.nullable(),
  })
  .partial();

export const updateProfileSchema = z.object({
  /** Merge-patch: keys are attribute business keys; only present keys are touched. */
  profiles: profileSchema,
  /** 解析 key 的作用域：不传 = 仅全局属性；传 = 全局 ∪ 该名录。 */
  collectionId: z.number().int().positive().optional(),
});

/** Query for `GET /users/:id` — optional collection scope for profile assembly. */
export const getUserQuerySchema = z.object({
  collectionId: z.coerce.number().int().positive().optional(),
});

/** Reserved query keys — everything else is treated as an attribute filter. */
export const RESERVED_USER_QUERY_KEYS = [
  'page',
  'pageSize',
  'search',
  'hasCode',
  'collectionId',
] as const;

export const listUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    /** Fuzzy match on real_name / code. */
    search: z.string().min(1).max(100).optional(),
    /** true=has a national id (users.code NOT NULL), false=does not (IS NULL). */
    hasCode: z.enum(['true', 'false']).optional(),
    /** 只列某个名录的成员。 */
    collectionId: z.coerce.number().int().positive().optional(),
  })
  // Attribute filters arrive as extra query params, e.g. ?gender=男 — validated in the service.
  .catchall(z.unknown());

export const userParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
