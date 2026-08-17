import { env } from '@/env';
import {
  type CollectionLookup,
  collectionRepository,
} from '@/modules/collections/collections.repository';
import { normalizeMimeType } from '@/modules/files/files.service';
import { AppError } from '@/shared/errors';
import { logger } from '@/shared/logger';
import { Msg } from '@/shared/messages';
import {
  buildSourceFilePath,
  deleteSourceFileFromStorage,
  openSourceFileFromStorage,
  saveSourceFile,
} from '@/shared/storage';
import { toSourceFileDto } from './source-files.mappers';
import { type SourceFileRepository, sourceFileRepository } from './source-files.repository';
import type {
  ListSourceFilesQuery,
  PaginatedResult,
  SourceFileContent,
  SourceFileDto,
} from './source-files.types';

/**
 * Domain service for data-source files (import provenance). Unlike `files`
 * (user attachments), a source file is NOT tied to a user — it is a global
 * resource that a whole batch of imported users points back to via
 * `user_source_files`. v1 exposes upload / list / download only; deletion is
 * intentionally absent because a source file is the anchor of traceability.
 */
export class SourceFileService {
  constructor(
    private readonly repo: SourceFileRepository,
    private readonly root: string,
    private readonly maxSize: number,
    private readonly collections: CollectionLookup = collectionRepository,
  ) {}

  async upload(file: File, collectionId: number): Promise<SourceFileDto> {
    const collection = await this.collections.findById(collectionId);
    if (!collection) throw new AppError('COLLECTION_NOT_FOUND', Msg.COLLECTION_NOT_FOUND);
    if (file.size > this.maxSize) {
      throw new AppError(
        'PAYLOAD_TOO_LARGE',
        `文件大小超过限制（最多 ${Math.round(this.maxSize / 1024 / 1024)} MB）`,
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const id = crypto.randomUUID();
    const mimeType = normalizeMimeType(file.type, file.name);
    const storagePath = buildSourceFilePath(id, file.name);

    // Disk first, then DB; on insert failure the partial disk file is rolled
    // back so the source-files tree stays consistent.
    await saveSourceFile(this.root, storagePath, buf);
    try {
      const row = await this.repo.insert({
        collectionId,
        originalName: file.name,
        storagePath,
        mimeType,
        size: file.size,
      });
      logger.info({ id, fileName: file.name, mimeType, size: file.size }, '数据源文件上传成功');
      return toSourceFileDto(row);
    } catch (err) {
      try {
        await deleteSourceFileFromStorage(this.root, storagePath);
      } catch (cleanupErr) {
        logger.error({ err: cleanupErr, storagePath }, '上传失败后的磁盘文件清理失败');
      }
      throw err;
    }
  }

  async list(query: ListSourceFilesQuery): Promise<PaginatedResult<SourceFileDto>> {
    const { items, total } = await this.repo.list({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.collectionId !== undefined ? { collectionId: query.collectionId } : {}),
    });
    return { items: items.map(toSourceFileDto), total, page: query.page, pageSize: query.pageSize };
  }

  async getContent(id: number): Promise<SourceFileContent> {
    const row = await this.repo.getById(id);
    if (!row) throw new AppError('SOURCE_FILE_NOT_FOUND', Msg.SOURCE_FILE_NOT_FOUND);

    let stored: Awaited<ReturnType<typeof openSourceFileFromStorage>>;
    try {
      stored = await openSourceFileFromStorage(this.root, row.storagePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new AppError('SOURCE_FILE_NOT_FOUND', Msg.SOURCE_FILE_NOT_FOUND);
      }
      throw err;
    }

    const { body, size } = stored;
    return {
      body,
      size,
      mimeType: row.mimeType,
      originalName: row.originalName,
    };
  }
}

export const sourceFileService = new SourceFileService(
  sourceFileRepository,
  env.UPLOAD_ROOT,
  env.UPLOAD_MAX_SIZE,
);
