import { Controller, Get, Module } from '@nestjs/common';

@Controller('health')
class HealthController {
  @Get()
  status(): { status: string } {
    return { status: 'ok' };
  }
}

@Module({ controllers: [HealthController] })
export class AppModule {}
