import { beforeEach, expect, it, vi } from 'vitest';
import {
  consumedRecoveryMessage,
  invalidRecoveryMessage,
  recoverPassword,
} from './recovery';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  verify: vi.fn(),
  update: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.create }));
vi.mock('./server-config', () => ({
  getServerSupabaseConfig: () => ({
    url: 'http://internal.test',
    key: 'sb_publishable_fake',
  }),
}));
const token = 'a'.repeat(64);
const password = 'synthetic-new-password';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockReturnValue({
    auth: {
      verifyOtp: mocks.verify,
      updateUser: mocks.update,
      signOut: mocks.signOut,
    },
  });
  mocks.verify.mockResolvedValue({
    data: {
      session: { user: { id: 'recovery-user' } },
      user: { id: 'recovery-user' },
    },
    error: null,
  });
  mocks.update.mockResolvedValue({
    data: { user: { id: 'recovery-user' } },
    error: null,
  });
  mocks.signOut.mockResolvedValue({ error: null });
});

it('verifies recovery before updating in an isolated, nonpersistent session', async () => {
  expect(await recoverPassword(token, password)).toEqual({ error: null });
  expect(mocks.create).toHaveBeenCalledWith(
    'http://internal.test',
    'sb_publishable_fake',
    expect.objectContaining({
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }),
  );
  expect(mocks.verify).toHaveBeenCalledWith({
    token_hash: token,
    type: 'recovery',
  });
  expect(mocks.update).toHaveBeenCalledWith({ password });
  expect(mocks.verify.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.update.mock.invocationCallOrder[0]!,
  );
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
});

it('rejects requests with no token even if the browser has a login session', async () => {
  expect((await recoverPassword(null, password)).error).toBe(
    invalidRecoveryMessage,
  );
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});

it.each(['invalid', 'expired', 'used'])(
  'rejects an %s token without updating a user',
  async (reason) => {
    mocks.verify.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: reason },
    });
    expect(await recoverPassword(token, password)).toEqual({
      error: invalidRecoveryMessage,
      requestNewLink: true,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  },
);

it('does not trust verify success without a matching recovery session', async () => {
  mocks.verify.mockResolvedValue({
    data: {
      user: { id: 'recovery-user' },
      session: { user: { id: 'other-user' } },
    },
    error: null,
  });
  expect((await recoverPassword(token, password)).error).toBe(
    invalidRecoveryMessage,
  );
  expect(mocks.update).not.toHaveBeenCalled();
});

it.each(['returned', 'thrown'])(
  'requires a new link after an update error (%s)',
  async (kind) => {
    if (kind === 'returned')
      mocks.update.mockResolvedValue({
        data: { user: null },
        error: { message: 'secret-marker' },
      });
    else mocks.update.mockRejectedValue(new Error('secret-marker'));
    expect(await recoverPassword(token, password)).toEqual({
      error: consumedRecoveryMessage,
      requestNewLink: true,
    });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  },
);

it('does not retry a consumed token', async () => {
  await recoverPassword(token, password);
  mocks.verify.mockResolvedValue({
    data: { session: null, user: null },
    error: { message: 'used' },
  });
  expect((await recoverPassword(token, password)).error).toBe(
    invalidRecoveryMessage,
  );
  expect(mocks.update).toHaveBeenCalledTimes(1);
});

it('validates password before consuming a token', async () => {
  expect((await recoverPassword(token, 'short')).error).toContain('8 and 128');
  expect(mocks.verify).not.toHaveBeenCalled();
});

it('returns safe errors for Auth transport failures', async () => {
  mocks.verify.mockRejectedValue(new Error('secret-marker'));
  expect(await recoverPassword(token, password)).toEqual({
    error: invalidRecoveryMessage,
    requestNewLink: true,
  });
  expect(mocks.update).not.toHaveBeenCalled();
});
