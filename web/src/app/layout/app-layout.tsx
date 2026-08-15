import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { env } from '@/config/env';
import { AppNavbar } from './app-navbar';
import { PageLoading } from './page-loading';

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <AppNavbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {env.VITE_APP_NAME}
      </footer>
    </div>
  );
}
