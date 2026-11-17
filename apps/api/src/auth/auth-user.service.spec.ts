import { AuthUserService } from './auth-user.service.js';
import { AuthConfig } from './auth.config.js';
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
});
