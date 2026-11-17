import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import ApplicationPage from './page';

const mocks = vi.hoisted(() => ({ load: vi.fn(), redirect: vi.fn() }));
vi.mock('../../../features/application/server/profile', () => ({
  loadApplicationProfile: mocks.load,
}));
vi.mock('../../../features/application/ui/logout-button', () => ({
  LogoutButton: () => <button>Logout</button>,
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
beforeEach(() => vi.resetAllMocks());

it('redirects unauthenticated requests without rendering protected content', async () => {
  mocks.load.mockResolvedValue({ kind: 'unauthenticated' });
  mocks.redirect.mockImplementation(() => {
    throw new Error('redirect');
  });
  await expect(ApplicationPage()).rejects.toThrow('redirect');
  expect(mocks.redirect).toHaveBeenCalledWith('/login?session=expired');
});
it('renders only the verified application profile and logout control', async () => {
  mocks.load.mockResolvedValue({
    kind: 'ready',
    profile: { id: 'synthetic-id', email: 'synthetic@example.test' },
  });
  const html = renderToStaticMarkup(
    <MantineProvider>{await ApplicationPage()}</MantineProvider>,
  );
  expect(html).toContain('synthetic@example.test');
  expect(html).toContain('synthetic-id');
  expect(html).toContain('Logout');
  expect(mocks.redirect).not.toHaveBeenCalled();
});
it('shows a bounded retry UI on API failure, not an automatic redirect loop', async () => {
  mocks.load.mockResolvedValue({
    kind: 'error',
    message: 'Unable to load your profile. Please try again.',
  });
  const html = renderToStaticMarkup(
    <MantineProvider>{await ApplicationPage()}</MantineProvider>,
  );
  expect(html).toContain('Try again');
  expect(html).toContain('Logout');
  expect(mocks.load).toHaveBeenCalledTimes(1);
  expect(mocks.redirect).not.toHaveBeenCalled();
});
