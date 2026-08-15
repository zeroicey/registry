import { render, screen } from '@testing-library/react';
import { stubBackendFetch } from '@/test/helpers';
import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    stubBackendFetch();
  });

  it('redirects "/" to the user list through the full provider stack', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: '人员' })).toBeInTheDocument();
  });
});
