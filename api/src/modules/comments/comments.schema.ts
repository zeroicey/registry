import { z } from 'zod';

export const commentParamsSchema = z.object({
  id: z.coerce
    .number('Invalid comment id')
    .int('Invalid comment id')
    .positive('Invalid comment id'),
});

export const userIdParamsSchema = z.object({
  userId: z.coerce.number('Invalid user id').int('Invalid user id').positive('Invalid user id'),
});

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Content is required')
    .max(2000, 'Content must be at most 2000 characters'),
});

export const updateCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Content is required')
    .max(2000, 'Content must be at most 2000 characters'),
});

export const listCommentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
