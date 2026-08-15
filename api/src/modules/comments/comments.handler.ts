import type { Context, Env } from 'hono';
import { Msg } from '@/shared/messages';
import { Res } from '@/shared/response';
import { commentService } from './comments.service';
import type {
  CommentParams,
  CreateCommentInput,
  ListCommentsQuery,
  UpdateCommentInput,
  UserIdParams,
} from './comments.types';

/**
 * Thin handlers: read validated input via c.req.valid(...), call the service,
 * return a response. No try/catch — throw AppError and let onError render it.
 * The Context's `out` generic carries the validated payloads, so c.req.valid
 * is fully typed without casts.
 */
type HandlerCtx<T extends Record<string, unknown>> = Context<Env, string, { out: T }>;

export async function createCommentHandler(
  c: HandlerCtx<{ param: UserIdParams; json: CreateCommentInput }>,
): Promise<Response> {
  const { userId } = c.req.valid('param');
  const input = c.req.valid('json');
  const comment = await commentService.create(userId, input);
  return Res.created(Msg.COMMENT_CREATED, comment).build(c);
}

export async function listCommentsHandler(
  c: HandlerCtx<{ param: UserIdParams; query: ListCommentsQuery }>,
): Promise<Response> {
  const { userId } = c.req.valid('param');
  const query = c.req.valid('query');
  const result = await commentService.list(userId, query);
  return Res.ok(Msg.COMMENT_FETCHED, result).build(c);
}

export async function updateCommentHandler(
  c: HandlerCtx<{ param: CommentParams; json: UpdateCommentInput }>,
): Promise<Response> {
  const { id } = c.req.valid('param');
  const input = c.req.valid('json');
  const comment = await commentService.update(id, input);
  return Res.ok(Msg.COMMENT_UPDATED, comment).build(c);
}

export async function deleteCommentHandler(
  c: HandlerCtx<{ param: CommentParams }>,
): Promise<Response> {
  const { id } = c.req.valid('param');
  await commentService.remove(id);
  return Res.noContent(Msg.COMMENT_DELETED).build(c);
}
