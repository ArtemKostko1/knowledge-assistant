import { beforeEach, expect, it, vi } from 'vitest';
import { logout } from './logout';
import { loadApplicationProfile } from '../server/profile';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  session: vi.fn(),
  user: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock('../../../lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      signOut: mocks.signOut,
      getSession: mocks.session,
      getUser: mocks.user,
    },
  }),
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({
    data: { user: { id: 'verified-user' } },
    error: null,
  });
});

it('signs out the local session then redirects to a fixed login URL', async () => {
  mocks.signOut.mockResolvedValue({ error: null });
  await logout();
  expect(mocks.user).toHaveBeenCalledTimes(1);
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(mocks.redirect).toHaveBeenCalledWith('/login?logout=success');
});

it('clears an already-missing session and redirects without failing', async () => {
  mocks.user.mockResolvedValue({
    data: { user: null },
    error: { status: 401 },
  });
  mocks.signOut.mockResolvedValue({ error: null });

  await logout();

  expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(mocks.redirect).toHaveBeenCalledWith('/login?logout=success');
});

it('does not sign out or claim success when Auth is unavailable', async () => {
  mocks.user.mockResolvedValue({
    data: { user: null },
    error: { status: 503 },
  });

  expect(await logout()).toEqual({
    error: 'Unable to sign out. Please try again.',
  });
  expect(mocks.signOut).not.toHaveBeenCalled();
  expect(mocks.redirect).not.toHaveBeenCalled();
});

it('denies access after logout removes the session', async () => {
  mocks.signOut.mockImplementation(async () => {
    mocks.session.mockResolvedValue({ data: { session: null }, error: null });
    mocks.user.mockResolvedValue({ data: { user: null }, error: null });
    return { error: null };
  });
  await logout();
  expect(await loadApplicationProfile()).toEqual({ kind: 'unauthenticated' });
  expect(mocks.user).toHaveBeenCalledTimes(1);
});
it.each(['returned', 'thrown'])(
  'handles logout failure (%s) without claiming success',
  async (kind) => {
    if (kind === 'returned')
      mocks.signOut.mockResolvedValue({ error: { message: 'secret-marker' } });
    else mocks.signOut.mockRejectedValue(new Error('secret-marker'));
    expect(await logout()).toEqual({
      error: 'Unable to sign out. Please try again.',
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  },
);
