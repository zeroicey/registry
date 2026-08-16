import { and, count, eq, ilike, isNotNull, isNull, or, type SQL, sql } from 'drizzle-orm';
import { db } from '@/db/connection';
import {
  attributeValueHistory,
  attributeValues,
  type NewUser,
  type User,
  users,
} from '@/db/schema';
import { AppError } from '@/shared/errors';
import { Msg } from '@/shared/messages';
import type { AttributeFilter, ProfileEntry } from './users.types';

export interface ListUsersOptions {
  page: number;
  pageSize: number;
  search?: string;
  /** true=has a national id (code NOT NULL), false=does not (code IS NULL). */
  codeNull?: boolean;
  attributeFilters?: AttributeFilter[];
}

export interface UserRepository {
  insert(data: NewUser): Promise<User>;
  /** Insert user + initial profile values + history, atomically. */
  createWithProfile(data: NewUser, entries: ProfileEntry[]): Promise<User>;
  /** Active only (deleted_at IS NULL). */
  findById(id: number): Promise<User | undefined>;
  update(id: number, data: Partial<NewUser>): Promise<User | undefined>;
  softDelete(id: number): Promise<boolean>;
  list(options: ListUsersOptions): Promise<{ items: User[]; total: number }>;
}

export class DrizzleUserRepository implements UserRepository {
  async insert(data: NewUser): Promise<User> {
    const rows = await db.insert(users).values(data).returning();
    const row = rows[0];
    if (!row) throw new AppError('INTERNAL', Msg.INTERNAL_ERROR);
    return row;
  }

  async createWithProfile(data: NewUser, entries: ProfileEntry[]): Promise<User> {
    return db.transaction(async (tx) => {
      const userRows = await tx.insert(users).values(data).returning();
      const user = userRows[0];
      if (!user) throw new AppError('INTERNAL', Msg.INTERNAL_ERROR);
      if (entries.length > 0) {
        await tx.insert(attributeValues).values(
          entries.map((e) => ({
            userId: user.id,
            attributeId: e.attributeId,
            value: e.value,
            updatedAt: new Date(),
          })),
        );
        await tx.insert(attributeValueHistory).values(
          entries.map((e) => ({
            userId: user.id,
            attributeId: e.attributeId,
            oldValue: null,
            newValue: e.value,
            changedAt: new Date(),
          })),
        );
      }
      return user;
    });
  }

  async findById(id: number): Promise<User | undefined> {
    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return rows[0];
  }

  async update(id: number, data: Partial<NewUser>): Promise<User | undefined> {
    const rows = await db
      .update(users)
      .set(data)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning();
    return rows[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const rows = await db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({ id: users.id });
    return rows.length > 0;
  }

  async list(options: ListUsersOptions): Promise<{ items: User[]; total: number }> {
    const conditions: SQL[] = [isNull(users.deletedAt)];
    if (options.search) {
      const pattern = `%${options.search}%`;
      const searchCondition = or(ilike(users.realName, pattern), ilike(users.code, pattern));
      if (searchCondition) conditions.push(searchCondition);
    }
    if (options.codeNull === true) {
      conditions.push(isNotNull(users.code));
    } else if (options.codeNull === false) {
      conditions.push(isNull(users.code));
    }
    // Exact JSON match against attribute_values — uses the attribute_id index.
    for (const f of options.attributeFilters ?? []) {
      conditions.push(
        sql`exists (select 1 from attribute_values av where av.user_id = ${users.id} and av.attribute_id = ${f.attributeId} and av.value = ${JSON.stringify(f.value)}::jsonb)`,
      );
    }
    const where = and(...conditions);

    const [items, totalRows] = await Promise.all([
      db
        .select()
        .from(users)
        .where(where)
        .orderBy(users.id)
        .limit(options.pageSize)
        .offset((options.page - 1) * options.pageSize),
      db.select({ value: count() }).from(users).where(where),
    ]);
    return { items, total: totalRows[0]?.value ?? 0 };
  }
}

export const userRepository: UserRepository = new DrizzleUserRepository();
