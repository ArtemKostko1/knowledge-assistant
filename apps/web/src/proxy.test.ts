import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy, config } from './proxy';
import { publicAuthRoutes } from './config/access-policy';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  claims: vi.fn(),
  config: vi.fn(),
  user: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({
    data: { user: { id: 'synthetic-user' } },
    error: null,
  });
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://local.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_fake');
  vi.stubEnv('SUPABASE_INTERNAL_URL', 'http://host.docker.internal:54321');
});
afterEach(() => vi.unstubAllEnvs());
vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookieOptions: { name: string };
      cookies: {
        setAll: (
          values: { name: string; value: string; options: { path: string } }[],
        ) => void;
      };
    },
  ) => {
    mocks.config(_url, options.cookieOptions.name);
    const refresh = () =>
      options.cookies.setAll([
        { name: 'synthetic-session', value: 'fake', options: { path: '/' } },
      ]);
    return {
      auth: {
        getUser: async () => {
          refresh();
          return mocks.user();
        },
        getClaims: async () => {
          mocks.claims();
          options.cookies.setAll([
            {
              name: 'synthetic-session',
              value: 'fake',
              options: { path: '/' },
            },
          ]);
          return { data: null, error: null };
        },
      },
    };
  },
}));

it.each(['/login', '/app'])(
  'passes refreshed cookies to %s request and response without redirecting',
  async (path) => {
    const request = new NextRequest(`http://local.test${path}`);
    const response = await proxy(request);
    expect(path === '/login' ? mocks.claims : mocks.user).toHaveBeenCalledTimes(
      1,
    );
    expect(mocks.config).toHaveBeenCalledWith(
      'http://host.docker.internal:54321',
      'sb-local-auth-token',
    );
    expect(request.cookies.get('synthetic-session')?.value).toBe('fake');
    expect(response.cookies.get('synthetic-session')?.value).toBe('fake');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('location')).toBeNull();
  },
);

it('falls back to the public URL without internal configuration', async () => {
  vi.stubEnv('SUPABASE_INTERNAL_URL', '');
  await proxy(new NextRequest('http://local.test/login'));
  expect(mocks.config).toHaveBeenCalledWith(
    'http://local.test',
    'sb-local-auth-token',
  );
});

it.each(['/auth/recovery', '/auth/confirm', '/update-password'])(
  'protects token-bearing route %s without session refresh',
  async (path) => {
    const response = await proxy(
      new NextRequest(
        `http://local.test${path}?token_hash=synthetic&next=https://evil.test`,
      ),
    );
    expect(mocks.claims).not.toHaveBeenCalled();
    expect(mocks.config).not.toHaveBeenCalled();
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('content-security-policy')).toContain(
      "default-src 'self'",
    );
    expect(response.headers.get('content-security-policy')).toContain(
      "connect-src 'self' http://local.test",
    );
    expect(response.headers.get('location')).toBeNull();
  },
);

it('allows the local HMR websocket in development CSP', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  const response = await proxy(
    new NextRequest('http://local.test/auth/recovery'),
  );
  expect(response.headers.get('content-security-policy')).toContain(
    "connect-src 'self' http://local.test ws://local.test",
  );
});

it.each([
  '/',
  '/app',
  '/app/settings',
  '/new-product-route',
  '/api/private',
  '/private/report.pdf',
  '/login/admin',
])(
  'denies anonymous direct access to %s, including routes outside protected groups',
  async (path) => {
    mocks.user.mockResolvedValue({ data: { user: null }, error: null });
    const response = await proxy(new NextRequest(`http://local.test${path}`));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://local.test/login');
    expect(response.cookies.get('synthetic-session')?.value).toBe('fake');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  },
);

it.each(publicAuthRoutes)(
  'keeps public authentication route %s available, including POST actions',
  async (path) => {
    mocks.user.mockResolvedValue({ data: { user: null }, error: null });
    for (const method of ['GET', 'POST']) {
      const response = await proxy(
        new NextRequest(`http://local.test${path}`, { method }),
      );
      expect(response.headers.get('location')).toBeNull();
      expect(response.status).toBe(200);
    }
    expect(mocks.user).not.toHaveBeenCalled();
  },
);

it('does not redirect a valid ordinary session away from recovery', async () => {
  const response = await proxy(
    new NextRequest('http://local.test/auth/recovery?token_hash=synthetic'),
  );
  expect(response.headers.get('location')).toBeNull();
  expect(mocks.user).not.toHaveBeenCalled();
  expect(mocks.claims).not.toHaveBeenCalled();
});

it.each([
  '/_next/static/chunks/app.js',
  '/_next/image',
  '/_next/webpack-hmr',
  '/favicon.ico',
])(
  'does not block framework asset %s or require Supabase configuration for it',
  async (path) => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', undefined);
    const response = await proxy(new NextRequest(`http://local.test${path}`));
    expect(response.headers.get('location')).toBeNull();
    expect(mocks.config).not.toHaveBeenCalled();
  },
);

it('never redirects an anonymous POST body into a login POST', async () => {
  mocks.user.mockResolvedValue({ data: { user: null }, error: null });
  const response = await proxy(
    new NextRequest('http://local.test/future-action', { method: 'POST' }),
  );
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('http://local.test/login');
});

it('lets the protected logout Server Action reach Next action handling', async () => {
  mocks.user.mockResolvedValue({ data: { user: null }, error: null });
  const response = await proxy(
    new NextRequest('http://local.test/app', {
      method: 'POST',
      headers: { 'Next-Action': 'synthetic-action-id' },
    }),
  );

  expect(response.headers.get('x-middleware-next')).toBe('1');
  expect(response.headers.get('location')).toBeNull();
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(mocks.user).not.toHaveBeenCalled();
});

it('still default-denies ordinary anonymous POSTs to the application', async () => {
  mocks.user.mockResolvedValue({ data: { user: null }, error: null });
  const response = await proxy(
    new NextRequest('http://local.test/app', { method: 'POST' }),
  );

  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('http://local.test/login');
  expect(mocks.user).toHaveBeenCalledTimes(1);
});

it('does not allow Server Action headers to bypass default-deny on unknown routes', async () => {
  mocks.user.mockResolvedValue({ data: { user: null }, error: null });
  const response = await proxy(
    new NextRequest('http://local.test/unknown', {
      method: 'POST',
      headers: { 'Next-Action': 'synthetic-action-id' },
    }),
  );

  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('http://local.test/login');
  expect(mocks.user).toHaveBeenCalledTimes(1);
});

it('rejects invalid sessions and permits the redirect destination without a loop', async () => {
  mocks.user.mockResolvedValue({
    data: { user: null },
    error: { status: 401 },
  });
  const denied = await proxy(new NextRequest('http://local.test/app'));
  expect(denied.headers.get('location')).toBe('http://local.test/login');
  const login = await proxy(new NextRequest(denied.headers.get('location')!));
  expect(login.headers.get('location')).toBeNull();
});

it('fails closed when the Auth request throws', async () => {
  mocks.user.mockRejectedValue(new Error('secret-marker'));
  const response = await proxy(
    new NextRequest('http://local.test/future-private'),
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('secret-marker');
});

it('keeps proxy matching all routes, not only the current application subtree', () => {
  expect(config.matcher).toEqual(['/:path*']);
});
