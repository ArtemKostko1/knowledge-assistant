'use server';

import { redirect } from 'next/navigation';
import { recoverPassword } from '../../../lib/supabase/recovery';

export async function updatePassword(
  _previous: { error: string | null },
  form: FormData,
): Promise<{ error: string | null; requestNewLink?: boolean }> {
  const result = await recoverPassword(
    form.get('token_hash'),
    form.get('password'),
  );
  if (result.error) return result;
  redirect('/login?recovery=success');
}
