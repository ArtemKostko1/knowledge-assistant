import { beforeEach, expect, it, vi } from 'vitest';
import Home from './page';

const mocks = vi.hoisted(() => ({ session: vi.fn(), redirect: vi.fn() }));
vi.mock('../features/auth/server/session', () => ({
  getVerifiedSession: mocks.session,
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.redirect.mockImplementation(() => {
    throw new Error('redirect');
  });
});

it.each([
  ['unauthenticated', '/login'],
  ['authenticated', '/app'],
])('redirects the root with verified session status %s', async (kind, path) => {
  mocks.session.mockResolvedValue({ kind });
  await expect(Home()).rejects.toThrow('redirect');
  expect(mocks.redirect).toHaveBeenCalledWith(path);
});
it('does not redirect to private content if authentication is unavailable', async () => {
  mocks.session.mockResolvedValue({
    kind: 'error',
    message: 'Authentication is unavailable.',
  });
  expect(await Home()).toBeTruthy();
  expect(mocks.redirect).not.toHaveBeenCalled();
});
