import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Dark/light mode toggle. Uses next-themes; `resolvedTheme` resolves the
 * "system" preference to an actual theme so the icon always matches the
 * screen. `mounted` guards the client-only theme value on first render.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? '切换到亮色模式' : '切换到暗色模式'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {mounted && (isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />)}
    </Button>
  );
}
