import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  browser: vi.fn(),
  server: vi.fn(),
  getAll: vi.fn(() => []),
  set: vi.fn(),
}));
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: mocks.browser,
  createServerClient: mocks.server,
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: mocks.getAll, set: mocks.set }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://local.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_fake');
  vi.stubEnv('SUPABASE_INTERNAL_URL', 'http://host.docker.internal:54321');
});
afterEach(() => vi.unstubAllEnvs());

it('delegates browser storage to the SSR client', async () => {
  const { createClient } = await import('./browser');
  createClient();
  expect(mocks.browser).toHaveBeenCalledWith(
    'http://local.test',
    'sb_publishable_fake',
    { cookieOptions: { name: 'sb-local-auth-token' } },
  );
});

it('bridges Next cookies to the server client', async () => {
  const { createClient } = await import('./server');
  await createClient();
  const options = mocks.server.mock.calls[0]![2];
  expect(mocks.server.mock.calls[0]![0]).toBe(
    'http://host.docker.internal:54321',
  );
  expect(options.cookieOptions.name).toBe('sb-local-auth-token');
  expect(options.cookies.getAll()).toEqual([]);
  options.cookies.setAll([
    { name: 'synthetic-cookie', value: 'fake', options: { path: '/' } },
  ]);
  expect(mocks.set).toHaveBeenCalledWith('synthetic-cookie', 'fake', {
    path: '/',
  });
});

it('uses the public URL for Windows dev without an internal URL', async () => {
  vi.stubEnv('SUPABASE_INTERNAL_URL', '');
  const { createClient } = await import('./server');
  await createClient();
  expect(mocks.server.mock.calls[0]![0]).toBe('http://local.test');
  expect(mocks.server.mock.calls[0]![2].cookieOptions.name).toBe(
    'sb-local-auth-token',
  );
});
