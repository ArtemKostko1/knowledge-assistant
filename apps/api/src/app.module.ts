import { Controller, Get, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';

@Controller('health')
class HealthController {
  @Get()
  status(): { status: string } {
    return { status: 'ok' };
  }
}

@Module({ imports: [AuthModule], controllers: [HealthController] })
export class AppModule {}
