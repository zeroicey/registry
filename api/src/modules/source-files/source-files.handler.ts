import type { Context, Env } from 'hono';
import { AppError } from '@/shared/errors';
import { Msg } from '@/shared/messages';
import { Res } from '@/shared/response';
import { sourceFileService } from './source-files.service';
import type { ListSourceFilesQuery, SourceFileParams } from './source-files.types';

/**
 * Thin handlers: read validated input via c.req.valid(...), call the service,
 * return a response. No try/catch — throw AppError and let onError render it.
 */
type HandlerCtx<T extends Record<string, unknown>> = Context<Env, string, { out: T }>;

export async function uploadSourceFileHandler(
  c: HandlerCtx<Record<string, never>>,
): Promise<Response> {
  const form = await c.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    throw new AppError('BAD_REQUEST', Msg.FILE_REQUIRED);
  }
  const rawCollectionId = form.get('collectionId');
  const collectionId = typeof rawCollectionId === 'string' ? Number(rawCollectionId) : NaN;
  if (!Number.isInteger(collectionId) || collectionId <= 0) {
    throw new AppError('BAD_REQUEST', Msg.COLLECTION_REQUIRED);
  }
  const entry = await sourceFileService.upload(file, collectionId);
  return Res.created(Msg.SOURCE_FILE_UPLOADED, entry).build(c);
}

export async function listSourceFilesHandler(
  c: HandlerCtx<{ query: ListSourceFilesQuery }>,
): Promise<Response> {
  const query = c.req.valid('query');
  const result = await sourceFileService.list(query);
  return Res.ok(Msg.SOURCE_FILE_LISTED, result).build(c);
}

export async function getSourceFileContentHandler(
  c: HandlerCtx<{ param: SourceFileParams }>,
): Promise<Response> {
  const { id } = c.req.valid('param');
  const { body, size, mimeType, originalName } = await sourceFileService.getContent(id);

  // A raw Response is used because hono's typed `c.body(Data)` does not accept
  // Blob — and Blob lets Bun stream from disk without loading it into memory.
  return new Response(body, {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(size),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`,
    },
  });
}
