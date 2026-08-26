import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { PageLoading } from '@/app/layout/page-loading';
import { useAuthStatus } from '../queries';

/**
 * Route gate: probe the session once per app load. While loading keep the
 * current view quiet; when logged out send the user to /login remembering
 * where they came from.
 */
export function AuthGuard({ children }: { children?: ReactNode }) {
  const { data, isPending } = useAuthStatus();
  const location = useLocation();

  if (isPending) return <PageLoading />;
  if (!data?.authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children ?? <Outlet />;
}
