import { Hono } from 'hono';
import { validator } from '@/shared/validator';
import {
  createUserHandler,
  deleteUserHandler,
  getUserHandler,
  listUsersHandler,
  updateProfileHandler,
  updateUserHandler,
} from './users.handler';
import {
  createUserSchema,
  getUserQuerySchema,
  listUsersQuerySchema,
  updateProfileSchema,
  updateUserSchema,
  userParamsSchema,
} from './users.schema';

/** RESTful user routes — every route validates via the shared validator. */
export const usersRouter = new Hono();

usersRouter
  .get('/', validator.query(listUsersQuerySchema), listUsersHandler)
  .post('/', validator.json(createUserSchema), createUserHandler)
  .get(
    '/:id',
    validator.params(userParamsSchema),
    validator.query(getUserQuerySchema),
    getUserHandler,
  )
  .patch(
    '/:id',
    validator.params(userParamsSchema),
    validator.json(updateUserSchema),
    updateUserHandler,
  )
  .patch(
    '/:id/profile',
    validator.params(userParamsSchema),
    validator.json(updateProfileSchema),
    updateProfileHandler,
  )
  .delete('/:id', validator.params(userParamsSchema), deleteUserHandler);
