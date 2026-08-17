import { lazy } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppLayout } from '@/app/layout/app-layout';

// Pages are code-split: each route loads its chunk on first visit. The layout
// wraps the <Outlet /> in <Suspense> with <PageLoading /> as fallback.
const NotFoundPage = lazy(() =>
  import('@/app/pages/not-found').then((m) => ({ default: m.NotFoundPage })),
);
const AttributesPage = lazy(() =>
  import('@/features/attributes').then((m) => ({ default: m.AttributesPage })),
);
const UsersPage = lazy(() => import('@/features/users').then((m) => ({ default: m.UsersPage })));
const NewUserPage = lazy(() =>
  import('@/features/users').then((m) => ({ default: m.NewUserPage })),
);
const UserDetailPage = lazy(() =>
  import('@/features/users').then((m) => ({ default: m.UserDetailPage })),
);
const UserOverview = lazy(() =>
  import('@/features/users').then((m) => ({ default: m.UserOverview })),
);
const CommentsTab = lazy(() =>
  import('@/features/comments').then((m) => ({ default: m.CommentsTab })),
);
const UserFilesTab = lazy(() =>
  import('@/features/files/index').then((m) => ({ default: m.UserFilesTab })),
);

/** Route config — the single place where every route is declared. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      // Root redirects to the main scene (no auth wall in v1).
      { index: true, element: <Navigate to="/users" replace /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'users/new', element: <NewUserPage /> },
      {
        path: 'users/:id',
        element: <UserDetailPage />,
        children: [
          { index: true, element: <UserOverview /> },
          { path: 'files', element: <UserFilesTab /> },
          { path: 'comments', element: <CommentsTab /> },
        ],
      },
      { path: 'attributes', element: <AttributesPage /> },
      // Fallback: unknown paths render the not-found page inside the layout.
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
