import { Hono } from 'hono';
import { validator } from '@/shared/validator';
import {
  getSourceFileContentHandler,
  listSourceFilesHandler,
  uploadSourceFileHandler,
} from './source-files.handler';
import { listSourceFilesQuerySchema, sourceFileParamsSchema } from './source-files.schema';

/**
 * Source-file routes — the provenance anchor for file-imported users.
 * Mounted under /api (see app.ts). Upload stores the raw data file; list shows
 * uploads + import status; content streams the original file back for
 * re-import or tracing. No delete — a source file is the root of traceability.
 */
export const sourceFilesRouter = new Hono()
  .post('/', uploadSourceFileHandler)
  .get('/', validator.query(listSourceFilesQuerySchema), listSourceFilesHandler)
  .get('/:id/content', validator.params(sourceFileParamsSchema), getSourceFileContentHandler);
