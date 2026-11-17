import 'server-only';

export type ApiMethod = 'POST' | 'GET';

function apiUrl() {
  const value = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!value) throw new Error('API configuration unavailable');
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('API configuration invalid');
  return value.replace(/\/+$/, '');
}

/** Performs one authenticated server-to-server API request. */
export function requestApi(
  path: string,
  token: string,
  method: ApiMethod,
): Promise<Response> {
  return fetch(`${apiUrl()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
}
