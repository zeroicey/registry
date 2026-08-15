import { and, count, desc, eq, isNull, type SQL } from 'drizzle-orm';
import { db } from '@/db/connection';
import { type Comment, comments, users } from '@/db/schema';
import { AppError } from '@/shared/errors';
import { Msg } from '@/shared/messages';
import { toCommentDto, toDbInsert } from './comments.mappers';
import type {
  CommentDto,
  CreateCommentInput,
  ListCommentsQuery,
  PaginatedResult,
  UpdateCommentInput,
} from './comments.types';

export interface ListCommentsOptions {
  page: number;
  pageSize: number;
}

/** Storage abstraction — swap the Drizzle implementation for tests or other stores. */
export interface CommentRepository {
  /** False for missing or soft-deleted users. */
  userExists(userId: number): Promise<boolean>;
  insert(userId: number, data: CreateCommentInput): Promise<Comment>;
  list(userId: number, options: ListCommentsOptions): Promise<{ items: Comment[]; total: number }>;
  update(id: number, data: UpdateCommentInput): Promise<Comment | undefined>;
  remove(id: number): Promise<boolean>;
}

/** Domain service — no framework, no try/catch: throw AppError, let onError map it. */
export class CommentService {
  constructor(private readonly repo: CommentRepository) {}

  async create(userId: number, input: CreateCommentInput): Promise<CommentDto> {
    if (!(await this.repo.userExists(userId))) {
      throw new AppError('USER_NOT_FOUND', Msg.USER_NOT_FOUND);
    }
    return toCommentDto(await this.repo.insert(userId, input));
  }

  async list(userId: number, query: ListCommentsQuery): Promise<PaginatedResult<CommentDto>> {
    if (!(await this.repo.userExists(userId))) {
      throw new AppError('USER_NOT_FOUND', Msg.USER_NOT_FOUND);
    }
    const { items, total } = await this.repo.list(userId, {
      page: query.page,
      pageSize: query.pageSize,
    });
    return { items: items.map(toCommentDto), total, page: query.page, pageSize: query.pageSize };
  }

  async update(id: number, input: UpdateCommentInput): Promise<CommentDto> {
    const comment = await this.repo.update(id, input);
    if (!comment) throw new AppError('COMMENT_NOT_FOUND', Msg.COMMENT_NOT_FOUND);
    return toCommentDto(comment);
  }

  async remove(id: number): Promise<void> {
    const removed = await this.repo.remove(id);
    if (!removed) throw new AppError('COMMENT_NOT_FOUND', Msg.COMMENT_NOT_FOUND);
  }
}

/** Drizzle-backed repository (used by the HTTP layer). */
export class DrizzleCommentRepository implements CommentRepository {
  async userExists(userId: number): Promise<boolean> {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);
    return rows.length > 0;
  }

  async insert(userId: number, data: CreateCommentInput): Promise<Comment> {
    const rows = await db.insert(comments).values(toDbInsert(userId, data)).returning();
    const row = rows[0];
    if (!row) throw new AppError('INTERNAL', Msg.INTERNAL_ERROR);
    return row;
  }

  async list(
    userId: number,
    options: ListCommentsOptions,
  ): Promise<{ items: Comment[]; total: number }> {
    const where: SQL | undefined = eq(comments.userId, userId);

    const [items, totalRows] = await Promise.all([
      db
        .select()
        .from(comments)
        .where(where)
        .orderBy(desc(comments.createdAt))
        .limit(options.pageSize)
        .offset((options.page - 1) * options.pageSize),
      db.select({ count: count() }).from(comments).where(where),
    ]);

    return { items, total: totalRows[0]?.count ?? 0 };
  }

  async update(id: number, data: UpdateCommentInput): Promise<Comment | undefined> {
    const rows = await db
      .update(comments)
      .set({ content: data.content })
      .where(eq(comments.id, id))
      .returning();
    return rows[0];
  }

  async remove(id: number): Promise<boolean> {
    const rows = await db
      .delete(comments)
      .where(eq(comments.id, id))
      .returning({ id: comments.id });
    return rows.length > 0;
  }
}

export const commentService = new CommentService(new DrizzleCommentRepository());
