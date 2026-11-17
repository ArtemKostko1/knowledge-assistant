import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { AuthConfig } from './auth.config.js';

export interface CheckedIdentity {
  id: string;
  token: string;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class JwtVerifier {
  private readonly keys: JWTVerifyGetKey;
  constructor(private readonly config: AuthConfig) {
    // Never use jku/jwk/x5u supplied by the token. URL is operator-controlled.
    this.keys = createRemoteJWKSet(
      new URL(`${config.url}/auth/v1/.well-known/jwks.json`),
      { timeoutDuration: 5000 },
    );
  }
  async verify(
    token: string,
    keys: JWTVerifyGetKey = this.keys,
  ): Promise<CheckedIdentity> {
    try {
      const { payload } = await jwtVerify(token, keys, {
        algorithms: [this.config.algorithm],
        issuer: this.config.issuer,
        audience: this.config.audience,
        requiredClaims: ['sub', 'exp', 'iat', 'role'],
      });
      if (
        typeof payload.sub !== 'string' ||
        !uuid.test(payload.sub) ||
        payload.role !== 'authenticated'
      )
        throw new Error();
      return { id: payload.sub.toLowerCase(), token };
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
