import { z } from 'zod';

/** Single source of truth for comment content — mirrors the backend create/update schema. */
export const commentContentSchema = z
  .string()
  .trim()
  .min(1, '留言内容不能为空')
  .max(2000, '留言内容最多 2000 个字符');

export const createCommentSchema = z.object({
  content: commentContentSchema,
});

export const updateCommentSchema = z.object({
  content: commentContentSchema,
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
