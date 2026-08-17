import { z } from 'zod';

export const sourceFileParamsSchema = z.object({
  id: z.coerce
    .number('Invalid source file id')
    .int('Invalid source file id')
    .positive('Invalid source file id'),
});

export const listSourceFilesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  /** 只列某个名录的来源文件。 */
  collectionId: z.coerce.number().int().positive().optional(),
});
