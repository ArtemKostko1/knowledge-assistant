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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { ApiResponseNoStatusOptions } from '@nestjs/swagger';
import {
  ApiErrorResponseDto,
  apiErrorResponseHeaders,
} from '../../common/http/api-error.response.js';
import { AuthGuard } from './auth.guard.js';
import type { AuthRequest } from './auth.guard.js';
import { AuthUserService } from './auth-user.service.js';
import { AppUserRepository } from './app-user.repository.js';
import { AppUserProfileResponse } from './app-user-profile.response.js';

const noStoreHeaders = {
  ...apiErrorResponseHeaders,
  'Cache-Control': {
    description: 'Authentication responses are not cacheable.',
    schema: { type: 'string', enum: ['no-store'], example: 'no-store' },
  },
};

function errorResponse(description: string): ApiResponseNoStatusOptions {
  return {
    description,
    headers: noStoreHeaders,
    type: ApiErrorResponseDto,
  };
}

@ApiTags('auth')
@ApiBearerAuth('bearer')
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
  @ApiOperation({
    summary: 'Bootstrap the authenticated application user',
    description:
      'Confirms the current Supabase user and creates or updates the application profile. This endpoint accepts no request body or query parameters.',
  })
  @ApiOkResponse({
    description: 'The application user profile.',
    type: AppUserProfileResponse,
    headers: noStoreHeaders,
  })
  @ApiBadRequestResponse(
    errorResponse(
      'The request contains a body or query parameter, or has malformed JSON.',
    ),
  )
  @ApiUnauthorizedResponse(
    errorResponse('The Bearer JWT is missing or invalid.'),
  )
  @ApiForbiddenResponse(
    errorResponse('The authenticated email is not confirmed.'),
  )
  @ApiServiceUnavailableResponse(
    errorResponse('The authentication service or user store is unavailable.'),
  )
  @ApiInternalServerErrorResponse(
    errorResponse('An unexpected server error occurred.'),
  )
  async bootstrap(@Req() req: AuthRequest) {
    this.noInput(req);
    const email = await this.auth.confirmedEmail(req.identity);
    return this.users.upsert(req.identity.id, email);
  }
  @Get('me')
  @ApiOperation({
    summary: 'Get the authenticated application user profile',
    description:
      'Returns the existing application profile without creating it. This endpoint accepts no request body or query parameters.',
  })
  @ApiOkResponse({
    description: 'The application user profile.',
    type: AppUserProfileResponse,
    headers: noStoreHeaders,
  })
  @ApiBadRequestResponse(
    errorResponse(
      'The request contains a body or query parameter, or has malformed JSON.',
    ),
  )
  @ApiUnauthorizedResponse(
    errorResponse('The Bearer JWT is missing or invalid.'),
  )
  @ApiNotFoundResponse(
    errorResponse('The application profile has not been bootstrapped.'),
  )
  @ApiServiceUnavailableResponse(
    errorResponse('The user store is unavailable.'),
  )
  @ApiInternalServerErrorResponse(
    errorResponse('An unexpected server error occurred.'),
  )
  async me(@Req() req: AuthRequest) {
    this.noInput(req);
    const user = await this.users.find(req.identity.id);
    if (!user) throw new NotFoundException('User not bootstrapped');
    return user;
  }
}
