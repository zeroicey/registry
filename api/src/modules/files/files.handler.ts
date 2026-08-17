import type { Context, Env } from 'hono';
import { AppError } from '@/shared/errors';
import { Msg } from '@/shared/messages';
import { Res } from '@/shared/response';
import { fileService } from './files.service';
import type { FileParams, ListFilesQuery, UserIdParams } from './files.types';

/**
 * Thin handlers: read validated input via c.req.valid(...), call the service,
 * return a response. No try/catch — throw AppError and let onError render it.
 */
type HandlerCtx<T extends Record<string, unknown>> = Context<Env, string, { out: T }>;

export async function uploadFileHandler(c: HandlerCtx<{ param: UserIdParams }>): Promise<Response> {
  const { userId } = c.req.valid('param');
  const form = await c.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    throw new AppError('BAD_REQUEST', Msg.FILE_REQUIRED);
  }
  const entry = await fileService.upload(userId, file);
  return Res.created(Msg.FILE_UPLOADED, entry).build(c);
}

export async function listFilesHandler(
  c: HandlerCtx<{ param: UserIdParams; query: ListFilesQuery }>,
): Promise<Response> {
  const { userId } = c.req.valid('param');
  const query = c.req.valid('query');
  const result = await fileService.list(userId, query);
  return Res.ok(Msg.FILE_LISTED, result).build(c);
}

export async function getFileContentHandler(
  c: HandlerCtx<{ param: FileParams }>,
): Promise<Response> {
  const { id } = c.req.valid('param');
  const { body, size, mimeType, originalName } = await fileService.getContent(id);

  // A raw Response is used because hono's typed `c.body(Data)` does not accept
  // Blob — and Blob lets Bun stream from disk without loading it into memory.
  // Content-Disposition uses RFC 5987 filename* so non-ASCII names survive.
  return new Response(body, {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(size),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`,
    },
  });
}

export async function deleteFileHandler(c: HandlerCtx<{ param: FileParams }>): Promise<Response> {
  const { id } = c.req.valid('param');
  await fileService.remove(id);
  return Res.noContent(Msg.FILE_DELETED).build(c);
}
