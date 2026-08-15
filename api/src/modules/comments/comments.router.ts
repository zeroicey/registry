import { Hono } from 'hono';
import { validator } from '@/shared/validator';
import {
  createCommentHandler,
  deleteCommentHandler,
  listCommentsHandler,
  updateCommentHandler,
} from './comments.handler';
import {
  commentParamsSchema,
  createCommentSchema,
  listCommentsQuerySchema,
  updateCommentSchema,
  userIdParamsSchema,
} from './comments.schema';

/** RESTful comments routes — every route validates via the shared validator. */
export const commentsRouter = new Hono();

commentsRouter
  .post(
    '/users/:userId/comments',
    validator.params(userIdParamsSchema),
    validator.json(createCommentSchema),
    createCommentHandler,
  )
  .get(
    '/users/:userId/comments',
    validator.params(userIdParamsSchema),
    validator.query(listCommentsQuerySchema),
    listCommentsHandler,
  )
  .patch(
    '/comments/:id',
    validator.params(commentParamsSchema),
    validator.json(updateCommentSchema),
    updateCommentHandler,
  )
  .delete('/comments/:id', validator.params(commentParamsSchema), deleteCommentHandler);
