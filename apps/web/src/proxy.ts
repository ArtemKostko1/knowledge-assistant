import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabaseConfig } from './lib/supabase/server-config';
import { getSupabaseConfig } from './lib/supabase/config';
import {
  isFrameworkAsset,
  isPublicAuthRoute,
  isTokenFlowRoute,
} from './config/access-policy';
import { routes } from './config/routes';

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (isFrameworkAsset(pathname)) return NextResponse.next({ request });
  if (isTokenFlowRoute(pathname)) {
    // Do not refresh or import an unrelated login session into recovery.
    const response = NextResponse.next({ request });
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    const browserSupabaseOrigin = new URL(getSupabaseConfig().url).origin;
    const hmrOrigin = new URL(request.url);
    hmrOrigin.protocol = hmrOrigin.protocol === 'https:' ? 'wss:' : 'ws:';
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        `connect-src 'self' ${browserSupabaseOrigin}${process.env.NODE_ENV === 'development' ? ` ${hmrOrigin.origin}` : ''}`,
        "form-action 'self'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
      ].join('; '),
    );
    return response;
  }
  if (
    pathname === routes.app &&
    request.method === 'POST' &&
    request.headers.has('Next-Action')
  ) {
    // Let Next.js produce the Flight/action redirect response. The logout
    // action verifies the current Auth session before completing sign-out.
    const actionResponse = NextResponse.next({ request });
    actionResponse.headers.set('Cache-Control', 'private, no-store');
    return actionResponse;
  }
  let response = NextResponse.next({ request });
  const { url, key, cookieName } = getServerSupabaseConfig();
  const supabase = createServerClient(url, key, {
    cookieOptions: { name: cookieName },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  if (isPublicAuthRoute(pathname)) {
    // Never bounce signed-in users out of public authentication flows.
    await supabase.auth.getClaims();
  } else {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        const target = new URL('/login', request.url);
        const denied = NextResponse.redirect(
          target,
          ['GET', 'HEAD'].includes(request.method) ? 307 : 303,
        );
        response.cookies
          .getAll()
          .forEach((cookie) => denied.cookies.set(cookie));
        denied.headers.set('Cache-Control', 'private, no-store');
        return denied;
      }
    } catch {
      // Fail closed without leaking SDK errors or rendering private content.
      return new NextResponse(
        'Authentication is unavailable. Please try again.',
        {
          status: 503,
          headers: { 'Cache-Control': 'private, no-store' },
        },
      );
    }
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = { matcher: ['/:path*'] };
