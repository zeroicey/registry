import { LogOutIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useLogout } from '../queries';

/** Navbar logout — clears the session cookie, then lands on /login. */
export function LogoutButton() {
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={logout.isPending}
      title="退出登录"
      aria-label="退出登录"
      onClick={() =>
        logout.mutate(undefined, {
          onSuccess: () => navigate('/login', { replace: true }),
        })
      }
    >
      <LogOutIcon className="size-4" aria-hidden="true" />
    </Button>
  );
}
