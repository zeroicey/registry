import { env } from '@/env';
import { AppError } from '@/shared/errors';
import { logger } from '@/shared/logger';
import { Msg } from '@/shared/messages';
import {
  buildStoragePath,
  deleteFileFromStorage,
  listStoragePaths,
  openFileFromStorage,
  saveFile,
} from '@/shared/storage';
import { toFileDto } from './files.mappers';
import { type FileRepository, fileRepository } from './files.repository';
import type {
  CleanupResult,
  FileContent,
  FileDto,
  ListFilesQuery,
  PaginatedResult,
} from './files.types';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Normalize the MIME type: trust the multipart-provided type when it looks
 * plausible, otherwise fall back to a guess from the extension or a generic
 * binary type. Used only for storage layout + the Content-Type header.
 */
export function normalizeMimeType(provided: string, originalName: string): string {
  const trimmed = provided.trim();
  if (/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(trimmed)) return trimmed.toLowerCase();
  const ext = originalName.toLowerCase();
  const byExt: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.zip': 'application/zip',
  };
  for (const [key, mime] of Object.entries(byExt)) {
    if (ext.endsWith(key)) return mime;
  }
  return 'application/octet-stream';
}

/** Domain service — no framework, no try/catch: throw AppError, let onError map it. */
export class FileService {
  constructor(
    private readonly repo: FileRepository,
    private readonly root: string,
    private readonly maxSize: number,
  ) {}

  async upload(userId: number, file: File): Promise<FileDto> {
    if (!(await this.repo.userExists(userId))) {
      throw new AppError('USER_NOT_FOUND', Msg.USER_NOT_FOUND);
    }
    if (file.size > this.maxSize) {
      throw new AppError(
        'PAYLOAD_TOO_LARGE',
        `文件大小超过限制（最多 ${Math.round(this.maxSize / 1024 / 1024)} MB）`,
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const id = crypto.randomUUID();
    const mimeType = normalizeMimeType(file.type, file.name);
    const storagePath = buildStoragePath(mimeType, id, file.name);

    // Disk first, then DB. If the DB insert fails the partial disk file is
    // rolled back (best-effort) so the storage tree stays consistent.
    await saveFile(this.root, storagePath, buf);
    try {
      const row = await this.repo.insert(userId, {
        originalName: file.name,
        storagePath,
        mimeType,
        size: file.size,
      });
      logger.info({ id, fileName: file.name, mimeType, size: file.size }, '文件上传成功');
      return toFileDto(row);
    } catch (err) {
      try {
        await deleteFileFromStorage(this.root, storagePath);
      } catch (cleanupErr) {
        logger.error({ err: cleanupErr, storagePath }, '上传失败后的磁盘文件清理失败');
      }
      throw err;
    }
  }

  async list(userId: number, query: ListFilesQuery): Promise<PaginatedResult<FileDto>> {
    if (!(await this.repo.userExists(userId))) {
      throw new AppError('USER_NOT_FOUND', Msg.USER_NOT_FOUND);
    }
    const { items, total } = await this.repo.list(userId, {
      page: query.page,
      pageSize: query.pageSize,
    });
    return { items: items.map(toFileDto), total, page: query.page, pageSize: query.pageSize };
  }

  async getContent(id: number): Promise<FileContent> {
    const row = await this.repo.getById(id);
    if (!row) throw new AppError('FILE_NOT_FOUND', Msg.FILE_NOT_FOUND);
    const { body, size } = await openFileFromStorage(this.root, row.storagePath);
    return {
      body,
      size,
      mimeType: row.mimeType,
      originalName: row.originalName,
    };
  }

  /**
   * Delete the DB record only — the physical file is kept on disk. Orphaned
   * files can later be purged with cleanupOrphanFiles (manual trigger).
   */
  async remove(id: number): Promise<void> {
    const removed = await this.repo.remove(id);
    if (!removed) throw new AppError('FILE_NOT_FOUND', Msg.FILE_NOT_FOUND);
    logger.info({ id }, '文件记录已删除（物理文件保留，等待孤儿清理）');
  }

  /** Delete disk files that no DB record references. */
  async cleanupOrphanFiles(): Promise<CleanupResult> {
    const [diskPaths, referencedRows] = await Promise.all([
      listStoragePaths(this.root),
      this.repo.allStoragePaths(),
    ]);
    const referenced = new Set(referencedRows);
    const deleted: string[] = [];
    const failed: CleanupResult['failed'] = [];

    for (const path of diskPaths) {
      if (referenced.has(path)) continue;
      try {
        await deleteFileFromStorage(this.root, path);
        deleted.push(path);
      } catch (err) {
        failed.push({ path, message: errorMessage(err) });
      }
    }

    logger.info({ checked: diskPaths.length, deleted: deleted.length }, '孤儿文件清理完成');
    return { checked: diskPaths.length, deleted, failed };
  }
}

export const fileService = new FileService(fileRepository, env.UPLOAD_ROOT, env.UPLOAD_MAX_SIZE);
