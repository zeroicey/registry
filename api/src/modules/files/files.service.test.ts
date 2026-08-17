import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FileRow } from '@/db/schema';
import { AppError } from '@/shared/errors';
import { listStoragePaths, OBJECTS_DIR, saveFile } from '@/shared/storage';
import type { FileRepository, NewFile } from './files.repository';
import { FileService, normalizeMimeType } from './files.service';

const baseTime = Date.now();
const MAX_SIZE = 1024 * 1024; // 1 MiB for tests

// Each test gets its own temp storage root so physical files never leak
// between cases; afterEach removes every root created during the test.
const activeRoots: string[] = [];
function newRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'registry-files-'));
  activeRoots.push(root);
  return root;
}

afterEach(async () => {
  for (const root of activeRoots) {
    await rm(root, { recursive: true, force: true });
  }
  activeRoots.length = 0;
});

// ── in-memory fake repository — file tests run without a database ──
function makeFakeRepo() {
  const users = new Set<number>();
  const store = new Map<number, FileRow>();
  let lastTick = 0;

  const repo: FileRepository = {
    async userExists(userId) {
      return users.has(userId);
    },
    async insert(userId, data: NewFile) {
      const row: FileRow = {
        id: store.size + 1,
        userId,
        originalName: data.originalName,
        storagePath: data.storagePath,
        mimeType: data.mimeType,
        size: data.size,
        createdAt: new Date(baseTime + ++lastTick),
      };
      store.set(row.id, row);
      return row;
    },
    async getById(id) {
      return store.get(id);
    },
    async list(userId, options) {
      const all = [...store.values()]
        .filter((f) => f.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return {
        items: all.slice((options.page - 1) * options.pageSize, options.page * options.pageSize),
        total: all.length,
      };
    },
    async remove(id) {
      return store.delete(id);
    },
    async allStoragePaths() {
      return [...store.values()].map((f) => f.storagePath);
    },
  };

  return { repo, users, store };
}

describe('FileService', () => {
  test('upload returns a DTO for a known user and persists the bytes', async () => {
    const { repo, users } = makeFakeRepo();
    const root = newRoot();
    const s = new FileService(repo, root, MAX_SIZE);
    users.add(42);

    const payload = new TextEncoder().encode('hello file');
    const dto = await s.upload(42, new File([payload], 'a.txt', { type: 'text/plain' }));

    expect(dto.userId).toBe(42);
    expect(dto.originalName).toBe('a.txt');
    expect(dto.mimeType).toBe('text/plain');
    expect(dto.size).toBe(payload.byteLength);
    expect(typeof dto.createdAt).toBe('string');
    expect(dto).not.toHaveProperty('storagePath');

    // The physical file must exist under the managed objects dir.
    const row = await repo.getById(dto.id);
    if (!row) throw new Error('inserted row missing from fake repo');
    const onDisk = await Bun.file(join(root, OBJECTS_DIR, row.storagePath)).arrayBuffer();
    expect(new Uint8Array(onDisk)).toEqual(payload);
  });

  test('upload throws USER_NOT_FOUND when the user is missing', async () => {
    const { repo } = makeFakeRepo();
    const s = new FileService(repo, newRoot(), MAX_SIZE);
    const file = new File(['x'], 'x.txt', { type: 'text/plain' });
    await expect(s.upload(404, file)).rejects.toBeInstanceOf(AppError);
    await expect(s.upload(404, file)).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });

  test('upload rejects oversized files before writing anything', async () => {
    const { repo, users, store } = makeFakeRepo();
    const s = new FileService(repo, newRoot(), MAX_SIZE);
    users.add(7);
    const big = new File([new Uint8Array(MAX_SIZE + 1)], 'big.bin', {
      type: 'application/octet-stream',
    });
    await expect(s.upload(7, big)).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(store.size).toBe(0);
  });

  test('upload rolls back the physical file when the DB insert fails', async () => {
    const users = new Set<number>([9]);
    const failRepo: FileRepository = {
      async userExists(userId) {
        return users.has(userId);
      },
      async insert() {
        throw new Error('db down');
      },
      async getById() {
        return undefined;
      },
      async list() {
        return { items: [], total: 0 };
      },
      async remove() {
        return false;
      },
      async allStoragePaths() {
        return [];
      },
    };
    const root = newRoot();
    const s = new FileService(failRepo, root, MAX_SIZE);

    await expect(
      s.upload(9, new File(['data'], 'photo.png', { type: 'image/png' })),
    ).rejects.toThrow('db down');
    // The bytes saved before the failed insert must be rolled back, so the
    // managed objects dir holds no leftovers.
    expect(await listStoragePaths(root)).toEqual([]);
  });

  test('list returns paginated DTOs for a known user, newest first', async () => {
    const { repo, users } = makeFakeRepo();
    const s = new FileService(repo, newRoot(), MAX_SIZE);
    users.add(1);
    await s.upload(1, new File(['a'], 'a.txt', { type: 'text/plain' }));
    await s.upload(1, new File(['b b b'], 'b.pdf', { type: 'application/pdf' }));

    const result = await s.list(1, { page: 1, pageSize: 10 });
    expect(result.total).toBe(2);
    expect(result.items.map((f) => f.originalName)).toEqual(['b.pdf', 'a.txt']);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  test('list rejects missing users', async () => {
    const { repo } = makeFakeRepo();
    const s = new FileService(repo, newRoot(), MAX_SIZE);
    await expect(s.list(404, { page: 1, pageSize: 20 })).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });

  test('getContent streams the stored bytes with metadata', async () => {
    const { repo, users } = makeFakeRepo();
    const s = new FileService(repo, newRoot(), MAX_SIZE);
    users.add(5);
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    const dto = await s.upload(
      5,
      new File([payload], 'bin.dat', { type: 'application/octet-stream' }),
    );

    const content = await s.getContent(dto.id);
    expect(content.originalName).toBe('bin.dat');
    expect(content.size).toBe(5);
    expect(content.mimeType).toBe('application/octet-stream');
    expect(new Uint8Array(await content.body.arrayBuffer())).toEqual(payload);
  });

  test('getContent throws FILE_NOT_FOUND for missing records', async () => {
    const { repo } = makeFakeRepo();
    const s = new FileService(repo, newRoot(), MAX_SIZE);
    await expect(s.getContent(999)).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
  });

  test('remove deletes the record but keeps the physical file on disk', async () => {
    const { repo, users, store } = makeFakeRepo();
    const root = newRoot();
    const s = new FileService(repo, root, MAX_SIZE);
    users.add(3);
    const dto = await s.upload(3, new File(['keep me'], 'k.txt', { type: 'text/plain' }));
    const row = store.get(dto.id);
    if (!row) throw new Error('inserted row missing from fake repo');
    const physical = join(root, OBJECTS_DIR, row.storagePath);

    await s.remove(dto.id);
    expect(store.has(dto.id)).toBe(false);
    expect(await Bun.file(physical).exists()).toBe(true);
  });

  test('remove throws FILE_NOT_FOUND when the record is missing', async () => {
    const { repo } = makeFakeRepo();
    const s = new FileService(repo, newRoot(), MAX_SIZE);
    await expect(s.remove(999)).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
  });

  test('cleanupOrphanFiles deletes only unreferenced disk files', async () => {
    const { repo, users, store } = makeFakeRepo();
    const root = newRoot();
    const s = new FileService(repo, root, MAX_SIZE);
    users.add(11);
    const dto = await s.upload(11, new File(['ref'], 'ref.txt', { type: 'text/plain' }));
    await saveFile(root, 'other/2026/01/orphan.txt', new TextEncoder().encode('orphan'));
    const orphanPath = join(root, OBJECTS_DIR, 'other/2026/01/orphan.txt');

    const result = await s.cleanupOrphanFiles();
    expect(result.deleted).toEqual(['other/2026/01/orphan.txt']);
    expect(await Bun.file(orphanPath).exists()).toBe(false);

    const refRow = store.get(dto.id);
    if (!refRow) throw new Error('inserted row missing from fake repo');
    const referencedPath = join(root, OBJECTS_DIR, refRow.storagePath);
    expect(await Bun.file(referencedPath).exists()).toBe(true);
  });
});

describe('normalizeMimeType', () => {
  test('trusts plausible multipart-provided types', () => {
    expect(normalizeMimeType('image/png', 'x')).toBe('image/png');
    expect(normalizeMimeType('', 'x')).toBe('application/octet-stream');
  });

  test('falls back to the extension when the provided type is empty', () => {
    expect(normalizeMimeType('', 'report.pdf')).toBe('application/pdf');
    expect(normalizeMimeType('', 'data.xlsx')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });
});
