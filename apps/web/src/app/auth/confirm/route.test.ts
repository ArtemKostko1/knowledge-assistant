import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

const mocks = vi.hoisted(() => ({ exchange: vi.fn() }));
vi.mock('../../../lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: mocks.exchange },
  }),
}));
beforeEach(() => vi.resetAllMocks());

it('exchanges confirmation code through the SSR client and ignores redirect input', async () => {
  mocks.exchange.mockResolvedValue({
    data: { session: {}, user: { email_confirmed_at: 'synthetic-date' } },
    error: null,
  });
  const response = await GET(
    new NextRequest(
      'http://local.test/auth/confirm?code=synthetic-code&next=https://evil.test',
    ),
  );
  expect(mocks.exchange).toHaveBeenCalledWith('synthetic-code');
  expect(response.headers.get('location')).toBe('/login?confirmation=success');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it.each(['expired', 'used', 'invalid'])(
  'handles %s confirmation codes',
  async (reason) => {
    mocks.exchange.mockResolvedValue({ data: {}, error: { message: reason } });
    const response = await GET(
      new NextRequest('http://local.test/auth/confirm?code=synthetic'),
    );
    expect(response.headers.get('location')).toBe(
      '/login?confirmation=invalid',
    );
  },
);
it.each(['', '?error=invalid', '?code=a&code=b'])(
  'rejects missing or ambiguous confirmation data: %s',
  async (query) => {
    const response = await GET(
      new NextRequest('http://local.test/auth/confirm' + query),
    );
    expect(response.headers.get('location')).toBe(
      '/login?confirmation=invalid',
    );
    expect(mocks.exchange).not.toHaveBeenCalled();
  },
);
it('handles transport errors without reflecting credentials', async () => {
  mocks.exchange.mockRejectedValue(new Error('secret-marker'));
  const response = await GET(
    new NextRequest('http://local.test/auth/confirm?code=synthetic'),
  );
  expect(response.headers.get('location')).toBe('/login?confirmation=invalid');
});
