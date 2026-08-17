import type { Context, Env } from 'hono';
import { Msg } from '@/shared/messages';
import { Res } from '@/shared/response';
import { collectionService } from './collections.service';
import type {
  AddCollectionMembersInput,
  CollectionMemberParams,
  CollectionParams,
  CreateCollectionInput,
  ListCollectionsQuery,
  UpdateCollectionInput,
} from './collections.types';

type HandlerCtx<T extends Record<string, unknown>> = Context<Env, string, { out: T }>;

export async function listCollectionsHandler(
  c: HandlerCtx<{ query: ListCollectionsQuery }>,
): Promise<Response> {
  const data = await collectionService.list(c.req.valid('query'));
  return Res.ok(Msg.COLLECTION_LISTED, data).build(c);
}

export async function createCollectionHandler(
  c: HandlerCtx<{ json: CreateCollectionInput }>,
): Promise<Response> {
  const data = await collectionService.create(c.req.valid('json'));
  return Res.created(Msg.COLLECTION_CREATED, data).build(c);
}

export async function getCollectionHandler(
  c: HandlerCtx<{ param: CollectionParams }>,
): Promise<Response> {
  const data = await collectionService.get(c.req.valid('param').id);
  return Res.ok(Msg.COLLECTION_FETCHED, data).build(c);
}

export async function updateCollectionHandler(
  c: HandlerCtx<{ param: CollectionParams; json: UpdateCollectionInput }>,
): Promise<Response> {
  const { id } = c.req.valid('param');
  const data = await collectionService.update(id, c.req.valid('json'));
  return Res.ok(Msg.COLLECTION_UPDATED, data).build(c);
}

export async function deleteCollectionHandler(
  c: HandlerCtx<{ param: CollectionParams }>,
): Promise<Response> {
  await collectionService.remove(c.req.valid('param').id);
  return Res.noContent(Msg.COLLECTION_DELETED).build(c);
}

export async function addCollectionMembersHandler(
  c: HandlerCtx<{ param: CollectionParams; json: AddCollectionMembersInput }>,
): Promise<Response> {
  const { id } = c.req.valid('param');
  const data = await collectionService.addMembers(id, c.req.valid('json'));
  return Res.ok(Msg.COLLECTION_MEMBERS_ADDED, data).build(c);
}

export async function removeCollectionMemberHandler(
  c: HandlerCtx<{ param: CollectionMemberParams }>,
): Promise<Response> {
  const { id, userId } = c.req.valid('param');
  await collectionService.removeMember(id, userId);
  return Res.noContent(Msg.COLLECTION_MEMBER_REMOVED).build(c);
}
