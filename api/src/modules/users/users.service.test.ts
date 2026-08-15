import { describe, expect, test } from 'bun:test';
import type { Attribute, NewUser, User } from '@/db/schema';
import type { AttributeRepository } from '@/modules/attributes/attributes.service';
import type { ProfileRepository } from './profile.repository';
import type { UserRepository } from './users.repository';
import { UserService } from './users.service';
import type { ProfileEntry, AttributeFilter } from './users.types';

function makeUser(id: number, overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id,
    realName: '张三',
    code: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeAttribute(id: number, overrides: Partial<Attribute> = {}): Attribute {
  const now = new Date();
  return {
    id,
    key: 'age',
    label: '年龄',
    type: 'number',
    config: { min: 0, max: 150 },
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeFakes() {
  const usersStore = new Map<number, User>();
  const attrsStore = new Map<number, Attribute>();
  const attrByKey = new Map<string, Attribute>();
  attrsStore.set(1, makeAttribute(1, { key: 'age', type: 'number', config: { min: 0, max: 150 } }));
  attrsStore.set(
    2,
    makeAttribute(2, { key: 'gender', type: 'select', config: { options: ['男', '女'] } }),
  );
  attrsStore.set(3, makeAttribute(3, { key: 'active', type: 'bool' }));
  for (const a of attrsStore.values()) attrByKey.set(a.key, a);

  let nextId = 1;
  const createdUsers: NewUser[] = [];
  const createdEntries: ProfileEntry[][] = [];
  const patchedEntries: ProfileEntry[][] = [];
  const patchedUserIds: number[] = [];
  const softDeleted: number[] = [];

  const listFilters: AttributeFilter[][] = [];

  const users: UserRepository = {
    async insert(data) {
      const user = makeUser(nextId, { realName: data.realName, code: data.code ?? null });
      nextId += 1;
      usersStore.set(user.id, user);
      return user;
    },
    async createWithProfile(data, entries) {
      createdUsers.push(data);
      createdEntries.push(entries);
      const user = makeUser(nextId, { realName: data.realName, code: data.code ?? null });
      nextId += 1;
      usersStore.set(user.id, user);
      return user;
    },
    async findById(id) {
      const u = usersStore.get(id);
      return u && u.deletedAt === null ? u : undefined;
    },
    async update(id, data) {
      const u = usersStore.get(id);
      if (!u || u.deletedAt !== null) return undefined;
      const updated = {
        ...u,
        ...(data.realName !== undefined ? { realName: data.realName } : {}),
        ...(data.code !== undefined ? { code: data.code } : {}),
      };
      usersStore.set(id, updated);
      return updated;
    },
    async softDelete(id) {
      const u = usersStore.get(id);
      if (!u || u.deletedAt !== null) return false;
      softDeleted.push(id);
      usersStore.set(id, { ...u, deletedAt: new Date() });
      return true;
    },
    async list(options) {
      listFilters.push(options.attributeFilters ?? []);
      let items = [...usersStore.values()].filter((u) => u.deletedAt === null);
      if (options.search)
        items = items.filter(
          (u) => u.realName.includes(options.search!) || (u.code ?? '').includes(options.search!),
        );
      const total = items.length;
      return {
        items: items.slice((options.page - 1) * options.pageSize, options.page * options.pageSize),
        total,
      };
    },
  };

  const profiles: ProfileRepository = {
    async getAssembled() {
      return [];
    },
    async patchValues(userId, entries) {
      patchedUserIds.push(userId);
      patchedEntries.push(entries);
    },
  };

  const attributes: AttributeRepository = {
    async insert(data) {
      const attr = makeAttribute(nextId, {
        key: data.key,
        label: data.label,
        type: data.type,
        ...(data.config !== undefined ? { config: data.config } : {}),
      });
      nextId += 1;
      attrsStore.set(attr.id, attr);
      attrByKey.set(attr.key, attr);
      return attr;
    },
    async findById(id) {
      const a = attrsStore.get(id);
      return a && a.deletedAt === null ? a : undefined;
    },
    async findByKey(key) {
      const a = attrByKey.get(key);
      return a && a.deletedAt === null ? a : undefined;
    },
    async findByKeys(keys) {
      return [...attrsStore.values()].filter((a) => a.deletedAt === null && keys.includes(a.key));
    },
    async listActive({ page, pageSize }) {
      const items = [...attrsStore.values()].filter((a) => a.deletedAt === null);
      return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length };
    },
    async update(id, data) {
      const a = attrsStore.get(id);
      if (!a || a.deletedAt !== null) return undefined;
      const updated = {
        ...a,
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.config !== undefined ? { config: data.config } : {}),
      };
      attrsStore.set(id, updated);
      return updated;
    },
    async softDelete(id) {
      const a = attrsStore.get(id);
      if (a) attrsStore.set(id, { ...a, deletedAt: new Date() });
    },
    async countValues() {
      return 0;
    },
  };

  const service = new UserService(users, profiles, attributes);
  return {
    service,
    usersStore,
    createdUsers,
    createdEntries,
    patchedEntries,
    patchedUserIds,
    softDeleted,
    attrByKey,
    listFilters,
  };
}

describe('UserService', () => {
  test('create without profiles inserts the user with no entries', async () => {
    const { service, createdUsers, createdEntries } = makeFakes();
    const dto = await service.create({ realName: '李四' });
    expect(dto.realName).toBe('李四');
    expect(createdUsers[0]?.realName).toBe('李四');
    expect(createdEntries[0]).toEqual([]);
  });

  test('create validates profiles against attribute configs and passes entries', async () => {
    const { service, createdEntries } = makeFakes();
    const dto = await service.create({ realName: '张三', profiles: { age: 25, gender: '男' } });
    expect(dto.profile).toEqual({});
    expect(createdEntries[0]).toEqual([
      { attributeId: 1, value: 25 },
      { attributeId: 2, value: '男' },
    ]);
  });

  test('create rejects values that violate the attribute type', async () => {
    const { service, createdUsers } = makeFakes();
    await expect(
      service.create({ realName: '张三', profiles: { age: 'abc' } }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    expect(createdUsers).toHaveLength(0); // nothing persisted
  });

  test('create rejects values outside config bounds', async () => {
    const { service } = makeFakes();
    await expect(
      service.create({ realName: '张三', profiles: { age: 200 } }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  test('create rejects unknown attribute keys with details', async () => {
    const { service } = makeFakes();
    await expect(service.create({ realName: '张三', profiles: { nope: 1 } })).rejects.toMatchObject(
      {
        code: 'VALIDATION',
        details: { keys: ['nope'] },
      },
    );
  });

  test('get returns USER_NOT_FOUND for a soft-deleted user', async () => {
    const { service, usersStore } = makeFakes();
    usersStore.set(1, makeUser(1, { deletedAt: new Date() }));
    await expect(service.get(1)).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });

  test('patchProfile rejects unknown keys and never touches values', async () => {
    const { service, usersStore, patchedUserIds } = makeFakes();
    usersStore.set(1, makeUser(1));
    await expect(service.patchProfile(1, { profiles: { unknown: 1 } })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    expect(patchedUserIds).toHaveLength(0);
  });

  test('patchProfile upserts validated entries for a known user', async () => {
    const { service, usersStore, patchedUserIds, patchedEntries } = makeFakes();
    usersStore.set(1, makeUser(1));
    await service.patchProfile(1, { profiles: { age: 26 } });
    expect(patchedUserIds).toEqual([1]);
    expect(patchedEntries[0]).toEqual([{ attributeId: 1, value: 26 }]);
  });

  test('patchProfile returns USER_NOT_FOUND for missing users', async () => {
    const { service } = makeFakes();
    await expect(service.patchProfile(99, { profiles: { age: 1 } })).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });

  test('list resolves attribute filters and rejects unknown keys', async () => {
    const { service, listFilters } = makeFakes();
    const result = await service.list({ page: 1, pageSize: 20, gender: '男' });
    expect(result.total).toBe(0);
    // select filter stays a raw string
    expect(listFilters[0]).toEqual([{ attributeId: 2, value: '男' }]);

    await expect(service.list({ page: 1, pageSize: 20, bogus: 'x' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  test('list normalizes number and bool filter values to typed JSON', async () => {
    const { service, listFilters } = makeFakes();
    await service.list({ page: 1, pageSize: 20, age: '25', active: 'true' });
    expect(listFilters[0]).toEqual([
      { attributeId: 1, value: 25 }, // number: string → JSON number
      { attributeId: 3, value: true }, // bool: "true" → true
    ]);

    await service.list({ page: 1, pageSize: 20, active: 'false' });
    expect(listFilters[1]).toEqual([{ attributeId: 3, value: false }]);
  });

  test('list rejects malformed number and bool filter values', async () => {
    const { service } = makeFakes();
    await expect(service.list({ page: 1, pageSize: 20, age: 'abc' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(service.list({ page: 1, pageSize: 20, active: 'yes' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  test('remove soft-deletes the user', async () => {
    const { service, usersStore, softDeleted } = makeFakes();
    usersStore.set(1, makeUser(1));
    await service.remove(1);
    expect(softDeleted).toEqual([1]);
    expect(usersStore.get(1)?.deletedAt).not.toBeNull();
    await expect(service.remove(99)).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });
});
