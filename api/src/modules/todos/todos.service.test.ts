import { describe, expect, test } from 'bun:test';
import type { Todo } from '@/db/schema';
import { AppError } from '@/shared/errors';
import { createTodoSchema, updateTodoSchema } from './todos.schema';
import { type TodoRepository, TodoService } from './todos.service';

// ── in-memory fake repository — tests run without a database ──
function makeFakeRepo(): { repo: TodoRepository; store: Map<string, Todo> } {
  const store = new Map<string, Todo>();

  const repo: TodoRepository = {
    async insert(data) {
      const now = new Date();
      const todo: Todo = {
        id: crypto.randomUUID(),
        title: data.title,
        description: data.description ?? null,
        completed: data.completed,
        priority: data.priority,
        userId: data.userId ?? null,
        createdAt: now,
        updatedAt: now,
      };
      store.set(todo.id, todo);
      return todo;
    },
    async findById(id) {
      return store.get(id);
    },
    async list(options) {
      const all = [...store.values()]
        .filter((t) => options.completed === undefined || t.completed === options.completed)
        .filter((t) => options.userId === undefined || t.userId === options.userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return {
        items: all.slice((options.page - 1) * options.pageSize, options.page * options.pageSize),
        total: all.length,
      };
    },
    async update(id, data) {
      const existing = store.get(id);
      if (!existing) return undefined;
      const updated: Todo = {
        ...existing,
        title: data.title ?? existing.title,
        description: data.description !== undefined ? data.description : existing.description,
        completed: data.completed ?? existing.completed,
        priority: data.priority ?? existing.priority,
        updatedAt: new Date(),
      };
      store.set(id, updated);
      return updated;
    },
    async remove(id) {
      return store.delete(id);
    },
  };

  return { repo, store };
}

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

async function captureError<T>(promise: Promise<T>): Promise<unknown> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    return err;
  }
}

describe('TodoService', () => {
  test('create returns a DTO with defaults applied', async () => {
    const { repo } = makeFakeRepo();
    const service = new TodoService(repo);

    const todo = await service.create(createTodoSchema.parse({ title: 'Buy milk' }));

    expect(todo.title).toBe('Buy milk');
    expect(todo.description).toBeNull();
    expect(todo.completed).toBe(false);
    expect(todo.priority).toBe(0);
    expect(todo.userId).toBeNull();
    expect(typeof todo.id).toBe('string');
    expect(typeof todo.createdAt).toBe('string');
    expect(typeof todo.updatedAt).toBe('string');
  });

  test('get returns the todo when it exists', async () => {
    const { repo } = makeFakeRepo();
    const service = new TodoService(repo);
    const created = await service.create(createTodoSchema.parse({ title: 'Read a book' }));

    const found = await service.get(created.id);

    expect(found.id).toBe(created.id);
    expect(found.title).toBe('Read a book');
  });

  test('get throws TODO_NOT_FOUND for a missing todo', async () => {
    const { repo } = makeFakeRepo();
    const service = new TodoService(repo);

    const err = await captureError(service.get('00000000-0000-0000-0000-000000000000'));

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('TODO_NOT_FOUND');
    expect((err as AppError).status).toBe(404);
  });

  test('list paginates and filters by completed and userId', async () => {
    const { repo } = makeFakeRepo();
    const service = new TodoService(repo);

    await service.create(createTodoSchema.parse({ title: 'A', completed: true, userId: USER_A }));
    await service.create(createTodoSchema.parse({ title: 'B', userId: USER_A }));
    await service.create(createTodoSchema.parse({ title: 'C', userId: USER_B }));

    const all = await service.list({ page: 1, pageSize: 10 });
    expect(all.total).toBe(3);
    expect(all.items).toHaveLength(3);

    const done = await service.list({ page: 1, pageSize: 10, completed: true });
    expect(done.total).toBe(1);
    expect(done.items[0]?.title).toBe('A');

    const userA = await service.list({ page: 1, pageSize: 10, userId: USER_A });
    expect(userA.total).toBe(2);

    const page2 = await service.list({ page: 2, pageSize: 2 });
    expect(page2.items).toHaveLength(1);
    expect(page2.total).toBe(3);
  });

  test('update merges fields and bumps updatedAt', async () => {
    const { repo } = makeFakeRepo();
    const service = new TodoService(repo);
    const created = await service.create(createTodoSchema.parse({ title: 'Old title' }));

    const updated = await service.update(
      created.id,
      updateTodoSchema.parse({ title: 'New title', completed: true }),
    );

    expect(updated.title).toBe('New title');
    expect(updated.completed).toBe(true);
    expect(updated.description).toBeNull();
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.updatedAt).getTime(),
    );
  });

  test('update throws TODO_NOT_FOUND for a missing todo', async () => {
    const { repo } = makeFakeRepo();
    const service = new TodoService(repo);

    const err = await captureError(
      service.update(
        '00000000-0000-0000-0000-000000000000',
        updateTodoSchema.parse({ completed: true }),
      ),
    );

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('TODO_NOT_FOUND');
  });

  test('remove deletes an existing todo', async () => {
    const { repo, store } = makeFakeRepo();
    const service = new TodoService(repo);
    const created = await service.create(createTodoSchema.parse({ title: 'To delete' }));

    await service.remove(created.id);

    expect(store.size).toBe(0);
  });

  test('remove throws TODO_NOT_FOUND for a missing todo', async () => {
    const { repo } = makeFakeRepo();
    const service = new TodoService(repo);

    const err = await captureError(service.remove('00000000-0000-0000-0000-000000000000'));

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('TODO_NOT_FOUND');
  });
});
