export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase public configuration is missing');
  let publicKey = key.startsWith('sb_publishable_');
  if (!publicKey) {
    try {
      const payload = key.split('.')[1] ?? '';
      publicKey =
        JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role ===
        'anon';
    } catch {
      publicKey = false;
    }
  }
  if (!publicKey) throw new Error('Supabase key must be public');
  // Match Supabase's public-URL default, regardless of the server routing URL.
  const cookieName = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  return { url, key, cookieName };
}
