import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { AuthConfig } from './config/auth.config.js';
import type { CheckedIdentity } from './jwt-verifier.js';

@Injectable()
export class AuthUserService {
  private readonly client;
  constructor(config: AuthConfig) {
    this.client = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) =>
          globalThis.fetch(input, {
            ...init,
            signal: AbortSignal.timeout(5000),
            redirect: 'error',
          }),
      },
    });
  }
  async confirmedEmail(identity: CheckedIdentity): Promise<string> {
    let result;
    try {
      result = await this.client.auth.getUser(identity.token);
    } catch {
      throw new ServiceUnavailableException(
        'Authentication service unavailable',
      );
    }
    if (
      result.error &&
      (result.error.status === 0 || (result.error.status ?? 0) >= 500)
    )
      throw new ServiceUnavailableException(
        'Authentication service unavailable',
      );
    if (result.error || !result.data.user)
      throw new UnauthorizedException('Invalid access token');
    const user: unknown = result.data.user;
    if (
      typeof user !== 'object' ||
      user === null ||
      !('id' in user) ||
      typeof user.id !== 'string' ||
      user.id.length === 0
    )
      throw new ServiceUnavailableException(
        'Authentication service unavailable',
      );
    if (user.id.toLowerCase() !== identity.id)
      throw new UnauthorizedException('Invalid access token');
    const email = 'email' in user ? user.email : undefined;
    const confirmedAt =
      'email_confirmed_at' in user ? user.email_confirmed_at : undefined;
    if (
      (email != null && typeof email !== 'string') ||
      (confirmedAt != null && typeof confirmedAt !== 'string')
    )
      throw new ServiceUnavailableException(
        'Authentication service unavailable',
      );
    if (!confirmedAt || !email)
      throw new ForbiddenException('Confirmed email required');
    return email;
  }
}
