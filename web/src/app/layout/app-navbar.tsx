import { Dialog } from '@base-ui/react/dialog';
import { BoxIcon, MenuIcon, XIcon } from 'lucide-react';
import { Link } from 'react-router';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { Button } from '@/components/ui/button';
import { env } from '@/config/env';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useUIStore } from '@/stores/ui-store';

const NAV_LINKS = [
  { to: '/users', label: '人员管理' },
  { to: '/attributes', label: '属性配置' },
  { to: '/source-files', label: '数据源' },
];

export function AppNavbar() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { mobileNavOpen, openMobileNav, closeMobileNav } = useUIStore();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <BoxIcon className="size-5" aria-hidden="true" />
            {env.VITE_APP_NAME}
          </Link>
          {isDesktop && (
            <nav aria-label="主导航" className="flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!isDesktop && (
            <Dialog.Root
              open={mobileNavOpen}
              onOpenChange={(open) => (open ? openMobileNav() : closeMobileNav())}
            >
              <Dialog.Trigger
                render={<Button variant="outline" size="icon" aria-label="打开导航菜单" />}
              >
                <MenuIcon className="size-4" />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
                <Dialog.Popup className="fixed left-0 top-0 z-50 flex h-dvh w-72 max-w-[80dvw] flex-col gap-4 border-r bg-popover p-4 text-popover-foreground duration-150 outline-none data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-left-full data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-left-full">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold">
                      <BoxIcon className="size-5" aria-hidden="true" />
                      {env.VITE_APP_NAME}
                    </span>
                    <Dialog.Close
                      render={<Button variant="ghost" size="icon" aria-label="关闭导航菜单" />}
                    >
                      <XIcon className="size-4" />
                    </Dialog.Close>
                  </div>
                  <nav aria-label="移动端导航" className="flex flex-col gap-1">
                    {NAV_LINKS.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        onClick={closeMobileNav}
                        className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          )}
        </div>
      </div>
    </header>
  );
}
