import { afterEach, expect, it, vi } from 'vitest';
import { getSupabaseConfig } from './config';
import { getServerSupabaseConfig } from './server-config';

vi.mock('server-only', () => ({}));

afterEach(() => vi.unstubAllEnvs());
it('accepts public publishable configuration', () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_synthetic');
  expect(getSupabaseConfig().key).toBe('sb_publishable_synthetic');
});
it.each([
  'sb_secret_synthetic',
  'a.' + btoa(JSON.stringify({ role: 'service_role' })) + '.c',
])('rejects non-public keys', (key) => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', key);
  expect(() => getSupabaseConfig()).toThrow('Supabase key must be public');
  expect(() => getServerSupabaseConfig()).toThrow(
    'Supabase key must be public',
  );
});

it('keeps the public cookie identity when internal routing differs', () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_synthetic');
  vi.stubEnv('SUPABASE_INTERNAL_URL', 'http://host.docker.internal:54321');
  expect(getSupabaseConfig().url).toBe('http://127.0.0.1:54321');
  expect(getServerSupabaseConfig().url).toBe(
    'http://host.docker.internal:54321',
  );
  expect(getSupabaseConfig().cookieName).toBe('sb-127-auth-token');
  expect(getServerSupabaseConfig().cookieName).toBe(
    getSupabaseConfig().cookieName,
  );
});

it('accepts legacy anon keys without using privileged credentials', () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'a.' + btoa(JSON.stringify({ role: 'anon' })) + '.c',
  );
  expect(getSupabaseConfig().cookieName).toBe('sb-127-auth-token');
});
