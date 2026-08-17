import type { Dirent } from 'node:fs';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { logger } from '@/shared/logger';

/**
 * Local folder storage — the "object storage" for user attachments.
 *
 * Design (see .ai/decisions.md):
 * - All files live under `{UPLOAD_ROOT}/objects/`; unrelated files at the root
 *   (e.g. `.DS_Store`) are left alone.
 * - Relative paths are `{mime-main}/{YYYY}/{MM}/{uuid}{ext}` — the uuid makes
 *   them globally unique, the date mime directories keep the tree browsable.
 * - Reading streams via Bun.file (never loads the whole file into memory).
 * - Deleting is best-effort and ENOENT-tolerant (record may be gone already).
 */

/** Sub-directory that holds managed attachment objects. */
export const OBJECTS_DIR = 'objects';

/** Sub-directory that holds uploaded source files (import provenance). */
export const SOURCE_FILES_DIR = 'source-files';

function objectsRoot(root: string): string {
  return join(root, OBJECTS_DIR);
}

function sourceRoot(root: string): string {
  return join(root, SOURCE_FILES_DIR);
}

/** Resolve a relative storage path against a base, refusing traversal escapes. */
function safeJoin(base: string, relativePath: string): string {
  const baseAbs = resolve(base);
  const candidate = resolve(baseAbs, relativePath);
  const fromBase = relative(baseAbs, candidate);
  if (fromBase === '..' || fromBase.startsWith(`..${sep}`) || isAbsolute(fromBase)) {
    throw new Error(`非法存储路径: ${relativePath}`);
  }
  return candidate;
}

function managedPath(root: string, relativePath: string): string {
  return safeJoin(objectsRoot(root), relativePath);
}

function managedSourcePath(root: string, relativePath: string): string {
  return safeJoin(sourceRoot(root), relativePath);
}

/** Create the storage root (and objects/). Idempotent. */
export async function initStorageRoot(root: string): Promise<void> {
  await Promise.all([
    mkdir(objectsRoot(root), { recursive: true }),
    mkdir(sourceRoot(root), { recursive: true }),
  ]);
  logger.info(
    { root, objectsRoot: objectsRoot(root), sourceRoot: sourceRoot(root) },
    '存储根目录初始化完成',
  );
}

/**
 * Build a relative storage path for a new file:
 * `{mime-main-type}/{YYYY}/{MM}/{uuid}{ext}`.
 */
export function buildStoragePath(mimeType: string, id: string, originalName: string): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const mainType = mimeType.split('/')[0] ?? 'application';
  const ext = extname(originalName).slice(0, 32).toLowerCase();
  return join(mainType, year, month, `${id}${ext}`);
}

/**
 * Build a relative storage path for a new source file:
 * `{YYYY}/{MM}/{uuid}{ext}` (no mime sub-directory — source files are few and
 * browsable by date alone).
 */
export function buildSourceFilePath(id: string, originalName: string): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const ext = extname(originalName).slice(0, 32).toLowerCase();
  return join(year, month, `${id}${ext}`);
}

/** Write bytes to disk, creating parent directories as needed. */
export async function saveFile(
  root: string,
  relativePath: string,
  data: Uint8Array,
): Promise<void> {
  const abs = managedPath(root, relativePath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, data);
}

/** Write source-file bytes under {UPLOAD_ROOT}/source-files/. */
export async function saveSourceFile(
  root: string,
  relativePath: string,
  data: Uint8Array,
): Promise<void> {
  const abs = managedSourcePath(root, relativePath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, data);
}

/**
 * Open a file body without reading it fully into memory.
 * Throws an ENOENT error when the file is missing.
 */
export async function openFileFromStorage(
  root: string,
  relativePath: string,
): Promise<{ body: Blob; size: number }> {
  const body = Bun.file(managedPath(root, relativePath));
  if (!(await body.exists())) {
    const err = new Error(`文件不存在: ${relativePath}`) as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    throw err;
  }
  return { body, size: body.size };
}

/** Open a source file without reading it fully into memory. */
export async function openSourceFileFromStorage(
  root: string,
  relativePath: string,
): Promise<{ body: Blob; size: number }> {
  const body = Bun.file(managedSourcePath(root, relativePath));
  if (!(await body.exists())) {
    const err = new Error(`文件不存在: ${relativePath}`) as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    throw err;
  }
  return { body, size: body.size };
}

/** Delete a file, ignoring ENOENT (already gone). */
export async function deleteFileFromStorage(root: string, relativePath: string): Promise<void> {
  try {
    await unlink(managedPath(root, relativePath));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'ENOENT') throw err;
  }
}

/** Delete a source file, ignoring ENOENT (used for upload rollback). */
export async function deleteSourceFileFromStorage(
  root: string,
  relativePath: string,
): Promise<void> {
  try {
    await unlink(managedSourcePath(root, relativePath));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'ENOENT') throw err;
  }
}

/** List every managed file as a relative storage path (for orphan cleanup). */
export async function listStoragePaths(root: string): Promise<string[]> {
  const paths: string[] = [];
  const base = objectsRoot(root);

  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT') return;
      throw err;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile()) {
        paths.push(relative(base, abs));
      }
    }
  }

  await walk(base);
  return paths.sort((a, b) => a.localeCompare(b));
}
