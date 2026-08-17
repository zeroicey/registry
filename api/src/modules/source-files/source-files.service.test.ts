import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SourceFileRow } from '@/db/schema';
import { AppError } from '@/shared/errors';
import { SOURCE_FILES_DIR } from '@/shared/storage';
import type { NewSourceFile, SourceFileRepository } from './source-files.repository';
import { SourceFileService } from './source-files.service';

const baseTime = Date.now();
const MAX_SIZE = 1024 * 1024; // 1 MiB for tests
const COLLECTION_ID = 1;

/** Fake collection existence check — keeps upload tests off the real DB. */
const fakeCollections = { findById: async () => ({ id: COLLECTION_ID }) };

// Each test gets its own temp storage root so physical files never leak
// between cases; afterEach removes every root created during the test.
const activeRoots: string[] = [];
function newRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'registry-source-files-'));
  activeRoots.push(root);
  return root;
}

afterEach(async () => {
  for (const root of activeRoots) {
    await rm(root, { recursive: true, force: true });
  }
  activeRoots.length = 0;
});

// ── in-memory fake repository — source-file tests run without a database ──
function makeFakeRepo() {
  const store = new Map<number, SourceFileRow>();
  let lastTick = 0;

  const repo: SourceFileRepository = {
    async insert(data: NewSourceFile) {
      const row: SourceFileRow = {
        id: store.size + 1,
        collectionId: data.collectionId,
        originalName: data.originalName,
        storagePath: data.storagePath,
        mimeType: data.mimeType,
        size: data.size,
        status: 'uploaded',
        createdAt: new Date(baseTime + ++lastTick),
      };
      store.set(row.id, row);
      return row;
    },
    async getById(id) {
      return store.get(id);
    },
    async list(options) {
      const all = [...store.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return {
        items: all.slice((options.page - 1) * options.pageSize, options.page * options.pageSize),
        total: all.length,
      };
    },
  };

  return { repo, store };
}

function newService(repo: SourceFileRepository, root: string): SourceFileService {
  return new SourceFileService(repo, root, MAX_SIZE, fakeCollections);
}

describe('SourceFileService', () => {
  test('upload returns a DTO and persists the bytes under source-files/', async () => {
    const { repo } = makeFakeRepo();
    const root = newRoot();
    const s = newService(repo, root);

    const payload = new TextEncoder().encode('a,b,c\n1,2,3\n');
    const dto = await s.upload(
      new File([payload], '数据.csv', { type: 'text/csv' }),
      COLLECTION_ID,
    );

    expect(dto.originalName).toBe('数据.csv');
    expect(dto.collectionId).toBe(COLLECTION_ID);
    expect(dto.mimeType).toBe('text/csv');
    expect(dto.size).toBe(payload.byteLength);
    expect(dto.status).toBe('uploaded');
    expect(typeof dto.createdAt).toBe('string');
    expect(dto).not.toHaveProperty('storagePath');

    const row = await repo.getById(dto.id);
    if (!row) throw new Error('inserted row missing from fake repo');
    const onDisk = await Bun.file(join(root, SOURCE_FILES_DIR, row.storagePath)).arrayBuffer();
    expect(new Uint8Array(onDisk)).toEqual(payload);
  });

  test('upload rejects a missing collection', async () => {
    const { repo } = makeFakeRepo();
    const s = new SourceFileService(repo, newRoot(), MAX_SIZE, {
      findById: async () => undefined,
    });
    const file = new File(['data'], 'a.csv', { type: 'text/csv' });
    await expect(s.upload(file, 999)).rejects.toMatchObject({ code: 'COLLECTION_NOT_FOUND' });
  });

  test('upload rejects oversized files before writing anything', async () => {
    const { repo, store } = makeFakeRepo();
    const s = newService(repo, newRoot());
    const big = new File([new Uint8Array(MAX_SIZE + 1)], 'big.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await expect(s.upload(big, COLLECTION_ID)).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(store.size).toBe(0);
  });

  test('upload rolls back the physical file when the DB insert fails', async () => {
    const failRepo: SourceFileRepository = {
      async insert() {
        throw new Error('db down');
      },
      async getById() {
        return undefined;
      },
      async list() {
        return { items: [], total: 0 };
      },
    };
    const root = newRoot();
    const s = newService(failRepo, root);

    await expect(
      s.upload(new File(['data'], 'a.csv', { type: 'text/csv' }), COLLECTION_ID),
    ).rejects.toThrow('db down');
    // The bytes saved before the failed insert must be rolled back (the empty
    // date sub-directories are left behind, same as the attachments module).
    const { readdir } = await import('node:fs/promises');
    async function collectFiles(dir: string): Promise<string[]> {
      const files: string[] = [];
      const entries = await readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const abs = join(dir, e.name);
        if (e.isDirectory()) files.push(...(await collectFiles(abs)));
        else if (e.isFile()) files.push(abs);
      }
      return files;
    }
    expect(await collectFiles(join(root, SOURCE_FILES_DIR))).toEqual([]);
  });

  test('getContent streams back the stored bytes with metadata', async () => {
    const { repo } = makeFakeRepo();
    const root = newRoot();
    const s = newService(repo, root);
    const payload = new TextEncoder().encode('hello source file');

    const dto = await s.upload(new File([payload], 'src.csv', { type: 'text/csv' }), COLLECTION_ID);
    const content = await s.getContent(dto.id);

    expect(content.mimeType).toBe('text/csv');
    expect(content.originalName).toBe('src.csv');
    expect(content.size).toBe(payload.byteLength);
    expect(await content.body.arrayBuffer()).toEqual(payload.buffer);
  });

  test('getContent throws SOURCE_FILE_NOT_FOUND for a missing id', async () => {
    const { repo } = makeFakeRepo();
    const s = newService(repo, newRoot());
    await expect(s.getContent(999)).rejects.toBeInstanceOf(AppError);
    await expect(s.getContent(999)).rejects.toMatchObject({ code: 'SOURCE_FILE_NOT_FOUND' });
  });

  test('list paginates by newest first', async () => {
    const { repo, store } = makeFakeRepo();
    const s = newService(repo, newRoot());
    for (let i = 0; i < 3; i += 1) {
      await s.upload(new File([`file-${i}`], `f${i}.csv`, { type: 'text/csv' }), COLLECTION_ID);
    }
    expect(store.size).toBe(3);

    const page = await s.list({ page: 1, pageSize: 2 });
    expect(page.total).toBe(3);
    expect(page.items).toHaveLength(2);
    expect(page.items[0]?.originalName).toBe('f2.csv');
  });
});
