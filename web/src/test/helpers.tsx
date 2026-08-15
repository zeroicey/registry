import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type RenderResult, render } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';
import type { ReactElement, ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

/**
 * Stub `fetch` with the backend's unified envelope so page-level tests
 * (which mount components that call ky) never hit the network.
 * Returns an empty users list / empty attribute list / generic ok.
 */
export function stubBackendFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = urlOf(input);
    if (url.includes('/api/attributes')) {
      return jsonResponse({ items: [], total: 0, page: 1, pageSize: 100 });
    }
    if (url.includes('/api/users')) {
      return jsonResponse({ items: [], total: 0, page: 1, pageSize: 20 });
    }
    return jsonResponse(null);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Normalize a fetch input to its URL string (ky passes a Request object). */
function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, message: 'ok', data }),
  } as Response;
}

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
