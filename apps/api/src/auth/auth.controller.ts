import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from './auth.guard.js';
import type { AuthRequest } from './auth.guard.js';
import { AuthUserService } from './auth-user.service.js';
import { AppUserRepository } from './app-user.repository.js';

@Controller('auth')
@UseGuards(AuthGuard)
export class AuthController {
  constructor(
    private readonly users: AppUserRepository,
    private readonly auth: AuthUserService,
  ) {}
  private noInput(req: AuthRequest): void {
    if (
      Object.keys(req.query).length ||
      (req.body !== undefined &&
        (typeof req.body !== 'object' ||
          req.body === null ||
          Object.keys(req.body).length > 0)) ||
      Number(req.headers['content-length'] ?? 0) > 0 ||
      req.headers['transfer-encoding']
    ) {
      throw new BadRequestException('This endpoint accepts no input');
    }
  }
  @Post('bootstrap')
  @HttpCode(200)
  async bootstrap(@Req() req: AuthRequest) {
    this.noInput(req);
    const email = await this.auth.confirmedEmail(req.identity);
    return this.users.upsert(req.identity.id, email);
  }
  @Get('me')
  async me(@Req() req: AuthRequest) {
    this.noInput(req);
    const user = await this.users.find(req.identity.id);
    if (!user) throw new NotFoundException('User not bootstrapped');
    return user;
  }
}
