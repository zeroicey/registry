import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';
import { env } from '@/env';

/** postgres.js pool — lazy connection, safe to import at startup. */
const client = postgres(env.DATABASE_URL, {
  max: env.DATABASE_POOL_SIZE,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, {
  schema,
  logger: env.DATABASE_LOGGING,
});
