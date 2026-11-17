'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseConfig } from './config';

export function createClient() {
  const { url, key, cookieName } = getSupabaseConfig();
  return createBrowserClient(url, key, { cookieOptions: { name: cookieName } });
}
