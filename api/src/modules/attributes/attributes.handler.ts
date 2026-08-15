import type { Context, Env } from 'hono';
import { Msg } from '@/shared/messages';
import { Res } from '@/shared/response';
import { attributeService } from './attributes.service';
import type {
  AttributeParams,
  CreateAttributeInput,
  ListAttributesQuery,
  UpdateAttributeInput,
} from './attributes.types';

type HandlerCtx<T extends Record<string, unknown>> = Context<Env, string, { out: T }>;

export async function listAttributesHandler(
  c: HandlerCtx<{ query: ListAttributesQuery }>,
): Promise<Response> {
  const data = await attributeService.list(c.req.valid('query'));
  return Res.ok(Msg.ATTRIBUTE_LISTED, data).build(c);
}

export async function createAttributeHandler(
  c: HandlerCtx<{ json: CreateAttributeInput }>,
): Promise<Response> {
  const data = await attributeService.create(c.req.valid('json'));
  return Res.created(Msg.ATTRIBUTE_CREATED, data).build(c);
}

export async function getAttributeHandler(
  c: HandlerCtx<{ param: AttributeParams }>,
): Promise<Response> {
  const data = await attributeService.get(c.req.valid('param').id);
  return Res.ok(Msg.ATTRIBUTE_FETCHED, data).build(c);
}

export async function updateAttributeHandler(
  c: HandlerCtx<{ param: AttributeParams; json: UpdateAttributeInput }>,
): Promise<Response> {
  const { id } = c.req.valid('param');
  const data = await attributeService.update(id, c.req.valid('json'));
  return Res.ok(Msg.ATTRIBUTE_UPDATED, data).build(c);
}

export async function deleteAttributeHandler(
  c: HandlerCtx<{ param: AttributeParams }>,
): Promise<Response> {
  await attributeService.remove(c.req.valid('param').id);
  return Res.noContent(Msg.ATTRIBUTE_DELETED).build(c);
}
