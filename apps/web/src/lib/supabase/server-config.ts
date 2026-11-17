import 'server-only';

import { getSupabaseConfig } from './config';

// Only server-side clients import this module; never expose the internal URL.
export function getServerSupabaseConfig() {
  const config = getSupabaseConfig();
  return {
    ...config,
    url: process.env.SUPABASE_INTERNAL_URL?.trim() || config.url,
  };
}
