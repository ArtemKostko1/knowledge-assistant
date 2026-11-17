export class AuthConfig {
  constructor(
    readonly url: string,
    readonly anonKey: string,
    readonly issuer: string,
    readonly audience: string,
    readonly algorithm: 'ES256',
    readonly databaseUrl: string,
  ) {}
}

export function loadAuthConfig(env = process.env): AuthConfig {
  const required = (name: string): string => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Missing required configuration: ${name}`);
    return value;
  };
  const validUrl = (name: string): string => {
    const value = required(name);
    try {
      const url = new URL(value);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error();
      // Local CLI tokens retain their loopback issuer, including in local Compose.
      if (
        name === 'SUPABASE_JWT_ISSUER' &&
        env.NODE_ENV === 'production' &&
        url.protocol !== 'https:' &&
        !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      )
        throw new Error();
      return value.replace(/\/$/, '');
    } catch {
      throw new Error(`Invalid configuration: ${name}`);
    }
  };
  const url = validUrl('SUPABASE_URL');
  const issuer = validUrl('SUPABASE_JWT_ISSUER');
  const anonKey = required('SUPABASE_ANON_KEY');
  // Only publishable keys or legacy anon JWTs; never a service/secret key.
  let publicKey = anonKey.startsWith('sb_publishable_');
  if (!publicKey) {
    try {
      const claims = JSON.parse(
        Buffer.from(anonKey.split('.')[1] ?? '', 'base64url').toString(),
      ) as { role?: unknown };
      publicKey = claims.role === 'anon';
    } catch {
      /* Invalid server configuration, not an authentication failure. */
    }
  }
  if (!publicKey)
    throw new Error('Invalid configuration: SUPABASE_ANON_KEY must be public');
  if (required('SUPABASE_JWT_ALGORITHM') !== 'ES256')
    throw new Error('Invalid configuration: SUPABASE_JWT_ALGORITHM');
  const databaseUrl = required('DATABASE_URL');
  try {
    if (!['postgres:', 'postgresql:'].includes(new URL(databaseUrl).protocol))
      throw new Error();
  } catch {
    throw new Error('Invalid configuration: DATABASE_URL');
  }
  return new AuthConfig(
    url,
    anonKey,
    issuer,
    required('SUPABASE_JWT_AUDIENCE'),
    'ES256',
    databaseUrl,
  );
}
