import 'server-only';

import { cache } from 'react';
import { createClient } from '../../../lib/supabase/server';

export type VerifiedSession =
  | { kind: 'unauthenticated' }
  | { kind: 'error'; message: string }
  | { kind: 'authenticated'; userId: string; accessToken: string };

// React.cache is scoped to a server render/request, never a global user cache.
// Keep this result server-only: never pass it to a Client Component.
export const getVerifiedSession = cache(async (): Promise<VerifiedSession> => {
  const unavailable: VerifiedSession = {
    kind: 'error',
    message: 'Authentication is unavailable. Please try again.',
  };
  try {
    const client = await createClient();
    const session = await client.auth.getSession();
    if (session.error)
      return session.error.status === 0 || (session.error.status ?? 0) >= 500
        ? unavailable
        : { kind: 'unauthenticated' };
    if (!session.data.session?.access_token) return { kind: 'unauthenticated' };
    const token = session.data.session.access_token;
    const verified = await client.auth.getUser(token);
    if (verified.error)
      return verified.error.status === 0 || (verified.error.status ?? 0) >= 500
        ? unavailable
        : { kind: 'unauthenticated' };
    if (!verified.data.user) return { kind: 'unauthenticated' };
    return {
      kind: 'authenticated',
      userId: verified.data.user.id,
      accessToken: token,
    };
  } catch {
    return unavailable;
  }
});
