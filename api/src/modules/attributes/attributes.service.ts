import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm';
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

/** Storage abstraction — swap the Drizzle implementation for tests or other stores. */
export interface AttributeRepository {
  insert(data: NewAttribute): Promise<Attribute>;
  /** Active only (deleted_at IS NULL). */
  findById(id: number): Promise<Attribute | undefined>;
  /** Active only, by business key. */
  findByKey(key: string): Promise<Attribute | undefined>;
  /** Active only, by business keys — used by the users module profile patch. */
  findByKeys(keys: string[]): Promise<Attribute[]>;
  listActive(options: {
    page: number;
    pageSize: number;
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

  async findByKey(key: string): Promise<Attribute | undefined> {
    const rows = await db
      .select()
      .from(attributes)
      .where(and(eq(attributes.key, key), isNull(attributes.deletedAt)))
      .limit(1);
    return rows[0];
  }

  async findByKeys(keys: string[]): Promise<Attribute[]> {
    if (keys.length === 0) return [];
    return db
      .select()
      .from(attributes)
      .where(and(inArray(attributes.key, keys), isNull(attributes.deletedAt)));
  }

  async listActive(options: {
    page: number;
    pageSize: number;
  }): Promise<{ items: Attribute[]; total: number }> {
    const where = isNull(attributes.deletedAt);
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
    const { items, total } = await this.repo.listActive(query);
    return { items: items.map(toDto), total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: number): Promise<AttributeDto> {
    const attr = await this.repo.findById(id);
    if (!attr) throw new AppError('ATTRIBUTE_NOT_FOUND', Msg.ATTRIBUTE_NOT_FOUND);
    return toDto(attr);
  }

  async create(input: CreateAttributeInput): Promise<AttributeDto> {
    const existing = await this.repo.findByKey(input.key);
    if (existing) throw new AppError('ATTRIBUTE_KEY_EXISTS', Msg.ATTRIBUTE_KEY_EXISTS);
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
