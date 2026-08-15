import type { z } from 'zod';
import type {
  commentParamsSchema,
  createCommentSchema,
  listCommentsQuerySchema,
  updateCommentSchema,
  userIdParamsSchema,
} from './comments.schema';

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;
export type CommentParams = z.infer<typeof commentParamsSchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;

/** API-facing comment shape (camelCase, ISO timestamps). */
export interface CommentDto {
  id: number;
  userId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
