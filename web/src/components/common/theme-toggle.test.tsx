import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/helpers';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  it('toggles the dark class on the document root', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);

    const button = screen.getByRole('button', { name: '切换到暗色模式' });
    expect(document.documentElement).not.toHaveClass('dark');

    await user.click(button);

    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
