import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { HttpExceptionFilter } from './common/http/http-exception.filter.js';
import { SafeLogger, safeLogger } from './common/logging/safe-logger.js';

@Module({
  imports: [AuthModule, HealthModule],
  providers: [
    { provide: SafeLogger, useValue: safeLogger },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
