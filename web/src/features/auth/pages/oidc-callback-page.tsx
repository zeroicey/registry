import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { PageLoading } from '@/app/layout/page-loading';
import { useOidcCallback } from '../queries';

/** SPA route that receives the auth-center redirect. */
export const OIDC_CALLBACK_PATH = '/auth/callback';

/**
 * OIDC callback landing page. Forwards the FULL redirect query string
 * (code/state/iss…) to the backend exactly once — the double-invoke guard
 * matters because React StrictMode mounts effects twice in dev and the
 * backend consumes every state single-use.
 */
export function OidcCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const oidcCallback = useOidcCallback();
  // StrictMode-safe: remember whether this mount already consumed the query.
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;
    consumedRef.current = true;

    const query = location.search;
    oidcCallback.mutate(query, {
      onSuccess: () => navigate('/', { replace: true }),
      onError: () => navigate('/login', { replace: true }),
    });
  }, [location.search, navigate, oidcCallback]);

  return <PageLoading />;
}
