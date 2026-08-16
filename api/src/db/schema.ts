import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Centralized schema — every table is defined here (single source of truth,
 * drizzle-kit generates migrations from this file).
 *
 * Design decisions (see ../.ai/decisions.md, 2025-08-15):
 * - Attribute values live in a normalized `attribute_values` table instead of
 *   a JSONB blob on users: per-field upserts, indexed filtering, history.
 * - `attributes.config` carries validation/form rules (options,
 *   min/max, regex, sort_order, ...); app layer builds Zod validators from it.
 * - Soft delete = `deleted_at IS NOT NULL` + partial unique index on `key`.
 * - `attachments` is deferred to v1.1 (needs MinIO) — not defined here yet.
 */

/** Attribute value types. Extend here (e.g. add types) + in the enum migration. */
export const attributeTypeEnum = pgEnum('attribute_type', [
  'string',
  'number',
  'bool',
  'date',
  'select',
]);

export type AttributeType = (typeof attributeTypeEnum.enumValues)[number];

/** Validation & form rules for an attribute — validated by Zod at the app layer. */
export interface AttributeConfig {
  /** Form rendering order (ascending). */
  sortOrder?: number;
  /** Allowed values for `select` type. */
  options?: string[];
  /** Inclusive bounds for `number`. */
  min?: number;
  max?: number;
  /** Pattern for `string`. */
  regex?: string;
  /** Default value when the field is unset. */
  default?: unknown;
  /** Help text shown in the form. */
  help?: string;
}

/** 登记对象（人员） */
export const users = pgTable(
  'users',
  {
    id: bigint({ mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    realName: text('real_name').notNull(),
    /** National id — nullable, unique when set. */
    code: text('code'),
    /** Soft delete: NULL = active. Re-creating a code after delete is allowed. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Code is unique only among active users, so a soft-deleted code can be reused.
    uniqueIndex('users_code_active_unique').on(table.code).where(sql`${table.deletedAt} IS NULL`),
  ],
);

/** 字段模板（表单设计器）：动态定义要收集的字段 */
export const attributes = pgTable(
  'attributes',
  {
    id: bigint({ mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    /** Stable business key — `attribute_values` reference this, not the id. */
    key: text('key').notNull(),
    label: text('label').notNull(),
    type: attributeTypeEnum('type').notNull(),
    /** Validation/form rules, e.g. { options, min, max, sortOrder, regex }. */
    config: jsonb('config').$type<AttributeConfig>().notNull().default({}),
    /** Soft delete: NULL = active. Re-creating a key after delete is allowed. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Key is unique only among active attributes, so a soft-deleted key can be reused.
    uniqueIndex('attributes_key_active_unique')
      .on(table.key)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

/** 动态字段值：每 (user, attribute) 一行，替代旧版 users.profiles JSONB blob */
export const attributeValues = pgTable(
  'attribute_values',
  {
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    attributeId: bigint('attribute_id', { mode: 'number' })
      .notNull()
      .references(() => attributes.id, { onDelete: 'cascade' }),
    /** JSON value; type is defined by attributes.type and validated at the app layer. */
    value: jsonb('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ name: 'attribute_values_pk', columns: [table.userId, table.attributeId] }),
    // Filter users by attribute value (list endpoint scans by attribute_id).
    index('attribute_values_attribute_id_idx').on(table.attributeId),
  ],
);

/** 变更留痕：与写入同一事务记录 old/new */
export const attributeValueHistory = pgTable(
  'attribute_value_history',
  {
    id: bigint({ mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    attributeId: bigint('attribute_id', { mode: 'number' })
      .notNull()
      .references(() => attributes.id, { onDelete: 'cascade' }),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value').notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
    /** Operator id — reserved; no FK until auth lands. */
    changedBy: bigint('changed_by', { mode: 'number' }),
  },
  (table) => [index('attribute_value_history_user_id_idx').on(table.userId)],
);

/** 备注（挂在登记对象下） */
export const comments = pgTable(
  'comments',
  {
    id: bigint({ mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    /** Operator id — reserved; no FK until auth lands. */
    createdBy: bigint('created_by', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('comments_user_id_idx').on(table.userId)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Attribute = typeof attributes.$inferSelect;
export type NewAttribute = typeof attributes.$inferInsert;
export type AttributeValue = typeof attributeValues.$inferSelect;
export type NewAttributeValue = typeof attributeValues.$inferInsert;
export type AttributeValueHistory = typeof attributeValueHistory.$inferSelect;
export type NewAttributeValueHistory = typeof attributeValueHistory.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
