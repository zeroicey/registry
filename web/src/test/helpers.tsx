import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type RenderResult, render } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';
import type { ReactElement, ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

/** QueryClient for tests: no retries, deterministic failures. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

interface RenderWithProvidersOptions {
  /** Initial route(s) for components that use router hooks/links. */
  initialEntries?: string[];
}

/**
 * Render a component wrapped in the app's providers (query + theme + router).
 * The component is mounted as the "*" route of a memory router, so router
 * hooks and <Link> work out of the box.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderResult & { queryClient: QueryClient } {
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter([{ path: '*', element: ui }], {
    initialEntries: options.initialEntries ?? ['/'],
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light">
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return Object.assign(render(<RouterProvider router={router} />, { wrapper: Wrapper }), {
    queryClient,
  });
}
