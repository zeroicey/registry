import { Hono } from 'hono';
import { validator } from '@/shared/validator';
import {
  addCollectionMembersHandler,
  createCollectionHandler,
  deleteCollectionHandler,
  getCollectionHandler,
  listCollectionsHandler,
  removeCollectionMemberHandler,
  updateCollectionHandler,
} from './collections.handler';
import {
  addCollectionMembersSchema,
  collectionMemberParamsSchema,
  collectionParamsSchema,
  createCollectionSchema,
  listCollectionsQuerySchema,
  updateCollectionSchema,
} from './collections.schema';

/**
 * 名录（集合）路由：领域实例的一级分组。属性、来源文件、人员都归属到名录下，
 * 解决异构数据源下同名属性（工号/学号）互相污染的问题。
 */
export const collectionsRouter = new Hono()
  .get('/', validator.query(listCollectionsQuerySchema), listCollectionsHandler)
  .post('/', validator.json(createCollectionSchema), createCollectionHandler)
  .get('/:id', validator.params(collectionParamsSchema), getCollectionHandler)
  .patch(
    '/:id',
    validator.params(collectionParamsSchema),
    validator.json(updateCollectionSchema),
    updateCollectionHandler,
  )
  .delete('/:id', validator.params(collectionParamsSchema), deleteCollectionHandler)
  .post(
    '/:id/members',
    validator.params(collectionParamsSchema),
    validator.json(addCollectionMembersSchema),
    addCollectionMembersHandler,
  )
  .delete(
    '/:id/members/:userId',
    validator.params(collectionMemberParamsSchema),
    removeCollectionMemberHandler,
  );
