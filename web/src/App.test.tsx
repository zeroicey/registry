import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the welcome page through the full provider stack', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
