import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getServerSupabaseConfig } from './server-config';

export const invalidRecoveryMessage =
  'This recovery link is invalid, expired, or already used. Request a new link.';
export const consumedRecoveryMessage =
  'The recovery link may have been used, but the password could not be updated. Request a new link.';

export function validRecoveryToken(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{20,512}$/.test(value);
}

export async function recoverPassword(
  token: unknown,
  password: unknown,
): Promise<{
  error: string | null;
  requestNewLink?: boolean;
}> {
  if (!validRecoveryToken(token))
    return { error: invalidRecoveryMessage, requestNewLink: true };
  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 128
  )
    return { error: 'Use a password between 8 and 128 characters.' };

  let verified = false;
  try {
    const { url, key } = getServerSupabaseConfig();
    // Deliberately isolated from SSR cookies and any existing login session.
    // The only session this client can acquire comes from verifyOtp below.
    const client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            redirect: 'error',
            signal: AbortSignal.timeout(10000),
          }),
      },
    });
    const { data, error } = await client.auth.verifyOtp({
      token_hash: token,
      type: 'recovery',
    });
    if (
      error ||
      !data.session ||
      !data.user ||
      data.session.user.id !== data.user.id
    )
      return { error: invalidRecoveryMessage, requestNewLink: true };
    verified = true;
    try {
      const updated = await client.auth.updateUser({ password });
      if (updated.error || updated.data.user?.id !== data.user.id)
        return { error: consumedRecoveryMessage, requestNewLink: true };
      return { error: null };
    } finally {
      // Revoke only this transient recovery session, never the browser's session.
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
  } catch {
    // A transport error may occur after the Auth server consumed the token.
    return {
      error: verified ? consumedRecoveryMessage : invalidRecoveryMessage,
      requestNewLink: true,
    };
  }
}
