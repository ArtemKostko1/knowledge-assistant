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
    const user = result.data.user;
    if (user.id.toLowerCase() !== identity.id)
      throw new UnauthorizedException('Invalid access token');
    if (!user.email_confirmed_at || !user.email)
      throw new ForbiddenException('Confirmed email required');
    return user.email;
  }
}
