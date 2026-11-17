import { beforeEach, expect, it, vi } from 'vitest';
import { getVerifiedSession } from './session';

const mocks = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('../../../lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getSession: mocks.session, getUser: mocks.user },
  }),
}));
beforeEach(() => vi.resetAllMocks());

it('does not accept cookie/session presence as proof of authorization', async () => {
  mocks.session.mockResolvedValue({
    data: {
      session: {
        access_token: 'synthetic-token',
        user: { id: 'untrusted-cookie-id' },
      },
    },
    error: null,
  });
  mocks.user.mockResolvedValue({
    data: { user: null },
    error: { status: 401 },
  });
  expect(await getVerifiedSession()).toEqual({ kind: 'unauthenticated' });
  expect(mocks.user).toHaveBeenCalledWith('synthetic-token');
});
it('uses only the identity verified by getUser for the exact credential', async () => {
  mocks.session.mockResolvedValue({
    data: {
      session: {
        access_token: 'synthetic-token',
        user: { id: 'untrusted-cookie-id' },
      },
    },
    error: null,
  });
  mocks.user.mockResolvedValue({
    data: { user: { id: 'verified-id' } },
    error: null,
  });
  expect(await getVerifiedSession()).toEqual({
    kind: 'authenticated',
    userId: 'verified-id',
    accessToken: 'synthetic-token',
  });
});
it('rejects missing sessions before attempting getUser', async () => {
  mocks.session.mockResolvedValue({ data: { session: null }, error: null });
  expect(await getVerifiedSession()).toEqual({ kind: 'unauthenticated' });
  expect(mocks.user).not.toHaveBeenCalled();
});
it.each([0, 503])(
  'does not authorize when session refresh fails with %s',
  async (status) => {
    mocks.session.mockResolvedValue({
      data: { session: null },
      error: { status },
    });
    expect((await getVerifiedSession()).kind).toBe('error');
    expect(mocks.user).not.toHaveBeenCalled();
  },
);
it('returns no sensitive exception detail on transport failure', async () => {
  mocks.session.mockRejectedValue(new Error('secret-marker'));
  const result = await getVerifiedSession();
  expect(result.kind).toBe('error');
  expect(JSON.stringify(result)).not.toContain('secret-marker');
});
