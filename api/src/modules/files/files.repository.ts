import { and, count, desc, eq, isNull, type SQL } from 'drizzle-orm';
import { db } from '@/db/connection';
import { type FileRow, files, users } from '@/db/schema';
import { AppError } from '@/shared/errors';
import { Msg } from '@/shared/messages';
import type { ListFilesOptions } from './files.types';

/** New-file payload — derived from the uploaded multipart File. */
export interface NewFile {
  originalName: string;
  storagePath: string;
  mimeType: string;
  size: number;
}

/** Storage abstraction — swap the Drizzle implementation for tests or other stores. */
export interface FileRepository {
  /** False for missing or soft-deleted users. */
  userExists(userId: number): Promise<boolean>;
  insert(userId: number, data: NewFile): Promise<FileRow>;
  getById(id: number): Promise<FileRow | undefined>;
  list(userId: number, options: ListFilesOptions): Promise<{ items: FileRow[]; total: number }>;
  remove(id: number): Promise<boolean>;
  /** Every storage_path referenced by a DB record (for orphan cleanup). */
  allStoragePaths(): Promise<string[]>;
}

/** Drizzle-backed repository (used by the HTTP layer). */
export class DrizzleFileRepository implements FileRepository {
  async userExists(userId: number): Promise<boolean> {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);
    return rows.length > 0;
  }

  async insert(userId: number, data: NewFile): Promise<FileRow> {
    const rows = await db
      .insert(files)
      .values({ userId, ...data })
      .returning();
    const row = rows[0];
    if (!row) throw new AppError('INTERNAL', Msg.INTERNAL_ERROR);
    return row;
  }

  async getById(id: number): Promise<FileRow | undefined> {
    const rows = await db.select().from(files).where(eq(files.id, id)).limit(1);
    return rows[0];
  }

  async list(
    userId: number,
    options: ListFilesOptions,
  ): Promise<{ items: FileRow[]; total: number }> {
    const where: SQL | undefined = eq(files.userId, userId);

    const [items, totalRows] = await Promise.all([
      db
        .select()
        .from(files)
        .where(where)
        .orderBy(desc(files.createdAt))
        .limit(options.pageSize)
        .offset((options.page - 1) * options.pageSize),
      db.select({ count: count() }).from(files).where(where),
    ]);

    return { items, total: totalRows[0]?.count ?? 0 };
  }

  async remove(id: number): Promise<boolean> {
    const rows = await db.delete(files).where(eq(files.id, id)).returning({ id: files.id });
    return rows.length > 0;
  }

  async allStoragePaths(): Promise<string[]> {
    const rows = await db.select({ storagePath: files.storagePath }).from(files);
    return rows.map((r) => r.storagePath);
  }
}

export const fileRepository = new DrizzleFileRepository();
