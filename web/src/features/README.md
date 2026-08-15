# features/ — 业务功能模块（Feature-first）

每个业务域一个文件夹，所有相关代码**就近放在同一个目录**，禁止跨 feature 互相 import：

```
features/<name>/
├── index.ts        # re-export 公共入口
├── api.ts          # API 调用（ky + unwrap，只负责取数/提交）
├── queries.ts      # React Query 的 query key + useQuery/useMutation hooks
├── schemas.ts      # Zod schema（表单校验 + 请求/响应类型的唯一真相来源）
├── components/     # 本 feature 的组件
└── pages/          # 本 feature 的页面（挂载到 app/router.tsx）
```

## 分层规则（硬性）

1. **只有 `src/api/` 能碰网络**：`apiClient`（ky 实例）配置了
   `throwHttpErrors: false` + `credentials: 'include'`；`unwrap()` 解析统一响应
   `{ success, message, code?, data?, error? }` 并在失败时抛出 `ApiError`。
   feature 的 `api.ts` 永远看不到原始 `Response`。
2. **服务端状态只走 React Query**：`queries.ts` 导出 query key 与
   `useQuery`/`useMutation` hooks；mutation 成功后 invalidate 对应 key，
   失败用 `toDisplayError()` + sonner toast 提示。组件里禁止直接调 `api.ts`。
3. **校验以 Zod 为准**：`schemas.ts` 的 schema 同时用于 react-hook-form
   resolver 和 API 请求/响应类型（`z.infer`）。
4. **路由集中在 `app/router.tsx`**：feature 页面在那里挂载，未知路径回退
   not-found。
5. **状态三分**：服务端状态 → React Query；客户端 UI 状态（侧边栏/主题/弹窗
   开关）→ `stores/`（zustand）；一次性局部状态 → `useState`。
6. **样式**：只用 Tailwind 4 工具类 + `components/ui` 的 shadcn 组件，
   `cn()` 来自 `@/lib/utils`。不要写 per-component CSS。

## 最小示例（Todo 风格）

```ts
// features/<name>/schemas.ts
import { z } from 'zod';

export const createXSchema = z.object({ title: z.string().min(1).max(100) });
export type CreateXInput = z.infer<typeof createXSchema>;
export const xSchema = createXSchema.extend({ id: z.number().int() });
export type X = z.infer<typeof xSchema>;
```

```ts
// features/<name>/api.ts
import { apiClient, apiUrl } from '@/api/client';
import { unwrap } from '@/api/unwrap';
import type { X, CreateXInput } from './schemas';

export async function listXs(): Promise<X[]> {
  return unwrap(await apiClient.get(apiUrl('/xs')));
}

export async function createX(input: CreateXInput): Promise<X> {
  return unwrap(await apiClient.post(apiUrl('/xs'), { json: input }));
}
```

```ts
// features/<name>/queries.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toDisplayError } from '@/api/errors';
import * as api from './api';

export const xKeys = {
  all: ['xs'] as const,
  detail: (id: number) => [...xKeys.all, id] as const,
};

export function useXs() {
  return useQuery({ queryKey: xKeys.all, queryFn: api.listXs });
}

export function useCreateX() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createX,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: xKeys.all });
      toast.success('创建成功');
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}
```

```tsx
// features/<name>/pages/list-page.tsx —— 挂到 app/router.tsx
// const { data, isLoading, error } = useXs();  // 组件只调 hooks
```

## 约定

- `index.ts` 只 re-export 公开面（页面组件、hooks、类型），实现细节不外泄。
- 测试与代码同目录（`schemas.test.ts` / `*.test.tsx`）。
- 后端路由目前挂在根路径（如 `/health`），经 Vite 代理 `/api` 访问：
  `apiUrl('/health')` → dev 下 `http://localhost:5173/api/health` → 后端 `/health`。
