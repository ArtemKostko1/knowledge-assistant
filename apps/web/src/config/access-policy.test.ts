import { expect, it } from 'vitest';
import {
  isFrameworkAsset,
  isPublicAuthRoute,
  publicAuthRoutes,
} from './access-policy';

it.each(publicAuthRoutes)(
  'only explicitly allows authentication route %s',
  (path) => {
    expect(isPublicAuthRoute(path)).toBe(true);
  },
);
it.each([
  '/',
  '/app',
  '/app/settings',
  '/future-product',
  '/api/private',
  '/private/report.pdf',
  '/login/admin',
  '/auth/recovery/private',
  '/auth/unknown',
  '/_next/data/build/private.json',
])('keeps new and nested route %s private by default', (path) => {
  expect(isPublicAuthRoute(path)).toBe(false);
  expect(isFrameworkAsset(path)).toBe(false);
});
it.each([
  '/_next/static/chunks/app.js',
  '/_next/image',
  '/_next/webpack-hmr',
  '/favicon.ico',
])('exempts the necessary framework asset %s', (path) => {
  expect(isFrameworkAsset(path)).toBe(true);
});
