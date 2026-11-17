import { Module } from '@nestjs/common';
import { AuthConfig, loadAuthConfig } from './config/auth.config.js';
import { JwtVerifier } from './jwt-verifier.js';
import { AuthGuard } from './auth.guard.js';
import { AuthUserService } from './auth-user.service.js';
import { AppUserRepository } from './app-user.repository.js';
import { AuthController } from './auth.controller.js';

@Module({
  controllers: [AuthController],
  providers: [
    { provide: AuthConfig, useFactory: loadAuthConfig },
    JwtVerifier,
    AuthGuard,
    AuthUserService,
    AppUserRepository,
  ],
})
export class AuthModule {}
