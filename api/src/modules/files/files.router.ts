import { Hono } from 'hono';
import { validator } from '@/shared/validator';
import {
  deleteFileHandler,
  getFileContentHandler,
  listFilesHandler,
  uploadFileHandler,
} from './files.handler';
import { fileParamsSchema, listFilesQuerySchema, userIdParamsSchema } from './files.schema';

/**
 * File routes — every route validates via the shared validator.
 * Mounted under /api (see app.ts). Attachments hang off a user; content is
 * downloaded by file id. Deleting removes the DB record only; physical files
 * are left for a future restricted cleanup command.
 */
export const filesRouter = new Hono()
  .post('/users/:userId/files', validator.params(userIdParamsSchema), uploadFileHandler)
  .get(
    '/users/:userId/files',
    validator.params(userIdParamsSchema),
    validator.query(listFilesQuerySchema),
    listFilesHandler,
  )
  .get('/files/:id/content', validator.params(fileParamsSchema), getFileContentHandler)
  .delete('/files/:id', validator.params(fileParamsSchema), deleteFileHandler);
