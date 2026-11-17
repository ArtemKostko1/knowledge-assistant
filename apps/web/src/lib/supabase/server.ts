import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getServerSupabaseConfig } from './server-config';

export async function createClient() {
  const store = await cookies();
  const { url, key, cookieName } = getServerSupabaseConfig();
  return createServerClient(url, key, {
    cookieOptions: { name: cookieName },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        // Server Components cannot write cookies; proxy handles session refresh.
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          // Read-only rendering context. Do not use this client for mutations there.
        }
      },
    },
  });
}
