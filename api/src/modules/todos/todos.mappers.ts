import type { NewTodo, Todo } from '@/db/schema';
import type { CreateTodoInput, TodoDto, UpdateTodoInput } from './todos.types';

/** DB row → API DTO (camelCase, ISO timestamps). */
export function toTodoDto(todo: Todo): TodoDto {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    completed: todo.completed,
    priority: todo.priority,
    userId: todo.userId,
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString(),
  };
}

/** API create input → DB insert row. */
export function toDbInsert(input: CreateTodoInput): NewTodo {
  return {
    title: input.title,
    description: input.description ?? null,
    completed: input.completed,
    priority: input.priority,
    userId: input.userId ?? null,
  };
}

/** API update input → DB update patch (only present fields + touched timestamp). */
export function toDbUpdate(input: UpdateTodoInput): Partial<NewTodo> {
  const data: Partial<NewTodo> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.completed !== undefined) data.completed = input.completed;
  if (input.priority !== undefined) data.priority = input.priority;
  data.updatedAt = new Date();
  return data;
}
