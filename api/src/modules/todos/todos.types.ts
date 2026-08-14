import type { z } from 'zod';
import type {
  createTodoSchema,
  listTodosQuerySchema,
  todoParamsSchema,
  updateTodoSchema,
} from './todos.schema';

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type ListTodosQuery = z.infer<typeof listTodosQuerySchema>;
export type TodoParams = z.infer<typeof todoParamsSchema>;

/** API-facing todo shape (camelCase, ISO timestamps). */
export interface TodoDto {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  priority: number;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
