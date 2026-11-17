import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtVerifier } from './jwt-verifier.js';
import type { CheckedIdentity } from './jwt-verifier.js';

export interface AuthRequest {
  headers: {
    authorization?: string;
    'content-type'?: string;
    'content-length'?: string;
    'transfer-encoding'?: string;
  };
  identity: CheckedIdentity;
  body?: unknown;
  query: Record<string, unknown>;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly verifier: JwtVerifier) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    // Also cover 401/403/404 responses, before controller handlers run.
    context
      .switchToHttp()
      .getResponse<{ setHeader(name: string, value: string): void }>()
      .setHeader('Cache-Control', 'no-store');
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '');
    if (!match?.[1]) throw new UnauthorizedException('Bearer token required');
    req.identity = await this.verifier.verify(match[1]);
    return true;
  }
}
