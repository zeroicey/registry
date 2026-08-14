import { sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { db } from '@/db/connection';
import { logger } from '@/shared/logger';
import { Msg } from '@/shared/messages';
import { Res } from '@/shared/response';

/**
 * Health probe. Deliberately catches DB failures: a health endpoint must
 * report "unavailable" (503) when a dependency is down — not a 500.
 */
export async function healthHandler(c: Context): Promise<Response> {
  try {
    await db.execute(sql`select 1`);
    return Res.ok(Msg.HEALTH_OK, {
      status: 'ok',
      database: 'up',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    }).build(c);
  } catch (err) {
    logger.error({ err }, 'Health check failed: database unreachable');
    return c.json(
      { success: false, message: Msg.SERVICE_UNAVAILABLE, code: 'SERVICE_UNAVAILABLE' },
      503,
    );
  }
}
