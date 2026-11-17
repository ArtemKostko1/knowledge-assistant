import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get('code');
  let success = false;
  if (
    code &&
    code.length <= 2048 &&
    params.getAll('code').length === 1 &&
    !params.has('error')
  ) {
    try {
      const client = await createClient();
      const result = await client.auth.exchangeCodeForSession(code);
      success =
        !result.error &&
        !!result.data.session &&
        !!result.data.user?.email_confirmed_at;
    } catch {
      // Never expose Auth errors or callback credentials.
    }
  }
  return new NextResponse(null, {
    status: 303,
    headers: {
      // Relative and fixed: neither Host nor a client-provided "next" is trusted.
      Location: success
        ? '/login?confirmation=success'
        : '/login?confirmation=invalid',
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
