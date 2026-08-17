import type { Context, Env } from 'hono';
import { Msg } from '@/shared/messages';
import { Res } from '@/shared/response';
import { userService } from './users.service';
import type {
  CreateUserInput,
  GetUserQuery,
  ListUsersQuery,
  UpdateProfileInput,
  UpdateUserInput,
  UserParams,
} from './users.types';

type HandlerCtx<T extends Record<string, unknown>> = Context<Env, string, { out: T }>;

export async function listUsersHandler(
  c: HandlerCtx<{ query: ListUsersQuery }>,
): Promise<Response> {
  const data = await userService.list(c.req.valid('query'));
  return Res.ok(Msg.USER_LISTED, data).build(c);
}

export async function createUserHandler(
  c: HandlerCtx<{ json: CreateUserInput }>,
): Promise<Response> {
  const data = await userService.create(c.req.valid('json'));
  return Res.created(Msg.USER_CREATED, data).build(c);
}

export async function getUserHandler(
  c: HandlerCtx<{ param: UserParams; query: GetUserQuery }>,
): Promise<Response> {
  const { id } = c.req.valid('param');
  const data = await userService.get(id, c.req.valid('query').collectionId);
  return Res.ok(Msg.USER_FETCHED, data).build(c);
}

export async function updateUserHandler(
  c: HandlerCtx<{ param: UserParams; json: UpdateUserInput }>,
): Promise<Response> {
  const { id } = c.req.valid('param');
  const data = await userService.update(id, c.req.valid('json'));
  return Res.ok(Msg.USER_UPDATED, data).build(c);
}

export async function updateProfileHandler(
  c: HandlerCtx<{ param: UserParams; json: UpdateProfileInput }>,
): Promise<Response> {
  const { id } = c.req.valid('param');
  const data = await userService.patchProfile(id, c.req.valid('json'));
  return Res.ok(Msg.PROFILE_UPDATED, data).build(c);
}

export async function deleteUserHandler(c: HandlerCtx<{ param: UserParams }>): Promise<Response> {
  await userService.remove(c.req.valid('param').id);
  return Res.noContent(Msg.USER_DELETED).build(c);
}
