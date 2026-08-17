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
 * - `files` = user attachments backed by a local folder (UPLOAD_ROOT), a Docker
 *   volume in production — v1.1 附件能力，内网单用户、不引入 MinIO（见 .ai/decisions.md）。
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

/**
 * How a user row entered the system — written by the importer (a script run
 * by an external AI agent) or left as the default when a user is created by
 * hand. Manual = created through the UI/API; file = imported from a source
 * file (see user_source_files).
 */
export const sourceTypeEnum = pgEnum('source_type', ['manual', 'file']);
export type SourceType = (typeof sourceTypeEnum.enumValues)[number];

/** Lifecycle of a source file: uploaded but not yet imported, or imported. */
export const sourceFileStatusEnum = pgEnum('source_file_status', ['uploaded', 'imported']);
export type SourceFileStatus = (typeof sourceFileStatusEnum.enumValues)[number];

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
    /** Provenance: manual (UI/API) or file (imported from a source_file). */
    sourceType: sourceTypeEnum('source_type').notNull().default('manual'),
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

/** 名录（集合）：一类人员的领域实例（某校教师 / 某店客户 / 某企业员工 / 某校学生）。 */
export const collections = pgTable('collections', {
  id: bigint({ mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  /** Soft delete: NULL = active. */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * user ↔ collection 多对多：一个人员可同时属于多个名录（去重后跨名录复用身份），
 * 一个名录自然包含多个人。属性按名录隔离，故同一人的不同名录属性互不干扰。
 */
export const collectionMembers = pgTable(
  'collection_members',
  {
    collectionId: bigint('collection_id', { mode: 'number' })
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 加入该名录的时间。 */
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ name: 'collection_members_pk', columns: [table.collectionId, table.userId] }),
    // 「某个人员属于哪些名录」反向查询。
    index('collection_members_user_id_idx').on(table.userId),
  ],
);

/** 字段模板（表单设计器）：动态定义要收集的字段。 */
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
    /**
     * 归属名录：NULL = 全局共享属性（所有名录可见，如手机号/性别）；非空 = 名录专属属性。
     * key 在名录内唯一；全局属性 key 在全局内唯一。创建后不可迁移名录。
     */
    collectionId: bigint('collection_id', { mode: 'number' }).references(() => collections.id, {
      onDelete: 'cascade',
    }),
    /** Soft delete: NULL = active. Re-creating a key after delete is allowed. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 全局属性 key 唯一（collection_id IS NULL）：两个全局属性不能同 key。
    uniqueIndex('attributes_global_key_active_unique')
      .on(table.key)
      .where(sql`${table.collectionId} IS NULL AND ${table.deletedAt} IS NULL`),
    // 名录内 key 唯一（collection_id IS NOT NULL）：同 key 可在不同名录各自存在。
    uniqueIndex('attributes_collection_key_active_unique')
      .on(table.collectionId, table.key)
      .where(sql`${table.collectionId} IS NOT NULL AND ${table.deletedAt} IS NULL`),
    // 按名录列属性（列表/表单按 collection_id 过滤）。
    index('attributes_collection_id_idx').on(table.collectionId),
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

/** 用户附件：挂在一个登记对象（人员）名下的一组文件，不做内部再分类 */
export const files = pgTable(
  'files',
  {
    id: bigint({ mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 上传时的原始文件名。 */
    originalName: text('original_name').notNull(),
    /** 相对物理路径（objects/{mime-main}/{YYYY}/{MM}/{uuid}{ext}），不对外公开。 */
    storagePath: text('storage_path').notNull(),
    mimeType: text('mime_type').notNull(),
    /** 文件字节数。 */
    size: bigint({ mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('files_user_id_idx').on(table.userId)],
);

/**
 * 数据来源文件：一条人员数据「从哪个文件来」的溯源锚点。
 *
 * 独立于 files（用户附件）表 —— 附件挂在某个人员名下，来源文件是全局
 * 资源（一次导入一批人），语义与删除/权限都不同，不混用（见 .ai/decisions.md）。
 * 物理文件落在 UPLOAD_ROOT/source-files/（与 objects/ 平级，互不干扰）。
 */
export const sourceFiles = pgTable(
  'source_files',
  {
    id: bigint({ mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    /** 该来源文件导入到哪个名录（API 层强制必填；历史孤儿行可为空）。 */
    collectionId: bigint('collection_id', { mode: 'number' }).references(() => collections.id, {
      onDelete: 'cascade',
    }),
    /** 上传时的原始文件名。 */
    originalName: text('original_name').notNull(),
    /** 相对物理路径（source-files/{YYYY}/{MM}/{uuid}{ext}），不对外公开。 */
    storagePath: text('storage_path').notNull(),
    mimeType: text('mime_type').notNull(),
    /** 文件字节数。 */
    size: bigint({ mode: 'number' }).notNull(),
    /** uploaded = 已上传未导入；imported = 已由外部 AI 导入并完成溯源标记。 */
    status: sourceFileStatusEnum('status').notNull().default('uploaded'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('source_files_collection_id_idx').on(table.collectionId)],
);

/**
 * user ↔ source_file 多对多关联：一个用户可来自多个文件（重复导入合并时
 * 追加来源行），一个文件也自然对应多个用户。source_type='file' 时至少一行。
 */
export const userSourceFiles = pgTable(
  'user_source_files',
  {
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceFileId: bigint('source_file_id', { mode: 'number' })
      .notNull()
      .references(() => sourceFiles.id, { onDelete: 'cascade' }),
    /** 该来源行建立的时间（即导入时间）。 */
    importedAt: timestamp('imported_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ name: 'user_source_files_pk', columns: [table.userId, table.sourceFileId] }),
    index('user_source_files_source_file_id_idx').on(table.sourceFileId),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
export type CollectionMember = typeof collectionMembers.$inferSelect;
export type NewCollectionMember = typeof collectionMembers.$inferInsert;
export type Attribute = typeof attributes.$inferSelect;
export type NewAttribute = typeof attributes.$inferInsert;
export type AttributeValue = typeof attributeValues.$inferSelect;
export type NewAttributeValue = typeof attributeValues.$inferInsert;
export type AttributeValueHistory = typeof attributeValueHistory.$inferSelect;
export type NewAttributeValueHistory = typeof attributeValueHistory.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type FileRow = typeof files.$inferSelect;
export type NewFileRow = typeof files.$inferInsert;
export type SourceFileRow = typeof sourceFiles.$inferSelect;
export type NewSourceFileRow = typeof sourceFiles.$inferInsert;
export type UserSourceFileRow = typeof userSourceFiles.$inferSelect;
export type NewUserSourceFileRow = typeof userSourceFiles.$inferInsert;
