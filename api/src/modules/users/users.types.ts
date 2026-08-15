import type { z } from 'zod';
import type {
  createUserSchema,
  listUsersQuerySchema,
  updateProfileSchema,
  updateUserSchema,
  userParamsSchema,
} from './users.schema';

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
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

export interface UserDto extends UserSummaryDto {
  profile: Record<string, unknown>;
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
