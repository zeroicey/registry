import type { Context, Env } from 'hono';
import { Msg } from '@/shared/messages';
import { Res } from '@/shared/response';
import { todoService } from './todos.service';
import type { CreateTodoInput, ListTodosQuery, TodoParams, UpdateTodoInput } from './todos.types';

/**
 * Thin handlers: read validated input via c.req.valid(...), call the service,
 * return a response. No try/catch — throw AppError and let onError render it.
 * The Context's `out` generic carries the validated payloads, so c.req.valid
 * is fully typed without casts.
 */
type HandlerCtx<T extends Record<string, unknown>> = Context<Env, string, { out: T }>;

export async function createTodoHandler(
  c: HandlerCtx<{ json: CreateTodoInput }>,
): Promise<Response> {
  const input = c.req.valid('json');
  const todo = await todoService.create(input);
  return Res.created(Msg.TODO_CREATED, todo).build(c);
}

export async function listTodosHandler(
  c: HandlerCtx<{ query: ListTodosQuery }>,
): Promise<Response> {
  const query = c.req.valid('query');
  const result = await todoService.list(query);
  return Res.ok(Msg.TODO_LISTED, result).build(c);
}

export async function getTodoHandler(c: HandlerCtx<{ param: TodoParams }>): Promise<Response> {
  const { id } = c.req.valid('param');
  const todo = await todoService.get(id);
  return Res.ok(Msg.TODO_FETCHED, todo).build(c);
}

export async function updateTodoHandler(
  c: HandlerCtx<{ param: TodoParams; json: UpdateTodoInput }>,
): Promise<Response> {
  const { id } = c.req.valid('param');
  const input = c.req.valid('json');
  const todo = await todoService.update(id, input);
  return Res.ok(Msg.TODO_UPDATED, todo).build(c);
}

export async function deleteTodoHandler(c: HandlerCtx<{ param: TodoParams }>): Promise<Response> {
  const { id } = c.req.valid('param');
  await todoService.remove(id);
  return Res.noContent(Msg.TODO_DELETED).build(c);
}
