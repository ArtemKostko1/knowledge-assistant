import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadApplicationProfile } from './profile';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  user: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock('../../../lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getSession: mocks.session, getUser: mocks.user },
  }),
}));
const profile = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'synthetic@example.test',
  createdAt: '2026-11-16T00:00:00.000Z',
  updatedAt: '2026-11-16T00:00:00.000Z',
};
function response(status: number, body: unknown = profile) {
  return new Response(JSON.stringify(body), { status });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('API_INTERNAL_URL', 'http://api:3001');
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:3001');
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.session.mockResolvedValue({
    data: { session: { access_token: 'synthetic-access-token' } },
    error: null,
  });
  mocks.user.mockResolvedValue({
    data: { user: { id: profile.id } },
    error: null,
  });
  mocks.fetch.mockImplementation(async () => response(200));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('requires a session and does not call the product API without it', async () => {
  mocks.session.mockResolvedValue({ data: { session: null }, error: null });
  expect(await loadApplicationProfile()).toEqual({ kind: 'unauthenticated' });
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.user).not.toHaveBeenCalled();
});
it('validates the exact session token against Auth before bootstrap and me', async () => {
  expect(await loadApplicationProfile()).toEqual({ kind: 'ready', profile });
  expect(mocks.user).toHaveBeenCalledWith('synthetic-access-token');
  expect(mocks.fetch).toHaveBeenNthCalledWith(
    1,
    'http://api:3001/auth/bootstrap',
    expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-access-token' },
      cache: 'no-store',
      redirect: 'error',
    }),
  );
  expect(mocks.fetch.mock.calls[0]![1].body).toBeUndefined();
  expect(mocks.fetch).toHaveBeenNthCalledWith(
    2,
    'http://api:3001/auth/me',
    expect.objectContaining({
      method: 'GET',
      headers: { Authorization: 'Bearer synthetic-access-token' },
      cache: 'no-store',
      redirect: 'error',
    }),
  );
  expect(mocks.user.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.fetch.mock.invocationCallOrder[0]!,
  );
});
it('uses the Windows public address only when internal configuration is absent', async () => {
  vi.stubEnv('API_INTERNAL_URL', undefined);
  await loadApplicationProfile();
  expect(mocks.fetch.mock.calls[0]![0]).toBe(
    'http://127.0.0.1:3001/auth/bootstrap',
  );
});
it('does not fall back to public routing when an internal URL is invalid', async () => {
  vi.stubEnv('API_INTERNAL_URL', '');
  expect((await loadApplicationProfile()).kind).toBe('error');
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it('supports repeated bootstrap calls without inventing a different identity', async () => {
  const first = await loadApplicationProfile();
  const second = await loadApplicationProfile();
  expect(first).toEqual(second);
  expect(mocks.fetch).toHaveBeenCalledTimes(4);
  expect(
    mocks.fetch.mock.calls.filter(([url]) => url.endsWith('/auth/bootstrap')),
  ).toHaveLength(2);
});
it('rejects a session rejected by Supabase Auth', async () => {
  mocks.user.mockResolvedValue({
    data: { user: null },
    error: { status: 401 },
  });
  expect(await loadApplicationProfile()).toEqual({ kind: 'unauthenticated' });
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it('shows a safe error when Auth is temporarily unavailable', async () => {
  mocks.user.mockRejectedValue(new Error('secret-marker'));
  const result = await loadApplicationProfile();
  expect(result.kind).toBe('error');
  expect(JSON.stringify(result)).not.toContain('secret-marker');
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it.each(['bootstrap', 'profile'])(
  'handles product API 401 at %s without retrying',
  async (stage) => {
    if (stage === 'profile') mocks.fetch.mockResolvedValueOnce(response(200));
    mocks.fetch.mockResolvedValueOnce(response(401));
    expect(await loadApplicationProfile()).toEqual({ kind: 'unauthenticated' });
    expect(mocks.fetch).toHaveBeenCalledTimes(stage === 'bootstrap' ? 1 : 2);
  },
);
it.each(['bootstrap', 'profile'])(
  'handles network failure at %s without exposing errors or retrying',
  async (stage) => {
    if (stage === 'profile') mocks.fetch.mockResolvedValueOnce(response(200));
    mocks.fetch.mockRejectedValueOnce(new Error('secret-marker'));
    const result = await loadApplicationProfile();
    expect(result.kind).toBe('error');
    expect(JSON.stringify(result)).not.toContain('secret-marker');
    expect(mocks.fetch).toHaveBeenCalledTimes(stage === 'bootstrap' ? 1 : 2);
  },
);
it.each([403, 503])(
  'handles bootstrap HTTP %s without loading a profile',
  async (status) => {
    mocks.fetch.mockResolvedValueOnce(response(status));
    expect((await loadApplicationProfile()).kind).toBe('error');
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  },
);
it('handles profile errors', async () => {
  mocks.fetch
    .mockResolvedValueOnce(response(200))
    .mockResolvedValueOnce(response(500));
  expect((await loadApplicationProfile()).kind).toBe('error');
});
it('rejects invalid response contracts', async () => {
  mocks.fetch
    .mockResolvedValueOnce(response(200))
    .mockResolvedValueOnce(response(200, { id: profile.id }));
  expect((await loadApplicationProfile()).kind).toBe('error');
});
it('rejects a profile belonging to anyone other than the verified user', async () => {
  mocks.fetch
    .mockResolvedValueOnce(response(200))
    .mockResolvedValueOnce(response(200, { ...profile, id: 'other-user' }));
  expect((await loadApplicationProfile()).kind).toBe('error');
});
it('projects only profile fields, never access tokens or extra API fields', async () => {
  mocks.fetch
    .mockResolvedValueOnce(response(200))
    .mockResolvedValueOnce(
      response(200, { ...profile, access_token: 'must-not-serialize' }),
    );
  const result = await loadApplicationProfile();
  expect(result).toEqual({ kind: 'ready', profile });
  expect(JSON.stringify(result)).not.toContain('synthetic-access-token');
  expect(JSON.stringify(result)).not.toContain('must-not-serialize');
});
