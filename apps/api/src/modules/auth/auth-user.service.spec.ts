import { AuthUserService } from './auth-user.service.js';
import { AuthConfig } from './config/auth.config.js';
const jestApi = (import.meta as ImportMeta & { jest: typeof jest }).jest;

describe('fresh Supabase Auth verification', () => {
  it('uses getUser with the public key and rejects mismatches/unconfirmed users', async () => {
    const id = 'a1234567-1234-4123-8123-123456789abc';
    const config = new AuthConfig(
      'http://auth.example.test',
      'sb_publishable_test',
      'http://issuer.example.test/auth/v1',
      'authenticated',
      'ES256',
      'unused',
    );
    const fetch = jestApi.spyOn(globalThis, 'fetch');
    try {
      const response = (user: object, status = 200) =>
        fetch.mockResolvedValueOnce(
          new Response(JSON.stringify(user), {
            status,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      const service = new AuthUserService(config);
      response({
        id,
        email: 'fresh@example.test',
        email_confirmed_at: '2026-01-01T00:00:00Z',
      });
      await expect(
        service.confirmedEmail({ id, token: 'checked-token' }),
      ).resolves.toBe('fresh@example.test');
      const [url, init] = fetch.mock.calls[0]!;
      expect(String(url)).toBe('http://auth.example.test/auth/v1/user');
      expect(new Headers(init?.headers).get('apikey')).toBe(config.anonKey);
      expect(new Headers(init?.headers).get('authorization')).toBe(
        'Bearer checked-token',
      );
      response({ id, email: 'fresh@example.test' });
      await expect(
        service.confirmedEmail({ id, token: 'checked-token' }),
      ).rejects.toMatchObject({ status: 403 });
      response({ id, email_confirmed_at: '2026-01-01' });
      await expect(
        service.confirmedEmail({ id, token: 'checked-token' }),
      ).rejects.toMatchObject({ status: 403 });
      response({
        id: 'b1234567-1234-4123-8123-123456789abc',
        email: 'fresh@example.test',
        email_confirmed_at: '2026-01-01',
      });
      await expect(
        service.confirmedEmail({ id, token: 'checked-token' }),
      ).rejects.toMatchObject({ status: 401 });
      response({ message: 'secret upstream detail' }, 401);
      await expect(
        service.confirmedEmail({ id, token: 'checked-token' }),
      ).rejects.toMatchObject({ status: 401, message: 'Invalid access token' });
      fetch.mockRejectedValueOnce(new Error('secret transport details'));
      await expect(
        service.confirmedEmail({ id, token: 'checked-token' }),
      ).rejects.toMatchObject({
        status: 503,
        message: 'Authentication service unavailable',
      });
    } finally {
      fetch.mockRestore();
    }
  });

  it.each([
    [
      'missing id',
      {
        id: undefined,
        email: 'user@example.test',
        email_confirmed_at: 'confirmed',
      },
      503,
    ],
    [
      'null id',
      { id: null, email: 'user@example.test', email_confirmed_at: 'confirmed' },
      503,
    ],
    [
      'empty id',
      { id: '', email: 'user@example.test', email_confirmed_at: 'confirmed' },
      503,
    ],
    [
      'numeric id',
      { id: 42, email: 'user@example.test', email_confirmed_at: 'confirmed' },
      503,
    ],
    [
      'mismatched id',
      {
        id: 'b1234567-1234-4123-8123-123456789abc',
        email: 'user@example.test',
        email_confirmed_at: 'confirmed',
      },
      401,
    ],
    ['missing email', { email_confirmed_at: 'confirmed' }, 403],
    ['null email', { email: null, email_confirmed_at: 'confirmed' }, 403],
    ['empty email', { email: '', email_confirmed_at: 'confirmed' }, 403],
    [
      'object email',
      { email: { marker: 'secret-upstream' }, email_confirmed_at: 'confirmed' },
      503,
    ],
    ['number email', { email: 42, email_confirmed_at: 'confirmed' }, 503],
    ['boolean email', { email: false, email_confirmed_at: 'confirmed' }, 503],
    ['missing confirmation', { email: 'user@example.test' }, 403],
    [
      'null confirmation',
      { email: 'user@example.test', email_confirmed_at: null },
      403,
    ],
    [
      'empty confirmation',
      { email: 'user@example.test', email_confirmed_at: '' },
      403,
    ],
    [
      'boolean confirmation',
      { email: 'user@example.test', email_confirmed_at: true },
      503,
    ],
    [
      'object confirmation',
      {
        email: 'user@example.test',
        email_confirmed_at: { marker: 'secret-upstream' },
      },
      503,
    ],
    [
      'number confirmation',
      { email: 'user@example.test', email_confirmed_at: 42 },
      503,
    ],
  ] as const)(
    'safely classifies %s in an upstream user',
    async (_name, fields, status) => {
      const id = 'a1234567-1234-4123-8123-123456789abc';
      const config = new AuthConfig(
        'http://auth.example.test',
        'sb_publishable_test',
        'http://issuer.example.test/auth/v1',
        'authenticated',
        'ES256',
        'unused',
      );
      const fetch = jestApi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ id, ...fields }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      try {
        const service = new AuthUserService(config);
        await expect(
          service.confirmedEmail({ id, token: 'checked-token' }),
        ).rejects.toMatchObject({
          status,
          message:
            status === 503
              ? 'Authentication service unavailable'
              : status === 401
                ? 'Invalid access token'
                : 'Confirmed email required',
        });
      } finally {
        fetch.mockRestore();
      }
    },
  );

  it.each(['timeout', 'upstream 5xx'])(
    'preserves safe 503 on %s',
    async (kind) => {
      const id = 'a1234567-1234-4123-8123-123456789abc';
      const config = new AuthConfig(
        'http://auth.example.test',
        'sb_publishable_test',
        'http://issuer.example.test/auth/v1',
        'authenticated',
        'ES256',
        'unused',
      );
      const fetch = jestApi.spyOn(globalThis, 'fetch');
      if (kind === 'timeout')
        fetch.mockRejectedValueOnce(
          new DOMException('secret-timeout', 'TimeoutError'),
        );
      else
        fetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ message: 'secret-upstream' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      try {
        await expect(
          new AuthUserService(config).confirmedEmail({
            id,
            token: 'checked-token',
          }),
        ).rejects.toMatchObject({
          status: 503,
          message: 'Authentication service unavailable',
        });
      } finally {
        fetch.mockRestore();
      }
    },
  );
});
