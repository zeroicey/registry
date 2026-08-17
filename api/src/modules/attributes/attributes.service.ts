import { and, count, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db/connection';
import { type Attribute, attributes, attributeValues, type NewAttribute } from '@/db/schema';
import { AppError } from '@/shared/errors';
import { Msg } from '@/shared/messages';
import { toDbInsert, toDbUpdate, toDto } from './attributes.mappers';
import type {
  AttributeDto,
  CreateAttributeInput,
  ListAttributesQuery,
  PaginatedResult,
  UpdateAttributeInput,
} from './attributes.types';

/** Scope a list/creation targets: global (NULL) vs a specific collection. */
export type AttributeScope = 'all' | 'global' | 'collection';

/** Storage abstraction — swap the Drizzle implementation for tests or other stores. */
export interface AttributeRepository {
  insert(data: NewAttribute): Promise<Attribute>;
  /** Active only (deleted_at IS NULL). */
  findById(id: number): Promise<Attribute | undefined>;
  /**
   * Exact-scope key lookup: `collectionId === null` → global only (NULL);
   * otherwise the named collection only. Used for the create uniqueness check.
   */
  findByKeyInScope(key: string, collectionId: number | null): Promise<Attribute | undefined>;
  /** Any collection attribute (collection_id IS NOT NULL) with this key — global↔collection guard. */
  findCollectionKeyAnywhere(key: string): Promise<Attribute | undefined>;
  /**
   * Profile/filter resolution scope: global (NULL) ∪ one collection.
   * `collectionId === null` → global only; otherwise global ∪ that collection.
   */
  findByKeysInScope(keys: string[], collectionId: number | null): Promise<Attribute[]>;
  listActive(options: {
    page: number;
    pageSize: number;
    scope: AttributeScope;
    collectionId?: number;
  }): Promise<{ items: Attribute[]; total: number }>;
  update(id: number, data: Partial<NewAttribute>): Promise<Attribute | undefined>;
  softDelete(id: number): Promise<void>;
  /** How many user values reference this attribute (type-change guard). */
  countValues(attributeId: number): Promise<number>;
}

export class DrizzleAttributeRepository implements AttributeRepository {
  async insert(data: NewAttribute): Promise<Attribute> {
    const rows = await db.insert(attributes).values(data).returning();
    const row = rows[0];
    if (!row) throw new AppError('INTERNAL', Msg.INTERNAL_ERROR);
    return row;
  }

  async findById(id: number): Promise<Attribute | undefined> {
    const rows = await db
      .select()
      .from(attributes)
      .where(and(eq(attributes.id, id), isNull(attributes.deletedAt)))
      .limit(1);
    return rows[0];
  }

  async findByKeyInScope(key: string, collectionId: number | null): Promise<Attribute | undefined> {
    const scope =
      collectionId === null
        ? isNull(attributes.collectionId)
        : eq(attributes.collectionId, collectionId);
    const rows = await db
      .select()
      .from(attributes)
      .where(and(eq(attributes.key, key), scope, isNull(attributes.deletedAt)))
      .limit(1);
    return rows[0];
  }

  async findCollectionKeyAnywhere(key: string): Promise<Attribute | undefined> {
    const rows = await db
      .select()
      .from(attributes)
      .where(
        and(
          eq(attributes.key, key),
          isNotNull(attributes.collectionId),
          isNull(attributes.deletedAt),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async findByKeysInScope(keys: string[], collectionId: number | null): Promise<Attribute[]> {
    if (keys.length === 0) return [];
    const scope =
      collectionId === null
        ? isNull(attributes.collectionId)
        : or(isNull(attributes.collectionId), eq(attributes.collectionId, collectionId));
    return db
      .select()
      .from(attributes)
      .where(and(inArray(attributes.key, keys), scope, isNull(attributes.deletedAt)));
  }

  async listActive(options: {
    page: number;
    pageSize: number;
    scope: AttributeScope;
    collectionId?: number;
  }): Promise<{ items: Attribute[]; total: number }> {
    const conditions = [isNull(attributes.deletedAt)];
    if (options.scope === 'global') {
      conditions.push(isNull(attributes.collectionId));
    } else if (options.scope === 'collection') {
      if (options.collectionId === undefined) {
        throw new AppError('BAD_REQUEST', Msg.BAD_REQUEST, 400, {
          message: 'collectionId is required when scope=collection',
        });
      }
      const scopeCond = or(
        isNull(attributes.collectionId),
        eq(attributes.collectionId, options.collectionId),
      );
      if (scopeCond) conditions.push(scopeCond);
    }
    const where = and(...conditions);

    const [items, totalRows] = await Promise.all([
      db
        .select()
        .from(attributes)
        .where(where)
        // Form order: config.sortOrder ascending (missing → last), then id.
        .orderBy(
          sql`coalesce((${attributes.config}->>'sortOrder')::int, 2147483647)`,
          attributes.id,
        )
        .limit(options.pageSize)
        .offset((options.page - 1) * options.pageSize),
      db.select({ value: count() }).from(attributes).where(where),
    ]);
    return { items, total: totalRows[0]?.value ?? 0 };
  }

  async update(id: number, data: Partial<NewAttribute>): Promise<Attribute | undefined> {
    const rows = await db
      .update(attributes)
      .set(data)
      .where(and(eq(attributes.id, id), isNull(attributes.deletedAt)))
      .returning();
    return rows[0];
  }

  async softDelete(id: number): Promise<void> {
    await db
      .update(attributes)
      .set({ deletedAt: new Date() })
      .where(and(eq(attributes.id, id), isNull(attributes.deletedAt)));
  }

  async countValues(attributeId: number): Promise<number> {
    const rows = await db
      .select({ value: count() })
      .from(attributeValues)
      .where(eq(attributeValues.attributeId, attributeId));
    return rows[0]?.value ?? 0;
  }
}

export class AttributeService {
  constructor(private readonly repo: AttributeRepository) {}

  async list(query: ListAttributesQuery): Promise<PaginatedResult<AttributeDto>> {
    const { items, total } = await this.repo.listActive({
      page: query.page,
      pageSize: query.pageSize,
      scope: query.scope,
      ...(query.collectionId !== undefined ? { collectionId: query.collectionId } : {}),
    });
    return { items: items.map(toDto), total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: number): Promise<AttributeDto> {
    const attr = await this.repo.findById(id);
    if (!attr) throw new AppError('ATTRIBUTE_NOT_FOUND', Msg.ATTRIBUTE_NOT_FOUND);
    return toDto(attr);
  }

  async create(input: CreateAttributeInput): Promise<AttributeDto> {
    const collectionId = input.collectionId ?? null;
    const existing =
      collectionId === null
        ? ((await this.repo.findByKeyInScope(input.key, null)) ??
          (await this.repo.findCollectionKeyAnywhere(input.key)))
        : ((await this.repo.findByKeyInScope(input.key, collectionId)) ??
          (await this.repo.findByKeyInScope(input.key, null)));
    if (existing) throw new AppError('ATTRIBUTE_KEY_EXISTS', Msg.ATTRIBUTE_KEY_COLLISION);
    return toDto(await this.repo.insert(toDbInsert(input)));
  }

  async update(id: number, input: UpdateAttributeInput): Promise<AttributeDto> {
    const attr = await this.repo.findById(id);
    if (!attr) throw new AppError('ATTRIBUTE_NOT_FOUND', Msg.ATTRIBUTE_NOT_FOUND);

    // Type changes are locked once values exist — old values would silently
    // become invalid under the new type.
    if (input.type !== undefined && input.type !== attr.type) {
      const usedBy = await this.repo.countValues(id);
      if (usedBy > 0) throw new AppError('ATTRIBUTE_TYPE_LOCKED', Msg.ATTRIBUTE_TYPE_LOCKED);
    }

    const updated = await this.repo.update(id, toDbUpdate(input));
    if (!updated) throw new AppError('ATTRIBUTE_NOT_FOUND', Msg.ATTRIBUTE_NOT_FOUND);
    return toDto(updated);
  }

  async remove(id: number): Promise<void> {
    const attr = await this.repo.findById(id);
    if (!attr) throw new AppError('ATTRIBUTE_NOT_FOUND', Msg.ATTRIBUTE_NOT_FOUND);
    await this.repo.softDelete(id);
  }
}

export const attributeService = new AttributeService(new DrizzleAttributeRepository());
export const attributeRepository: AttributeRepository = new DrizzleAttributeRepository();
