import { count, desc, eq } from 'drizzle-orm';
import { db } from '@/db/connection';
import { type SourceFileRow, sourceFiles } from '@/db/schema';
import { AppError } from '@/shared/errors';
import { Msg } from '@/shared/messages';
import type { ListSourceFilesOptions } from './source-files.types';

/** New source-file payload — derived from the uploaded multipart File. */
export interface NewSourceFile {
  originalName: string;
  storagePath: string;
  mimeType: string;
  size: number;
}

/** Storage abstraction — swap the Drizzle implementation for tests or other stores. */
export interface SourceFileRepository {
  insert(data: NewSourceFile): Promise<SourceFileRow>;
  getById(id: number): Promise<SourceFileRow | undefined>;
  list(options: ListSourceFilesOptions): Promise<{ items: SourceFileRow[]; total: number }>;
}

/** Drizzle-backed repository (used by the HTTP layer). */
export class DrizzleSourceFileRepository implements SourceFileRepository {
  async insert(data: NewSourceFile): Promise<SourceFileRow> {
    const rows = await db.insert(sourceFiles).values(data).returning();
    const row = rows[0];
    if (!row) throw new AppError('INTERNAL', Msg.INTERNAL_ERROR);
    return row;
  }

  async getById(id: number): Promise<SourceFileRow | undefined> {
    const rows = await db.select().from(sourceFiles).where(eq(sourceFiles.id, id)).limit(1);
    return rows[0];
  }

  async list(options: ListSourceFilesOptions): Promise<{ items: SourceFileRow[]; total: number }> {
    const [itemRows, totalRows] = await Promise.all([
      db
        .select()
        .from(sourceFiles)
        .orderBy(desc(sourceFiles.createdAt))
        .limit(options.pageSize)
        .offset((options.page - 1) * options.pageSize),
      db.select({ count: count() }).from(sourceFiles),
    ]);
    return { items: itemRows, total: totalRows[0]?.count ?? 0 };
  }
}

export const sourceFileRepository = new DrizzleSourceFileRepository();
