# Registry 项目工作准则

> 本文件是项目的唯一 agent 配置源（原 `AGENTS.md` 已并入）。跨 agent 通用约定与 pi 行为准则统一放这里。

## 语言与沟通

- 用中文回复；代码、标识符、commit message、API 响应保持英文
- 展示文件路径用相对仓库根的路径（如 `api/src/modules/users/`），不要用绝对路径

## 项目背景

- Registry 是人员信息登记系统：`users`（人员）+ `attributes`（自定义属性）+ `comments`（留言）三模块，v1 后端已完成
- 后端 `api/`：Bun + Hono + Drizzle + postgres.js + Zod；前端 `web/`（React + Vite + shadcn）
- 从 Java Spring Boot 重写而来；旧版 SQL 仅作参考，schema 以 Drizzle 为唯一真相来源

## 仓库布局

- Git 仓库根是当前目录；Bun 后端在 `api/`（`package.json`、`commitlint.config.js`、`node_modules` 都在里面）
- **绝不 stage/commit**：`api/.env`、`api/dist/`、`node_modules/`、本地工具目录（`.ai`、`.omo`、`.codegraph`）；提交前先 `git status`

## Git 提交

- 提交受 Husky + commitlint 校验（规则在 `api/commitlint.config.js`）：Conventional Commits，英文小写 subject ≤ 72 字符，**body 必填**，单行 commit 会被拒
- body 写清楚改了什么、为什么，不要凑字数应付校验

## 项目记忆（.ai/）

- `.ai/`（仓库根）是项目工作记忆：开始工作前先读 `.ai/README.md`（规则 + 目录职责），再扫一眼最近的 `.ai/worklog/` 条目
- 近期记忆自动注入：`.pi/extensions/memory.ts` 每轮开始前把最近 worklog 主题 + 最新决策 + 未消化 inbox 摘要注入系统提示（只给钩子，细节 read 原文）；会话中写了新记忆，下一轮自动刷新
- 有实质产出的会话结束时：追加当日 `.ai/worklog/YYYY-MM-DD.md`（一天一个文件，`##` 按主题）
- 坑用 `⚠️` 标记；同一个坑踩第二次 → 升级到本文件（`.pi/APPEND_SYSTEM.md`）的已知陷阱区
- 决策（含否决/延期）追加进 `.ai/decisions.md`：一行一条，最新在上：日期、主题、决策、为什么
- 可复现流程写 `.ai/runbooks/`，worklog 只留一行指针
- `.ai/inbox/` 的片段消化进正式位置后删除

## 命令

- `cd api && bun install` — 装依赖（`prepare` 会重装 git hooks）
- `cd api && bun run dev` — dev server（bun --hot）；`bun test` — 测试
- `cd api && bun run typecheck` — 类型检查（`tsc --noEmit`）
- `cd api && echo "feat: add pagination" | bunx --no-install commitlint` — 校验 commit message

## 工程准则

- **改 schema / API 前先读 `.ai/decisions.md`**，遵循已定决策：软删除（`deleted_at` + 部分唯一索引）、按 `attributes.config` 动态生成 Zod 校验器、值变更与写入同事务留痕 `attribute_value_history`、属性类型有值时变更返回 409 `ATTRIBUTE_TYPE_LOCKED`
- **迁移只走 drizzle-kit**：`cd api && bun run db:generate`；触发器/函数等生成不了的部分用 `--custom` 补 SQL，不手工改库
- 新模块沿用 attributes/users/comments 的分层模式（routes → service → repository → schema + mappers），不要另起风格
- **守住 v1 范围**：attachments、范围/排序筛选、auth（changed_by 启用）均推迟到 v1.1，不要顺手实现
- 类型安全从严：项目开启 `exactOptionalPropertyTypes` / `noUncheckedIndexedAccess`，repository 层对 `rows[0]` 显式判空后抛 AppError，不用 `!` 非空断言（biome 也禁）
- 收尾验证：`cd api && bun test && bun run typecheck` 通过才可声明完成
- 改完代码冒烟时留意 bun --hot 崩溃态：curl 超时先 `kill` 重启 dev server，不要反复重试

## Web（web/）

- vite 代理 `/api` 默认 `http://localhost:3000`，本机端口冲突用 `VITE_PROXY_TARGET` 覆盖；生产用 `VITE_API_BASE_URL` 绝对地址
- UI 组件取自 shadcn base-nova registry 源码，按需适配别名/图标，不手写仿制
