import { loadAuthConfig } from './auth.config.js';

describe('authentication configuration', () => {
  const valid = {
    SUPABASE_URL: 'http://internal-auth:54321',
    SUPABASE_ANON_KEY: 'sb_publishable_test',
    SUPABASE_JWT_ISSUER: 'https://public.example.test/auth/v1',
    SUPABASE_JWT_AUDIENCE: 'authenticated',
    SUPABASE_JWT_ALGORITHM: 'ES256',
    DATABASE_URL: 'postgresql://unused:unused@localhost:1/unused',
    NODE_ENV: 'production',
  };
  it('keeps internal routing separate from the public issuer', () => {
    expect(loadAuthConfig(valid)).toMatchObject({
      url: valid.SUPABASE_URL,
      issuer: valid.SUPABASE_JWT_ISSUER,
      algorithm: 'ES256',
    });
  });
  it('fails closed for missing/unsafe server configuration without exposing values', () => {
    for (const name of Object.keys(valid).filter(
      (name) => name !== 'NODE_ENV',
    )) {
      expect(() => loadAuthConfig({ ...valid, [name]: '' })).toThrow();
    }
    for (const key of [
      'sb_secret_do-not-expose',
      `a.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.b`,
    ]) {
      expect(() =>
        loadAuthConfig({ ...valid, SUPABASE_ANON_KEY: key }),
      ).toThrow('SUPABASE_ANON_KEY must be public');
    }
    expect(() =>
      loadAuthConfig({ ...valid, SUPABASE_JWT_ALGORITHM: 'HS256' }),
    ).toThrow('SUPABASE_JWT_ALGORITHM');
    expect(() =>
      loadAuthConfig({ ...valid, SUPABASE_URL: 'https://secret@example.test' }),
    ).toThrow('Invalid configuration: SUPABASE_URL');
  });
});
