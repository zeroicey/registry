import { z } from 'zod';

export const userIdParamsSchema = z.object({
  userId: z.coerce.number('Invalid user id').int('Invalid user id').positive('Invalid user id'),
});

export const fileParamsSchema = z.object({
  id: z.coerce.number('Invalid file id').int('Invalid file id').positive('Invalid file id'),
});

export const listFilesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
