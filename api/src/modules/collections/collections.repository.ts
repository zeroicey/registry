import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/connection';
import {
  type Collection,
  collectionMembers,
  collections,
  type NewCollection,
  users,
} from '@/db/schema';
import { AppError } from '@/shared/errors';
import { Msg } from '@/shared/messages';

/** A collection row joined with its active member count. */
export interface CollectionWithCount extends Collection {
  memberCount: number;
}

/**
 * Minimal read-only dependency for cross-module existence checks
 * (e.g. users/source-files confirm a collection exists by id).
 */
export interface CollectionLookup {
  findById(id: number): Promise<{ id: number } | undefined>;
}

/** Storage abstraction — swap the Drizzle implementation for tests or other stores. */
export interface CollectionRepository {
  insert(data: NewCollection): Promise<Collection>;
  /** Active only (deleted_at IS NULL). */
  findById(id: number): Promise<Collection | undefined>;
  list(options: {
    page: number;
    pageSize: number;
  }): Promise<{ items: CollectionWithCount[]; total: number }>;
  update(id: number, data: Partial<NewCollection>): Promise<Collection | undefined>;
  softDelete(id: number): Promise<boolean>;
  /** Idempotent bulk-add of members (existing (collection, user) rows skipped). */
  addMembers(collectionId: number, userIds: number[]): Promise<void>;
  removeMember(collectionId: number, userId: number): Promise<void>;
  /** Active user ids that exist among `userIds` — used to reject unknown/deleted members. */
  findActiveUserIds(userIds: number[]): Promise<number[]>;
  /** Active member count for a collection. */
  countMembers(collectionId: number): Promise<number>;
}

const memberCountSubquery = sql<number>`coalesce(
  (select count(*)::int from collection_members cm where cm.collection_id = ${collections.id}),
  0
)`;

export class DrizzleCollectionRepository implements CollectionRepository {
  async insert(data: NewCollection): Promise<Collection> {
    const rows = await db.insert(collections).values(data).returning();
    const row = rows[0];
    if (!row) throw new AppError('INTERNAL', Msg.INTERNAL_ERROR);
    return row;
  }

  async findById(id: number): Promise<Collection | undefined> {
    const rows = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, id), isNull(collections.deletedAt)))
      .limit(1);
    return rows[0];
  }

  async list(options: {
    page: number;
    pageSize: number;
  }): Promise<{ items: CollectionWithCount[]; total: number }> {
    const where = isNull(collections.deletedAt);
    const [items, totalRows] = await Promise.all([
      db
        .select({
          id: collections.id,
          name: collections.name,
          description: collections.description,
          deletedAt: collections.deletedAt,
          createdAt: collections.createdAt,
          updatedAt: collections.updatedAt,
          memberCount: memberCountSubquery,
        })
        .from(collections)
        .where(where)
        .orderBy(collections.id)
        .limit(options.pageSize)
        .offset((options.page - 1) * options.pageSize),
      db.select({ value: count() }).from(collections).where(where),
    ]);
    return { items, total: totalRows[0]?.value ?? 0 };
  }

  async update(id: number, data: Partial<NewCollection>): Promise<Collection | undefined> {
    const rows = await db
      .update(collections)
      .set(data)
      .where(and(eq(collections.id, id), isNull(collections.deletedAt)))
      .returning();
    return rows[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const rows = await db
      .update(collections)
      .set({ deletedAt: new Date() })
      .where(and(eq(collections.id, id), isNull(collections.deletedAt)))
      .returning({ id: collections.id });
    return rows.length > 0;
  }

  async addMembers(collectionId: number, userIds: number[]): Promise<void> {
    const now = new Date();
    await db
      .insert(collectionMembers)
      .values(userIds.map((userId) => ({ collectionId, userId, joinedAt: now })))
      .onConflictDoNothing({ target: [collectionMembers.collectionId, collectionMembers.userId] });
  }

  async removeMember(collectionId: number, userId: number): Promise<void> {
    await db
      .delete(collectionMembers)
      .where(
        and(eq(collectionMembers.collectionId, collectionId), eq(collectionMembers.userId, userId)),
      );
  }

  async findActiveUserIds(userIds: number[]): Promise<number[]> {
    if (userIds.length === 0) return [];
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, [...new Set(userIds)]), isNull(users.deletedAt)));
    return rows.map((r) => r.id);
  }

  async countMembers(collectionId: number): Promise<number> {
    const rows = await db
      .select({ value: count() })
      .from(collectionMembers)
      .where(eq(collectionMembers.collectionId, collectionId));
    return rows[0]?.value ?? 0;
  }
}

export const collectionRepository: CollectionRepository = new DrizzleCollectionRepository();
