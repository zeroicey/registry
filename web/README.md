# registry-web

Registry（人员信息登记系统）前端管理后台。后端见仓库根目录的 `api/`（Bun + Hono + Drizzle）。

## 技术栈

React 19 · TypeScript（strict）· Vite · Tailwind CSS 4 · shadcn（base-nova，@base-ui/react）·
react-router · TanStack Query v5 · ky · react-hook-form + Zod · zustand · sonner · next-themes ·
date-fns · Vitest + Testing Library · Biome

## 快速开始

```bash
bun install
bun run dev        # http://localhost:5173，/api 代理到后端 :3000
```

> 后端未启动时页面仍可正常打开；只有调用真实接口的功能会报错。
> 后端默认监听 `0.0.0.0:3000`（`HOST`/`PORT` 可配），若端口不同，在 `web/.env` 里设
> `VITE_PROXY_TARGET=http://localhost:<port>`。

## 常用脚本

| 脚本                     | 说明                               |
| ------------------------ | ---------------------------------- |
| `bun run dev`            | 开发服务器（Vite，热更新）         |
| `bun run build`          | `tsc --noEmit` + 生产构建到 `dist/` |
| `bun run preview`        | 本地预览生产构建                   |
| `bun run typecheck`      | TypeScript 严格类型检查            |
| `bun run test`           | Vitest 单测（jsdom）               |
| `bun run lint`           | Biome check（lint + format + import 排序） |
| `bun run format`         | Biome format --write               |

## 环境变量

全部在 `src/config/env.ts` 用 Zod 声明与校验（`import.meta.env` 只允许在这一处读取），
示例见 [.env.example](.env.example)：

| 变量                 | 默认值               | 说明                                            |
| -------------------- | -------------------- | ----------------------------------------------- |
| `VITE_APP_NAME`      | `Registry`           | 导航栏 / 页脚 / 首页显示的应用名                 |
| `VITE_API_BASE_URL`  | `/api`               | 后端 API 基址；dev 用相对 `/api`（Vite 代理），生产构建用绝对 URL |
| `VITE_PROXY_TARGET`  | `http://localhost:3000` | 仅 dev：`/api` 代理的后端地址（vite.config.ts） |

## 目录结构

```
src/
├── main.tsx               # 入口：挂载 App + 全局样式
├── App.tsx                # 根组件：Providers + RouterProvider
├── api/                   # HTTP 唯一出口：client（ky）/ unwrap（统一响应）/ errors
├── app/                   # 应用级组合：router / providers / layout / pages
├── components/
│   ├── common/            # 跨 feature 共享的展示组件
│   └── ui/                # shadcn（base-nova）组件：button / input / dialog / sonner
├── config/env.ts          # Zod 校验后的环境变量（组件只从这里读）
├── features/              # 业务功能模块（详见 features/README.md）
├── hooks/                 # 共享 hooks
├── lib/                   # 工具（cn 等）
├── stores/                # zustand（仅客户端 UI 状态）
├── styles/globals.css     # Tailwind 4 全局样式（唯一 CSS 入口）
├── test/                  # vitest setup + 测试 helpers
└── types/                 # 跨模块共享类型
```

## 架构规则

1. **Feature-first**：业务 UI 全部在 `features/<name>/`（api / queries / schemas /
   components / pages 就近存放）；共享代码放 `components/common`、`hooks`、`lib`。
2. **单一 HTTP 层**：只有 `src/api/` 发请求。ky 配置 `throwHttpErrors: false` +
   `credentials: 'include'`；`unwrap()` 解析后端统一响应
   `{ success, message, code?, data?, error? }`，失败抛 `ApiError(message, status, detail, code)`。
   feature 的 api.ts 不接触原始 Response。
3. **服务端状态只走 React Query**：每个 feature 的 `queries.ts` 导出 query key 与 hooks；
   mutation 成功后 invalidate，失败用 `toDisplayError()` + sonner toast 提示。
4. **Zod 是唯一真相**：`schemas.ts` 同时服务 react-hook-form resolver 与 API 类型。
5. **路由集中声明**：全部在 `app/router.tsx`，未知路径回退 not-found 页。
6. **状态三分**：服务端 → React Query；客户端 UI（侧边栏/主题/弹窗）→ zustand；
   一次性局部状态 → useState。
7. **测试就近**：`*.test.ts(x)` 与代码同目录；共享 setup 在 `src/test/`。

## 与后端的契约

- 统一响应包（`api/src/shared/response.ts`）：`{ success, message, code?, data?, error? }`，
  `success`/`message` 必有，其余省略即无。
- 业务错误码示例：`BAD_REQUEST` / `UNAUTHORIZED` / `NOT_FOUND` / `CONFLICT` / `INTERNAL` 等。
- 后端路由挂根路径（如 `GET /health`），dev 下经 Vite 代理 `http://localhost:5173/api/*` → 后端 `/*`。

## 测试

```bash
bun run test            # 单次运行
bun run test:watch      # 监听模式
```

- 环境：jsdom；`src/test/setup.ts` 提供 matchMedia / ResizeObserver mock 与清理。
- `src/test/helpers.tsx` 提供 `renderWithProviders`（Query + Theme + MemoryRouter）。
