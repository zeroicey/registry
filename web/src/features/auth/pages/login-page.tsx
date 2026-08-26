import { FingerprintIcon } from 'lucide-react';
import { env } from '@/config/env';
import { Button } from '@/components/ui/button';
import { useOidcLogin } from '../queries';

/**
 * Login entry — a single button redirecting to the Pocket ID auth center
 * (Passkey verification happens there, not in this app).
 */
export function LoginPage() {
  const oidcLogin = useOidcLogin();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-sm">
        <img src="/logo.png" alt="" className="mx-auto size-16 dark:invert" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-semibold">{env.VITE_APP_NAME}</h1>
        <p className="mt-1 text-sm text-muted-foreground">私有系统 · 需通过认证中心登录</p>
        <Button
          className="mt-6 w-full"
          size="lg"
          disabled={oidcLogin.isPending}
          onClick={() => oidcLogin.mutate()}
        >
          <FingerprintIcon className="size-4" aria-hidden="true" />
          {oidcLogin.isPending ? '正在跳转…' : '通过认证中心登录'}
        </Button>
      </div>
    </div>
  );
}
