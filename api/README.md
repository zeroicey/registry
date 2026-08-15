# registry — API

Production-ready TypeScript backend for the **registry** project.

**Stack**: Bun · Hono · PostgreSQL · Drizzle ORM · Zod · pino · Biome · Docker

## Quick start

Prerequisites: [Bun](https://bun.sh) ≥ 1.2, PostgreSQL (local, or a reachable instance).

```bash
bun install
cp .env.example .env        # set DATABASE_URL to your PostgreSQL
bun run db:migrate          # apply migrations to the database
bun run dev                 # start the dev server (hot reload)
```

`bun run dev` also works without `.env` in development — `DATABASE_URL` falls
back to `postgres://postgres:postgres@localhost:5432/registry`, and is only
**required** when `NODE_ENV=production`. The server starts without a database;
endpoints that touch the DB (and `/health`) will report errors until it is up.

## Scripts

| Script            | Description                                        |
| ----------------- | -------------------------------------------------- |
| `bun run dev`     | Dev server with hot reload (`src/index.ts`)        |
| `bun run build`   | Bundle to `dist/` (`bun build --target=bun`)       |
| `bun run start`   | Run the production bundle (`dist/index.js`)        |
| `bun run test`    | Run tests (Bun test runner)                        |
| `bun run typecheck` | TypeScript strict type check (`tsc --noEmit`)    |
| `bun run lint`    | Biome check                                        |
| `bun run format`  | Biome format --write                               |
| `bun run db:generate` | Generate a migration from `src/db/schema.ts`   |
| `bun run db:migrate`  | Apply pending migrations to `DATABASE_URL`     |

> `drizzle-kit` lives in `dependencies` (not dev) on purpose: the production
> image is built with `bun install --omit=dev`, and `db:migrate` must still be
> runnable inside the image at deploy time.

## Configuration

All configuration is environment variables (no dotenv — Bun loads `.env`
natively). See [.env.example](.env.example) for every variable and its default.

| Variable                | Default                                | Description                            |
| ----------------------- | -------------------------------------- | -------------------------------------- |
| `NODE_ENV`              | `development`                          | `development` \| `test` \| `production` |
| `HOST` / `PORT`         | `0.0.0.0` / `3000`                     | Listen address                         |
| `DATABASE_URL`          | *(dev fallback)*                       | PostgreSQL connection string (required in production) |
| `DATABASE_POOL_SIZE`    | `10`                                   | postgres.js pool size                  |
| `DATABASE_LOGGING`      | `false`                                | Drizzle SQL query logging              |
| `LOG_LEVEL`             | `info`                                 | pino level                             |
| `CORS_ORIGINS`          | `*`                                    | Comma-separated allowed origins        |
| `RATE_LIMIT_MAX`        | `100`                                  | Requests per window per client         |
| `RATE_LIMIT_WINDOW_MS`  | `60000`                                | Rate-limit window                      |
| `BODY_LIMIT_BYTES`      | `1048576` (1 MB)                       | Max request body                       |
| `REQUEST_TIMEOUT_MS`    | `30000`                                | Per-request timeout                    |

Security middleware chain (see `src/middleware/security.ts`): CORS → secure
headers → CSRF → rate limiter (MemoryStore) → body limit → timeout. When
`CORS_ORIGINS=*`, CSRF origin enforcement is skipped (any origin is trusted
anyway); set concrete origins to enable it.

## API

Base URL: `http://localhost:3000`

| Method | Path           | Description                          |
| ------ | -------------- | ------------------------------------ |
| GET    | `/health`      | Liveness probe (checks the DB)       |

> v1 模块（users / attributes / comments）开发中；领域 API 将挂在 `/users`、`/attributes` 等路由下。

### Unified response contract

Every response follows `{ success, message, code?, data?, error? }`:

- `success` + `message` are always present; `code` / `data` / `error` are
  **omitted** when unset (never `null`).
- HTTP status is the transport signal (`201` created, `404` not found, `409`
  conflict, `429` rate limited); `success` is the app-level signal; `code` is
  the business error identifier for programmatic handling.

```json
// 201 (example)
{ "success": true, "message": "Created successfully",
  "data": { "id": 1, "realName": "张三" } }

// 400 (invalid body)
{ "success": false, "message": "Validation failed", "code": "VALIDATION",
  "error": [ { "path": ["realName"], "message": "Required" } ] }

// 404 (unknown resource)
{ "success": false, "message": "Resource not found", "code": "NOT_FOUND" }
```

Error codes: `VALIDATION` (400) · `BAD_REQUEST` (400) · `UNAUTHORIZED` (401) ·
`FORBIDDEN` (403) · `NOT_FOUND` (404) · `CONFLICT` (409) ·
`REQUEST_TIMEOUT` (408) · `PAYLOAD_TOO_LARGE` (413) · `RATE_LIMITED` (429) ·
`SERVICE_UNAVAILABLE` (503) · `INTERNAL` (500) · module-specific codes as
they land (e.g. `ATTRIBUTE_NOT_FOUND`).

## Database

PostgreSQL schema is defined **only** in `src/db/schema.ts`; drizzle-kit
generates migrations (`bun run db:generate`) and applies them
(`bun run db:migrate`). Visual walkthrough (local-only, gitignored):
`.hunman/db-design.html`.

| Table | Purpose |
| ----- | ------- |
| `users` | 登记对象（人员）；`code` 为可空唯一业务编号 |
| `attributes` | 字段模板：`key`（业务 key，值表引用它）、`type`（string/number/bool/date/select）、`config` JSONB（required/options/min/max/regex/sortOrder…）；软删 = `deleted_at`，key 在未删记录间唯一 |
| `attribute_values` | 动态字段值，PK `(user_id, attribute_id)`，替代旧版 users.profiles JSONB blob |
| `attribute_value_history` | 变更留痕：同事务写 old/new，`changed_by` 预留（auth 后启用） |
| `comments` | 备注，挂在登记对象下 |

- 所有表由 DB 触发器 `update_updated_at_column()` 自动维护 `updated_at`（见 `drizzle/0001_*` 自定义迁移）。
- `attachments`（依赖 MinIO）推迟到 v1.1，暂不建表。

## Architecture

```
src/
├── index.ts            # entry: create app + start Bun.serve
├── app.ts              # global middleware (logging + security), onError, routers
├── env.ts              # typed env loading with Zod (fail-fast)
├── db/                 # Drizzle client + centralized schema (users, attributes, …)
├── middleware/         # security chain + pino-http request logging
├── shared/             # AppError, onError, validator, Res builder, Msg, logger
└── modules/            # one folder per domain (health; users/attributes/comments coming)
```

Rules: validation lives at the route layer via `validator.json/query/params`
(`ZodError` → `AppError(VALIDATION)`); handlers never parse manually and never
wrap in try/catch; `onError` maps `AppError`/`HTTPException`/`SyntaxError`/unknown
to the unified envelope (unknown errors are logged, stacks never leaked).

Module shape (per domain folder): `*.router.ts` (routes + zValidator, no
parsing in handlers) → `*.handler.ts` (thin: `c.req.valid(...)` → service →
response, no try/catch) → `*.service.ts` (business logic, throws `AppError`;
repository interface for test DI) → `*.schema.ts` (Zod) → `*.types.ts`
(inferred types + DTOs) → `*.mappers.ts` (DB ↔ domain) → `*.service.test.ts`.

## Docker

Build (behind a restricted network, pass proxy build-args for `bun install`):

```bash
docker build -t registry-api:latest . \
  --build-arg HTTP_PROXY=http://host.docker.internal:7897 \
  --build-arg HTTPS_PROXY=http://host.docker.internal:7897
```

Run:

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://user:pass@host:5432/registry \
  registry-api:latest
```

The image runs as non-root user `app` (UID 10001), timezone `Asia/Shanghai`,
with a `HEALTHCHECK` on `/health`. Migrations are **never** auto-run at
container start.

### Deploy flow

```bash
# 1. Build the image (above)
# 2. Apply migrations to the target database (dev deps not needed in the image)
docker run --rm \
  -e DATABASE_URL=postgres://user:pass@prod-host:5432/registry \
  registry-api:latest bun run db:migrate
# 3. Start the app — inject DATABASE_URL and all secrets as env vars
docker run -d -p 3000:3000 \
  -e DATABASE_URL=postgres://user:pass@prod-host:5432/registry \
  -e NODE_ENV=production \
  registry-api:latest
```

There is no entrypoint script and no docker-compose — all configuration is
environment variables injected at deploy time.

## Testing

`bun test` runs Bun's test runner with no database required: module tests use a
repository interface (`TodoRepository`-style) backed by an in-memory fake, so
the HTTP layer can swap in the real Drizzle implementation. The scaffold todo
tests were removed together with the scaffold; write module tests following
that pattern as modules land.
