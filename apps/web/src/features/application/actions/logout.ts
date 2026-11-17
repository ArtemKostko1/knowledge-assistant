'use server';

import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';

export async function logout(): Promise<{ error: string | null }> {
  try {
    const client = await createClient();
    const verified = await client.auth.getUser();
    if (
      verified.error &&
      (verified.error.status === 0 || (verified.error.status ?? 0) >= 500)
    ) {
      return { error: 'Unable to sign out. Please try again.' };
    }
    const result = await client.auth.signOut({ scope: 'local' });
    if (result.error) return { error: 'Unable to sign out. Please try again.' };
  } catch {
    return { error: 'Unable to sign out. Please try again.' };
  }
  redirect('/login?logout=success');
}
