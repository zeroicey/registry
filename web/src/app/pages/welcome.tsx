import {
  ArrowRightIcon,
  BoxesIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  LayersIcon,
  RocketIcon,
  ShieldCheckIcon,
  TerminalIcon,
} from 'lucide-react';
import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { env } from '@/config/env';

const STACK = [
  {
    icon: LayersIcon,
    title: 'React 19 + Vite',
    description: 'TypeScript 严格模式，秒级冷启动与组件级 HMR。',
  },
  {
    icon: DatabaseIcon,
    title: 'TanStack Query v5 + ky',
    description: '服务端状态统一管理；HTTP 只经 src/api 单一出口。',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Zod 校验',
    description: '表单与 API 类型共享同一套 schema，契约即类型。',
  },
  {
    icon: RocketIcon,
    title: 'Tailwind 4 + shadcn',
    description: 'base-nova 风格组件（@base-ui/react），暗色模式开箱即用。',
  },
  {
    icon: BoxesIcon,
    title: 'React Router + Zustand',
    description: '路由集中声明；客户端 UI 状态按需拆分。',
  },
  {
    icon: CheckCircle2Icon,
    title: 'Vitest + Biome',
    description: '组件/工具测试与 lint/format 一体化，质量左移。',
  },
];

const STACK_DETAIL = [
  { name: 'React 19 / TypeScript（strict）', note: 'UI 与类型安全的基础' },
  { name: 'Vite + @vitejs/plugin-react + @tailwindcss/vite', note: '构建与开发服务器' },
  { name: 'react-router', note: '所有路由在 app/router.tsx 声明' },
  { name: '@tanstack/react-query v5 + ky', note: '服务端状态；api/client.ts 为唯一 HTTP 实例' },
  {
    name: 'react-hook-form + @hookform/resolvers + Zod',
    note: '表单与校验（features/*/schemas.ts）',
  },
  { name: 'Tailwind CSS 4 + shadcn（base-nova）+ @base-ui/react', note: '样式与基础组件' },
  { name: 'zustand', note: '仅客户端 UI 状态（如 stores/ui-store.ts）' },
  { name: 'sonner / next-themes / lucide-react / date-fns', note: '提示、主题、图标、日期' },
  { name: 'vitest + @testing-library/react + jsdom', note: '测试，用例与代码同目录放置' },
  { name: 'Biome', note: 'lint + format + import 排序' },
];

export function WelcomePage() {
  const [stackDialogOpen, setStackDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-16 py-8">
      {/* Hero */}
      <section className="flex flex-col items-center gap-4 text-center">
        <span className="rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">
          前端脚手架初始化完成 · 可直接在此基础上开发业务功能
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{env.VITE_APP_NAME}</h1>
        <p className="max-w-2xl text-muted-foreground">
          人员信息登记系统管理后台。后端为{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">api/</code> （Bun + Hono +
          Drizzle），本前端通过 <code className="rounded bg-muted px-1 py-0.5 text-xs">/api</code>{' '}
          代理与其通信。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a href="#quickstart" className={buttonVariants()}>
            快速开始
            <ArrowRightIcon className="size-4" />
          </a>
          <Dialog open={stackDialogOpen} onOpenChange={setStackDialogOpen}>
            <DialogTrigger
              render={<button type="button" className={buttonVariants({ variant: 'outline' })} />}
            >
              查看技术栈
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>技术栈</DialogTitle>
                <DialogDescription>本脚手架使用的全部依赖与职责。</DialogDescription>
              </DialogHeader>
              <ul className="flex flex-col gap-2.5">
                {STACK_DETAIL.map((item) => (
                  <li key={item.name} className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-right text-xs text-muted-foreground">{item.note}</span>
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <DialogClose
                  render={
                    <button type="button" className={buttonVariants({ variant: 'outline' })} />
                  }
                >
                  关闭
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {/* Stack cards */}
      <section aria-label="技术栈概览" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STACK.map((item) => (
          <div key={item.title} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
            <item.icon className="size-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-semibold">{item.title}</h2>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </section>

      {/* Quickstart */}
      <section id="quickstart" className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">快速开始</h2>
        <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-4 text-sm">
          <code>{`bun install
bun run dev          # http://localhost:5173（/api 代理到后端 :3000）
bun run build        # 类型检查 + 生产构建
bun run test         # vitest
bun run typecheck && bun run lint`}</code>
        </pre>
        <p className="text-sm text-muted-foreground">
          环境变量见 <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.example</code>；
          新增业务功能请遵循{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">src/features/README.md</code>{' '}
          的分层约定。
          <TerminalIcon className="ml-1 inline size-3.5" aria-hidden="true" />
        </p>
      </section>
    </div>
  );
}
