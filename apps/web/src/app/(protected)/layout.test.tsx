import { beforeEach, expect, it, vi } from 'vitest';
import ProtectedLayout from './layout';

const mocks = vi.hoisted(() => ({ session: vi.fn(), redirect: vi.fn() }));
vi.mock('../../features/auth/server/session', () => ({
  getVerifiedSession: mocks.session,
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.redirect.mockImplementation(() => {
    throw new Error('redirect');
  });
});
it('rejects anonymous access before rendering any protected children', async () => {
  mocks.session.mockResolvedValue({ kind: 'unauthenticated' });
  await expect(ProtectedLayout({ children: 'private-child' })).rejects.toThrow(
    'redirect',
  );
  expect(mocks.redirect).toHaveBeenCalledWith('/login');
});
it('renders children after a verified session without loading bootstrap in the layout', async () => {
  mocks.session.mockResolvedValue({
    kind: 'authenticated',
    userId: 'synthetic-user',
    accessToken: 'server-only-fake',
  });
  expect(await ProtectedLayout({ children: 'private-child' })).toBe(
    'private-child',
  );
  expect(mocks.session).toHaveBeenCalledTimes(1);
  expect(mocks.redirect).not.toHaveBeenCalled();
});
it('does not render protected children when Auth is unavailable', async () => {
  mocks.session.mockResolvedValue({
    kind: 'error',
    message: 'Authentication is unavailable.',
  });
  expect(await ProtectedLayout({ children: 'private-child' })).not.toBe(
    'private-child',
  );
  expect(mocks.redirect).not.toHaveBeenCalled();
});
