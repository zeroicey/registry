import { Hono } from 'hono';
import { validator } from '@/shared/validator';
import {
  createTodoHandler,
  deleteTodoHandler,
  getTodoHandler,
  listTodosHandler,
  updateTodoHandler,
} from './todos.handler';
import {
  createTodoSchema,
  listTodosQuerySchema,
  todoParamsSchema,
  updateTodoSchema,
} from './todos.schema';

/** RESTful todos routes — every route validates via the shared validator. */
export const todosRouter = new Hono();

todosRouter
  .post('/', validator.json(createTodoSchema), createTodoHandler)
  .get('/', validator.query(listTodosQuerySchema), listTodosHandler)
  .get('/:id', validator.params(todoParamsSchema), getTodoHandler)
  .patch(
    '/:id',
    validator.params(todoParamsSchema),
    validator.json(updateTodoSchema),
    updateTodoHandler,
  )
  .delete('/:id', validator.params(todoParamsSchema), deleteTodoHandler);
