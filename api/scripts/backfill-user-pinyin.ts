#!/usr/bin/env bun
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '../src/db/schema';
import { toPinyinColumns } from '../src/modules/users/users.pinyin';

/**
 * 回填脚本：为存量 users 计算并写入 pinyin / pinyin_initial 派生列。
 *
 * 用法（在 api 目录下）：
 *   bun scripts/backfill-user-pinyin.ts
 *
 * 幂等：遍历全部 users（含软删除），逐条计算拼音；仅当当前值不一致时才
 * UPDATE，重复执行结果不变。迁移上线后由部署流程执行一次。
 *
 * 只依赖 DATABASE_URL —— 故意不 import @/env（完整 env 校验会因缺少
 * SESSION_SECRET 等而崩溃）。
 */

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('错误：缺少 DATABASE_URL 环境变量（脚本只依赖数据库连接）。');
  process.exit(1);
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema: { users } });

const rows = await db.select({ id: users.id, realName: users.realName }).from(users);

console.log(`共 ${rows.length} 名人员，开始计算拼音…`);

let updated = 0;
let unchanged = 0;

for (const [index, row] of rows.entries()) {
  const { pinyin, pinyinInitial } = toPinyinColumns(row.realName);
  const [current] = await db
    .select({ pinyin: users.pinyin, pinyinInitial: users.pinyinInitial })
    .from(users)
    .where(eq(users.id, row.id));

  if (current && current.pinyin === pinyin && current.pinyinInitial === pinyinInitial) {
    unchanged += 1;
  } else {
    await db.update(users).set({ pinyin, pinyinInitial }).where(eq(users.id, row.id));
    updated += 1;
  }

  if ((index + 1) % 100 === 0 || index + 1 === rows.length) {
    console.log(`进度：${index + 1}/${rows.length}`);
  }
}

if (rows.length === 0) {
  console.log('无存量人员，无需回填。');
} else {
  console.log(`回填完成：共处理 ${rows.length} 名，更新 ${updated} 条，未变化 ${unchanged} 条。`);
}

await client.end();