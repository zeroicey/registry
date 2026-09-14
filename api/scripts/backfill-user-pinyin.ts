#!/usr/bin/env bun
import postgres from 'postgres';
import { toPinyinColumns } from '../src/modules/users/users.pinyin';

/**
 * 回填脚本：为存量 users 计算并写入 pinyin / pinyin_initial 派生列。
 *
 * 用法（在 api 目录下，需 DATABASE_URL 指向目标库）：
 *   bun scripts/backfill-user-pinyin.ts
 *
 * 幂等：无条件重算全量姓名拼音，但 UPDATE 带 `IS DISTINCT FROM` 条件，
 * 只写值变化的行 —— 首次回填写全部，重复执行零写入，结果一致。
 *
 * 批量：一次性 SELECT 全量后按块 unnest UPDATE（每块 2000 行），避免
 * 逐条往返在跨隧道/远程库上的延迟。
 *
 * 保护 updated_at：users 表在 0001 迁移有 BEFORE UPDATE 触发器
 * （update_users_modtime）会强制 NEW.updated_at = NOW()。回填是派生列维护，
 * 不该污染修改时间 —— 临时禁用该触发器，finally 中恢复。
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

// 禁用触发器需 users 表 owner 权限（迁移由 registry 用户执行，故为 owner）。
await client`ALTER TABLE users DISABLE TRIGGER update_users_modtime`;

try {
  type UserRow = { id: string; realName: string };
  const rows = await client<UserRow[]>`SELECT id, real_name AS "realName" FROM users`;

  if (rows.length === 0) {
    console.log('无存量人员，无需回填。');
  } else {
    console.log(`共 ${rows.length} 名人员，开始计算拼音…`);

    const CHUNK = 2000;
    const total = rows.length;
    for (let i = 0; i < total; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const ids = slice.map((r) => Number(r.id));
      const pinyin = slice.map((r) => toPinyinColumns(r.realName).pinyin);
      const pinyinInitial = slice.map((r) => toPinyinColumns(r.realName).pinyinInitial);
      await client`
        UPDATE users u
        SET pinyin = d.pinyin, pinyin_initial = d.pinyin_initial
        FROM unnest(
          ${ids}::bigint[],
          ${pinyin}::text[],
          ${pinyinInitial}::text[]
        ) AS d(id, pinyin, pinyin_initial)
        WHERE u.id = d.id
          AND (u.pinyin IS DISTINCT FROM d.pinyin OR u.pinyin_initial IS DISTINCT FROM d.pinyin_initial)
      `;
      console.log(`进度：${Math.min(i + CHUNK, total)}/${total}`);
    }

    console.log(`回填完成：共处理 ${total} 名。`);
  }
} finally {
  await client`ALTER TABLE users ENABLE TRIGGER update_users_modtime`;
  await client.end();
}