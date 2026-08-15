import { lazy } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { AppLayout } from '@/app/layout/app-layout';

// Pages are code-split: each route loads its chunk on first visit. The layout
// wraps the <Outlet /> in <Suspense> with <PageLoading /> as fallback.
const WelcomePage = lazy(() =>
  import('@/app/pages/welcome').then((m) => ({ default: m.WelcomePage })),
);
const NotFoundPage = lazy(() =>
  import('@/app/pages/not-found').then((m) => ({ default: m.NotFoundPage })),
);
const AttributesPage = lazy(() =>
  import('@/features/attributes').then((m) => ({ default: m.AttributesPage })),
);

/** Route config — the single place where every route is declared. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <WelcomePage /> },
      { path: 'attributes', element: <AttributesPage /> },
      // Fallback: unknown paths render the not-found page inside the layout.
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
