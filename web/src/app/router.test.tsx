import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './router';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
}

describe('router', () => {
  it('renders the welcome page at "/"', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('renders the not-found page for unknown paths', async () => {
    renderAt('/no-such-page');
    expect(await screen.findByText(/404/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回首页' })).toHaveAttribute('href', '/');
  });
});
