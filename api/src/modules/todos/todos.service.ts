import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import { db } from '@/db/connection';
import { type Todo, todos } from '@/db/schema';
import { AppError } from '@/shared/errors';
import { Msg } from '@/shared/messages';
import { toDbInsert, toDbUpdate, toTodoDto } from './todos.mappers';
import type {
  CreateTodoInput,
  ListTodosQuery,
  PaginatedResult,
  TodoDto,
  UpdateTodoInput,
} from './todos.types';

export interface ListTodosOptions {
  page: number;
  pageSize: number;
  completed?: boolean;
  userId?: string;
}

/** Storage abstraction — swap the Drizzle implementation for tests or other stores. */
export interface TodoRepository {
  insert(data: CreateTodoInput): Promise<Todo>;
  findById(id: string): Promise<Todo | undefined>;
  list(options: ListTodosOptions): Promise<{ items: Todo[]; total: number }>;
  update(id: string, data: UpdateTodoInput): Promise<Todo | undefined>;
  remove(id: string): Promise<boolean>;
}

/** Domain service — no framework, no try/catch: throw AppError, let onError map it. */
export class TodoService {
  constructor(private readonly repo: TodoRepository) {}

  async create(input: CreateTodoInput): Promise<TodoDto> {
    return toTodoDto(await this.repo.insert(input));
  }

  async get(id: string): Promise<TodoDto> {
    const todo = await this.repo.findById(id);
    if (!todo) throw new AppError('TODO_NOT_FOUND', Msg.TODO_NOT_FOUND);
    return toTodoDto(todo);
  }

  async list(query: ListTodosQuery): Promise<PaginatedResult<TodoDto>> {
    const { items, total } = await this.repo.list({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.completed === undefined ? {} : { completed: query.completed }),
      ...(query.userId === undefined ? {} : { userId: query.userId }),
    });
    return { items: items.map(toTodoDto), total, page: query.page, pageSize: query.pageSize };
  }

  async update(id: string, input: UpdateTodoInput): Promise<TodoDto> {
    const todo = await this.repo.update(id, input);
    if (!todo) throw new AppError('TODO_NOT_FOUND', Msg.TODO_NOT_FOUND);
    return toTodoDto(todo);
  }

  async remove(id: string): Promise<void> {
    const removed = await this.repo.remove(id);
    if (!removed) throw new AppError('TODO_NOT_FOUND', Msg.TODO_NOT_FOUND);
  }
}

/** Drizzle-backed repository (used by the HTTP layer). */
export class DrizzleTodoRepository implements TodoRepository {
  async insert(data: CreateTodoInput): Promise<Todo> {
    const rows = await db.insert(todos).values(toDbInsert(data)).returning();
    const row = rows[0];
    if (!row) throw new AppError('INTERNAL', Msg.INTERNAL_ERROR);
    return row;
  }

  async findById(id: string): Promise<Todo | undefined> {
    const rows = await db.select().from(todos).where(eq(todos.id, id)).limit(1);
    return rows[0];
  }

  async list(options: ListTodosOptions): Promise<{ items: Todo[]; total: number }> {
    const conditions: SQL[] = [];
    if (options.completed !== undefined) {
      conditions.push(eq(todos.completed, options.completed));
    }
    if (options.userId !== undefined) {
      conditions.push(eq(todos.userId, options.userId));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalRows] = await Promise.all([
      db
        .select()
        .from(todos)
        .where(where)
        .orderBy(desc(todos.createdAt))
        .limit(options.pageSize)
        .offset((options.page - 1) * options.pageSize),
      db.select({ count: count() }).from(todos).where(where),
    ]);

    return { items, total: totalRows[0]?.count ?? 0 };
  }

  async update(id: string, data: UpdateTodoInput): Promise<Todo | undefined> {
    const rows = await db.update(todos).set(toDbUpdate(data)).where(eq(todos.id, id)).returning();
    return rows[0];
  }

  async remove(id: string): Promise<boolean> {
    const rows = await db.delete(todos).where(eq(todos.id, id)).returning({ id: todos.id });
    return rows.length > 0;
  }
}

export const todoService = new TodoService(new DrizzleTodoRepository());
