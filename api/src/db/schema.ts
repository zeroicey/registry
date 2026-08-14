import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Centralized schema — every table is defined here.
 * Naming: snake_case columns, drizzle infers camelCase-ish via explicit names.
 */

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('users_email_idx').on(table.email)],
);

export const todos = pgTable(
  'todos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Optional owner: the todos module works standalone; wire auth later.
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    completed: boolean('completed').default(false).notNull(),
    priority: integer('priority').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('todos_user_id_idx').on(table.userId),
    index('todos_completed_idx').on(table.completed),
    index('todos_created_at_idx').on(table.createdAt),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;
