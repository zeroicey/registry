import { z } from 'zod';

export const todoParamsSchema = z.object({
  id: z.uuid('Invalid todo id'),
});

export const createTodoSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description must be at most 2000 characters')
    .optional(),
  completed: z.boolean().default(false),
  priority: z.number().int().min(0).max(5).default(0),
  userId: z.uuid('Invalid user id').optional(),
});

export const updateTodoSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .max(200, 'Title must be at most 200 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, 'Description must be at most 2000 characters')
      .nullable()
      .optional(),
    completed: z.boolean().optional(),
    priority: z.number().int().min(0).max(5).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const listTodosQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  completed: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  userId: z.uuid('Invalid user id').optional(),
});
