import type { z } from 'zod';
import type {
  createUserSchema,
  getUserQuerySchema,
  listUsersQuerySchema,
  updateProfileSchema,
  updateUserSchema,
  userParamsSchema,
} from './users.schema';

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type GetUserQuery = z.infer<typeof getUserQuerySchema>;
export type UserParams = z.infer<typeof userParamsSchema>;

/** One validated value to write for an attribute (id resolved from its key). */
export interface ProfileEntry {
  attributeId: number;
  value: unknown;
}

export interface UserSummaryDto {
  id: number;
  realName: string;
  code: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 该人员所属的某个名录（仅 id + 名称，用于详情页展示/切换）。 */
export interface CollectionRef {
  id: number;
  name: string;
}

export interface UserDto extends UserSummaryDto {
  /**
   * Attribute values keyed by attribute business key, resolved against the
   * requested collection scope (global ∪ that collection, or global only).
   */
  profile: Record<string, unknown>;
  /** All active collections this user belongs to (M:N membership). */
  collections: CollectionRef[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Resolved attribute filter for the list endpoint. */
export interface AttributeFilter {
  attributeId: number;
  value: unknown;
}
