import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { stubBackendFetch } from '@/test/helpers';
import { routes } from './router';

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light">
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('router', () => {
  beforeEach(() => {
    stubBackendFetch();
  });

  it('redirects "/" to the user list', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: '人员' })).toBeInTheDocument();
  });

  it('renders the user detail page with 资料, 附件, and 留言 tabs', async () => {
    renderAt('/users/1');
    expect(await screen.findByRole('navigation', { name: '人员详情页签' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '编辑' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '资料' })).toHaveAttribute('href', '/users/1');
    expect(screen.getByRole('link', { name: '附件' })).toHaveAttribute('href', '/users/1/files');
    expect(screen.getByRole('link', { name: '留言' })).toHaveAttribute('href', '/users/1/comments');
  });

  it('renders files under the user detail tab', async () => {
    renderAt('/users/1/files');
    expect(await screen.findByRole('link', { name: '附件' })).toHaveAttribute(
      'href',
      '/users/1/files',
    );
  });

  it('renders comments under the user detail tab', async () => {
    renderAt('/users/1/comments');
    expect(await screen.findByRole('link', { name: '留言' })).toHaveAttribute(
      'href',
      '/users/1/comments',
    );
  });

  it('renders the not-found page for unknown paths', async () => {
    renderAt('/no-such-page');
    expect(await screen.findByText(/404/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回首页' })).toHaveAttribute('href', '/');
  });
});
