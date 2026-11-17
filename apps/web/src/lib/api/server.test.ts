import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { requestApi } from './server';

vi.mock('server-only', () => ({}));

const fetchMock = vi.hoisted(() => vi.fn());

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('API_INTERNAL_URL', 'http://api:3001');
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:3001');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('sends a bounded, no-store Bearer request to the internal API', async () => {
  await requestApi('/auth/bootstrap', 'synthetic-token', 'POST');
  expect(fetchMock).toHaveBeenCalledWith(
    'http://api:3001/auth/bootstrap',
    expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic-token' },
      cache: 'no-store',
      redirect: 'error',
      signal: expect.any(AbortSignal),
    }),
  );
});

it('uses the public development URL only when the internal URL is absent', async () => {
  vi.stubEnv('API_INTERNAL_URL', undefined);
  await requestApi('/auth/me', 'synthetic-token', 'GET');
  expect(fetchMock.mock.calls[0]![0]).toBe('http://127.0.0.1:3001/auth/me');
});

it('rejects invalid internal configuration without falling back', async () => {
  vi.stubEnv('API_INTERNAL_URL', '');
  expect(() => requestApi('/auth/me', 'synthetic-token', 'GET')).toThrow(
    'API configuration unavailable',
  );
  expect(fetchMock).not.toHaveBeenCalled();
});
