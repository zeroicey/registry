import { DatabaseIcon, FolderIcon, SlidersHorizontalIcon, UsersIcon } from 'lucide-react';
import { Link } from 'react-router';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { env } from '@/config/env';
import { LogoutButton } from '@/features/auth';
import { CollectionSelect } from '@/features/collections';
import { useMediaQuery } from '@/hooks/use-media-query';

const NAV_LINKS = [
  { to: '/users', label: '人员管理', icon: UsersIcon },
  { to: '/attributes', label: '属性配置', icon: SlidersHorizontalIcon },
  { to: '/source-files', label: '数据源', icon: DatabaseIcon },
  { to: '/collections', label: '名录', icon: FolderIcon },
] as const;

export function AppNavbar() {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-6">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 font-semibold"
            aria-label={env.VITE_APP_NAME}
          >
            <img src="/logo.png" alt="" className="size-6 dark:invert" aria-hidden="true" />
            <span className="hidden md:inline">{env.VITE_APP_NAME}</span>
          </Link>

          <nav aria-label="主导航" className="flex items-center gap-0.5">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              return isDesktop ? (
                <Link
                  key={link.to}
                  to={link.to}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              ) : (
                <Link
                  key={link.to}
                  to={link.to}
                  title={link.label}
                  aria-label={link.label}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Icon className="size-4" aria-hidden="true" />
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <CollectionSelect />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
