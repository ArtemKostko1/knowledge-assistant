// Exact matches only. New product routes are private even outside route groups.
export const publicAuthRoutes = [
  '/login',
  '/signup',
  '/forgot-password',
  '/update-password',
  '/auth/confirm',
  '/auth/recovery',
] as const;

export function isPublicAuthRoute(pathname: string) {
  return publicAuthRoutes.some((route) => route === pathname);
}

export function isTokenFlowRoute(pathname: string) {
  return ['/auth/confirm', '/auth/recovery', '/update-password'].includes(
    pathname,
  );
}

export function isFrameworkAsset(pathname: string) {
  // Do not exempt arbitrary extensions or /_next/data (which can contain data).
  return (
    pathname.startsWith('/_next/static/') ||
    pathname === '/_next/image' ||
    pathname === '/_next/webpack-hmr' ||
    pathname === '/favicon.ico'
  );
}
