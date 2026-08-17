import { describe, expect, test } from 'bun:test';
import type { Attribute, NewAttribute } from '@/db/schema';
import { AppError } from '@/shared/errors';
import { type AttributeRepository, AttributeService } from './attributes.service';

function makeAttr(overrides: Partial<Attribute> = {}): Attribute {
  const now = new Date();
  return {
    id: 1,
    key: 'gender',
    label: '性别',
    type: 'select',
    config: { options: ['男', '女'] },
    collectionId: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeFakeRepo(): {
  repo: AttributeRepository;
  store: Map<number, Attribute>;
  created: NewAttribute[];
  deleted: number[];
  valuesCount: Map<number, number>;
} {
  const store = new Map<number, Attribute>();
  const created: NewAttribute[] = [];
  const deleted: number[] = [];
  const valuesCount = new Map<number, number>();

  const repo: AttributeRepository = {
    async insert(data) {
      created.push(data);
      const attr = makeAttr({
        id: store.size + 1,
        key: data.key,
        label: data.label,
        type: data.type,
        ...(data.config !== undefined ? { config: data.config } : {}),
        ...(data.collectionId !== undefined ? { collectionId: data.collectionId } : {}),
      });
      store.set(attr.id, attr);
      return attr;
    },
    async findById(id) {
      const attr = store.get(id);
      return attr && attr.deletedAt === null ? attr : undefined;
    },
    async findByKeyInScope(key, collectionId) {
      for (const attr of store.values()) {
        if (attr.key !== key || attr.deletedAt !== null) continue;
        if (
          collectionId === null ? attr.collectionId === null : attr.collectionId === collectionId
        ) {
          return attr;
        }
      }
      return undefined;
    },
    async findCollectionKeyAnywhere(key) {
      for (const attr of store.values()) {
        if (attr.key === key && attr.deletedAt === null && attr.collectionId !== null) return attr;
      }
      return undefined;
    },
    async findByKeysInScope(keys, collectionId) {
      return [...store.values()].filter(
        (a) =>
          a.deletedAt === null &&
          keys.includes(a.key) &&
          (collectionId === null
            ? a.collectionId === null
            : a.collectionId === null || a.collectionId === collectionId),
      );
    },
    async findByKeysForUser(keys) {
      return [...store.values()].filter(
        (a) => a.deletedAt === null && keys.includes(a.key) && a.collectionId === null,
      );
    },
    async findByKeysAnywhere(keys) {
      return [...store.values()].filter((a) => a.deletedAt === null && keys.includes(a.key));
    },
    async listActive({ page, pageSize, scope, collectionId }) {
      let items = [...store.values()].filter((a) => a.deletedAt === null);
      if (scope === 'global') {
        items = items.filter((a) => a.collectionId === null);
      } else if (scope === 'collection' && collectionId !== undefined) {
        items = items.filter((a) => a.collectionId === null || a.collectionId === collectionId);
      }
      return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length };
    },
    async update(id, data) {
      const attr = store.get(id);
      if (!attr || attr.deletedAt !== null) return undefined;
      const updated = {
        ...attr,
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.config !== undefined ? { config: data.config } : {}),
      };
      store.set(id, updated);
      return updated;
    },
    async softDelete(id) {
      deleted.push(id);
      const attr = store.get(id);
      if (attr) store.set(id, { ...attr, deletedAt: new Date() });
    },
    async countValues(attributeId) {
      return valuesCount.get(attributeId) ?? 0;
    },
  };

  return { repo, store, created, deleted, valuesCount };
}

describe('AttributeService', () => {
  test('create persists the attribute and returns its DTO', async () => {
    const { repo, created } = makeFakeRepo();
    const service = new AttributeService(repo);

    const dto = await service.create({
      key: 'age',
      label: '年龄',
      type: 'number',
      config: { min: 0 },
    });

    expect(dto.id).toBe(1);
    expect(dto.key).toBe('age');
    expect(created).toHaveLength(1);
  });

  test('create rejects a key already used by an active attribute', async () => {
    const { repo, store } = makeFakeRepo();
    store.set(1, makeAttr({ id: 1, key: 'gender' }));
    const service = new AttributeService(repo);

    await expect(
      service.create({ key: 'gender', label: '重复', type: 'string', config: {} }),
    ).rejects.toThrow(AppError);
  });

  test('get returns 404 for a soft-deleted attribute', async () => {
    const { repo, store } = makeFakeRepo();
    store.set(1, makeAttr({ id: 1, deletedAt: new Date() }));
    const service = new AttributeService(repo);

    await expect(service.get(1)).rejects.toMatchObject({ code: 'ATTRIBUTE_NOT_FOUND' });
  });

  test('type change is locked while values exist', async () => {
    const { repo, store, valuesCount } = makeFakeRepo();
    store.set(1, makeAttr({ id: 1, type: 'string' }));
    valuesCount.set(1, 3);
    const service = new AttributeService(repo);

    await expect(service.update(1, { type: 'number' })).rejects.toMatchObject({
      code: 'ATTRIBUTE_TYPE_LOCKED',
    });
  });

  test('label/config updates are allowed with values present', async () => {
    const { repo, store, valuesCount } = makeFakeRepo();
    store.set(1, makeAttr({ id: 1 }));
    valuesCount.set(1, 3);
    const service = new AttributeService(repo);

    const dto = await service.update(1, {
      label: '新标签',
      config: { options: ['男', '女', '未知'] },
    });
    expect(dto.label).toBe('新标签');
  });

  test('soft delete keeps the row but hides it from list/get', async () => {
    const { repo, store } = makeFakeRepo();
    store.set(1, makeAttr({ id: 1, key: 'gender' }));
    store.set(2, makeAttr({ id: 2, key: 'age', type: 'number' }));
    const service = new AttributeService(repo);

    await service.remove(1);
    expect(store.get(1)?.deletedAt).not.toBeNull();

    const list = await service.list({ page: 1, pageSize: 20, scope: 'all' });
    expect(list.total).toBe(1);
    expect(list.items[0]?.key).toBe('age');

    await expect(service.get(1)).rejects.toMatchObject({ code: 'ATTRIBUTE_NOT_FOUND' });
  });
});
