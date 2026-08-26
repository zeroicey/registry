import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toDisplayError } from '@/api/errors';
import { fetchAuthStatus, fetchOidcAuthorizeUrl, postLogout, postOidcCallback } from './api';

// ---------------------------------------------------------------------------
// Auth hooks. `auth-status` is probed by AuthGuard on app load; login and
// logout invalidate it so the guard re-evaluates.
// ---------------------------------------------------------------------------

export const AUTH_STATUS_QUERY_KEY = ['auth-status'] as const;

export function useAuthStatus() {
  return useQuery({
    queryKey: AUTH_STATUS_QUERY_KEY,
    queryFn: fetchAuthStatus,
    // Logged-out IS a valid state here; never surface it as an error.
    retry: false,
    staleTime: 60_000,
  });
}

/** Redirect the browser to the auth center (full-page navigation). */
export function useOidcLogin() {
  return useMutation({
    mutationFn: async () => {
      const url = await fetchOidcAuthorizeUrl();
      window.location.assign(url);
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}

/** Complete the callback: forward the redirect query, then refresh status. */
export function useOidcCallback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (queryString: string) => postOidcCallback(queryString),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_STATUS_QUERY_KEY });
      toast.success('登录成功');
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postLogout,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_STATUS_QUERY_KEY });
      toast.success('已退出登录');
    },
    onError: (error) => toast.error(toDisplayError(error)),
  });
}
