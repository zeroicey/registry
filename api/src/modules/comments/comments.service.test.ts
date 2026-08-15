import { describe, expect, test } from 'bun:test';
import type { Comment } from '@/db/schema';
import { AppError } from '@/shared/errors';
import { createCommentSchema, updateCommentSchema } from './comments.schema';
import { type CommentRepository, CommentService } from './comments.service';

// ── in-memory fake repository — tests run without a database ──
const baseTime = Date.now();

function makeFakeRepo(): {
  repo: CommentRepository;
  users: Set<number>;
  store: Map<number, Comment>;
} {
  const users = new Set<number>();
  const store = new Map<number, Comment>();
  // Monotonic clock so back-to-back inserts never collide on createdAt.
  let lastTick = 0;

  const repo: CommentRepository = {
    async userExists(userId) {
      return users.has(userId);
    },
    async insert(userId, data) {
      const now = new Date(baseTime + ++lastTick);
      const comment: Comment = {
        id: store.size + 1,
        userId,
        content: data.content,
        createdBy: null,
        createdAt: now,
        updatedAt: now,
      };
      store.set(comment.id, comment);
      return comment;
    },
    async list(userId, options) {
      const all = [...store.values()]
        .filter((c) => c.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return {
        items: all.slice((options.page - 1) * options.pageSize, options.page * options.pageSize),
        total: all.length,
      };
    },
    async update(id, data) {
      const existing = store.get(id);
      if (!existing) return undefined;
      const updated: Comment = {
        ...existing,
        content: data.content,
        updatedAt: new Date(baseTime + ++lastTick),
      };
      store.set(id, updated);
      return updated;
    },
    async remove(id) {
      return store.delete(id);
    },
  };

  return { repo, users, store };
}

async function captureError<T>(promise: Promise<T>): Promise<unknown> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    return err;
  }
}

describe('CommentService', () => {
  test('create returns a DTO when the user exists', async () => {
    const { repo, users } = makeFakeRepo();
    const service = new CommentService(repo);
    users.add(1);

    const comment = await service.create(1, createCommentSchema.parse({ content: 'Hello' }));

    expect(comment.userId).toBe(1);
    expect(comment.content).toBe('Hello');
    expect(typeof comment.id).toBe('number');
    expect(typeof comment.createdAt).toBe('string');
    expect(typeof comment.updatedAt).toBe('string');
    expect(comment).not.toHaveProperty('createdBy');
  });

  test('create throws NOT_FOUND when the user is missing', async () => {
    const { repo } = makeFakeRepo();
    const service = new CommentService(repo);

    const err = await captureError(
      service.create(1, createCommentSchema.parse({ content: 'Hello' })),
    );

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('USER_NOT_FOUND');
    expect((err as AppError).status).toBe(404);
  });

  test('list returns items with pagination, ordered by repo', async () => {
    const { repo, users } = makeFakeRepo();
    const service = new CommentService(repo);
    users.add(1);
    users.add(2);

    const first = await service.create(1, createCommentSchema.parse({ content: 'First' }));
    const second = await service.create(1, createCommentSchema.parse({ content: 'Second' }));
    await service.create(2, createCommentSchema.parse({ content: 'Other user' }));

    const result = await service.list(1, { page: 1, pageSize: 10 });

    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    // Newest first (repo supplies creation-order descending).
    expect(result.items.map((c) => c.id)).toEqual([second.id, first.id]);

    const page1 = await service.list(1, { page: 1, pageSize: 1 });
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0]?.id).toBe(second.id);
    expect(page1.total).toBe(2);

    const page2 = await service.list(1, { page: 2, pageSize: 1 });
    expect(page2.items[0]?.id).toBe(first.id);
  });

  test('list throws NOT_FOUND when the user is missing', async () => {
    const { repo } = makeFakeRepo();
    const service = new CommentService(repo);

    const err = await captureError(service.list(1, { page: 1, pageSize: 10 }));

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('USER_NOT_FOUND');
  });

  test('update changes content and bumps updatedAt', async () => {
    const { repo, users } = makeFakeRepo();
    const service = new CommentService(repo);
    users.add(1);
    const created = await service.create(1, createCommentSchema.parse({ content: 'Old' }));

    const updated = await service.update(created.id, updateCommentSchema.parse({ content: 'New' }));

    expect(updated.id).toBe(created.id);
    expect(updated.content).toBe('New');
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.updatedAt).getTime(),
    );
  });

  test('update throws NOT_FOUND for a missing comment', async () => {
    const { repo } = makeFakeRepo();
    const service = new CommentService(repo);

    const err = await captureError(
      service.update(9999, updateCommentSchema.parse({ content: 'New' })),
    );

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('COMMENT_NOT_FOUND');
  });

  test('remove deletes an existing comment', async () => {
    const { repo, users, store } = makeFakeRepo();
    const service = new CommentService(repo);
    users.add(1);
    const created = await service.create(1, createCommentSchema.parse({ content: 'To delete' }));

    await service.remove(created.id);

    expect(store.size).toBe(0);
  });

  test('remove throws NOT_FOUND for a missing comment', async () => {
    const { repo } = makeFakeRepo();
    const service = new CommentService(repo);

    const err = await captureError(service.remove(9999));

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('COMMENT_NOT_FOUND');
  });
});
